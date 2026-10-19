// Ringbreaker enemies: rogue security robots built from primitives (merged per part: 1-2 draw calls each),
// with AI that takes cover, peeks, flanks and telegraphs every attack. Plus pooled enemy projectiles.
import { THREE } from './kit/cine.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { RAMP, outlineMat } from './world.js';

const TAU = Math.PI * 2, V = new THREE.Vector3(), V2 = new THREE.Vector3(), Q = new THREE.Quaternion(), M = new THREE.Matrix4(), S = new THREE.Vector3(), E = new THREE.Euler(), ZF = new THREE.Vector3(0, 0, 1);
const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- model building
function col(g, c) { if (g.index) g = g.toNonIndexed(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  const n = g.attributes.position.count, a = new Float32Array(n * 3), C = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = C.r; a[i * 3 + 1] = C.g; a[i * 3 + 2] = C.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.clearGroups(); return g; }
function part() {
  const b = [], g = [];
  const put = (arr, geo, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const G = col(geo, c); Q.setFromEuler(E.set(rx, ry, rz)); M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz)); G.applyMatrix4(M); arr.push(G); };
  return {
    b: (...a) => put(b, ...a), g: (...a) => put(g, ...a),
    box: (w, h, d, c, x, y, z, rx, ry, rz) => put(b, new THREE.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz),
    rb: (w, h, d, r, c, x, y, z, rx, ry, rz) => put(b, new RoundedBoxGeometry(w, h, d, 2, r), c, x, y, z, rx, ry, rz),
    done: () => ({ body: b.length ? mergeGeometries(b) : null, glow: g.length ? mergeGeometries(g) : null }),
  };
}
const WHITE = 0xf4f6fa, GREY = 0xbcc6da, DARK = 0x3a4688, BLACK = 0x23284d, ORANGE = 0xff6a1a, YEL = 0xffc21a;
const RED = new THREE.Color(4, 0.5, 0.25), REDV = 0xff2a5a;

function walkerTpl(heavy = false) {
  const k = heavy ? 1.22 : 1, A = heavy ? 0xffc21a : WHITE, A2 = heavy ? DARK : ORANGE;
  const T = {};
  { const p = part(); p.rb(0.62 * k, 0.28, 0.36 * k, 0.06, DARK, 0, 0, 0); p.rb(0.5 * k, 0.12, 0.3 * k, 0.04, A, 0, 0.12, 0.04); T.hips = p.done(); }
  for (const s of [-1, 1]) {
    const p = part();
    p.rb(0.24 * k, 0.55, 0.28 * k, 0.05, A, 0, -0.27, 0.02); p.b(new THREE.SphereGeometry(0.12 * k, 10, 8), DARK, 0, -0.56, 0.02);
    p.rb(0.2 * k, 0.5, 0.22 * k, 0.05, GREY, 0, -0.8, -0.06, -0.12); p.rb(0.26 * k, 0.1, 0.42 * k, 0.03, DARK, 0, -1.02, 0.06);
    p.box(0.05, 0.3, 0.05, BLACK, s * 0.12 * k, -0.3, 0.1); p.g(new THREE.BoxGeometry(0.03, 0.18, 0.02), A2 === YEL ? 0xffb020 : ORANGE, s * 0.13 * k, -0.25, 0.16);
    T[s < 0 ? 'legL' : 'legR'] = p.done();
  }
  { const p = part();
    p.b(new THREE.CylinderGeometry(0.17 * k, 0.22 * k, 0.3, 12), DARK, 0, 0.12, 0);
    p.rb(0.72 * k, 0.5, 0.46 * k, 0.09, A, 0, 0.48, 0); p.rb(0.6 * k, 0.24, 0.1, 0.04, GREY, 0, 0.55, 0.24);
    p.rb(0.44 * k, 0.5, 0.26, 0.06, DARK, 0, 0.5, -0.3); p.box(0.04, 0.35, 0.04, BLACK, 0.15, 0.95, -0.35);
    for (const s of [-1, 1]) { p.rb(0.3 * k, 0.2, 0.42 * k, 0.06, heavy ? DARK : ORANGE, s * 0.45 * k, 0.72, 0, 0, 0, s * -0.25); p.box(0.05, 0.05, 0.3, BLACK, s * 0.2, 0.32, 0.24); }
    p.g(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16), heavy ? 0x66ccff : REDV, 0, 0.48, 0.245, Math.PI / 2);
    for (const s of [-1, 1]) p.g(new THREE.BoxGeometry(0.02, 0.18, 0.12), ORANGE, s * 0.37 * k, 0.45, 0.08);
    p.g(new THREE.BoxGeometry(0.3 * k, 0.025, 0.02), ORANGE, 0, 0.3, 0.235);
    if (heavy) { p.rb(0.9, 0.3, 0.55, 0.08, DARK, 0, 0.82, -0.05); p.box(0.7, 0.08, 0.3, 0xff3a6e, 0, 0.98, -0.1); }
    T.torso = p.done(); }
  { const p = part();
    p.rb(0.34 * k, 0.26, 0.36 * k, 0.07, A, 0, 0.1, 0); p.rb(0.3 * k, 0.1, 0.12, 0.03, BLACK, 0, 0.11, 0.15);
    for (const s of [-1, 1]) { p.g(new THREE.SphereGeometry(0.06 * k, 14, 10), REDV, s * 0.075 * k, 0.11, 0.2, 0, 0, 0, 1, 1, 0.5); p.box(0.11 * k, 0.035, 0.05, BLACK, s * 0.075 * k, 0.185, 0.2, 0, 0, s * 0.4); }
    p.box(0.02, 0.22, 0.02, BLACK, 0.12, 0.3, -0.08); p.g(new THREE.SphereGeometry(0.025, 6, 4), REDV, 0.12, 0.42, -0.08);
    for (const s of [-1, 1]) p.b(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), DARK, s * 0.19 * k, 0.1, 0.02, 0, 0, Math.PI / 2);
    T.head = p.done(); }
  for (const s of [-1, 1]) {
    const p = part();
    p.b(new THREE.SphereGeometry(0.11 * k, 10, 8), DARK, 0, 0, 0); p.rb(0.15 * k, 0.4, 0.16 * k, 0.04, GREY, 0, -0.2, 0);
    p.rb(0.16 * k, 0.36, 0.18 * k, 0.04, A, 0, -0.52, 0.02);
    if (s > 0) { // gun arm
      const gl = heavy ? 1.5 : 1;
      p.rb(0.2 * gl, 0.2 * gl, 0.55 * gl, 0.04, DARK, 0, -0.72, 0.18); p.b(new THREE.CylinderGeometry(0.05 * gl, 0.06 * gl, 0.45 * gl, 10), BLACK, 0, -0.72, 0.6 * gl, Math.PI / 2);
      p.g(new THREE.TorusGeometry(0.06 * gl, 0.015, 6, 12), heavy ? 0x7ab0ff : REDV, 0, -0.72, 0.83 * gl); p.g(new THREE.BoxGeometry(0.02, 0.03, 0.4 * gl), ORANGE, 0.1 * gl, -0.66, 0.2);
    } else if (heavy) { p.rb(0.3, 0.5, 0.18, 0.05, DARK, 0, -0.65, 0.12); p.g(new THREE.BoxGeometry(0.22, 0.05, 0.05), 0x66ccff, 0, -0.62, 0.22); }
    else p.rb(0.14, 0.14, 0.18, 0.04, DARK, 0, -0.74, 0.04);
    T[s < 0 ? 'armL' : 'armR'] = p.done();
  }
  return T;
}
function droneTpl() {
  const T = {};
  { const p = part();
    p.b(new THREE.SphereGeometry(0.42, 24, 16), DARK, 0, 0, 0, 0, 0, 0, 1, 0.82, 1);
    p.b(new THREE.TorusGeometry(0.42, 0.06, 8, 32), WHITE, 0, 0, 0, Math.PI / 2);
    p.b(new THREE.CylinderGeometry(0.2, 0.24, 0.16, 20), WHITE, 0, 0, 0.36, Math.PI / 2);
    p.b(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20), BLACK, 0, 0, 0.45, Math.PI / 2);
    p.g(new THREE.SphereGeometry(0.1, 16, 10), REDV, 0, 0, 0.44);
    for (const s of [-1, 1]) { p.b(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), GREY, s * 0.5, 0, 0, 0, 0, Math.PI / 2); p.b(new THREE.CylinderGeometry(0.16, 0.2, 0.28, 16), WHITE, s * 0.74, 0, 0); p.box(0.04, 0.3, 0.3, ORANGE, s * 0.9, 0.0, -0.05); }
    p.b(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 8), BLACK, 0, -0.38, 0.12, Math.PI / 2.4); p.box(0.02, 0.35, 0.02, BLACK, 0.1, 0.48, -0.1);
    p.g(new THREE.SphereGeometry(0.03, 6, 4), REDV, 0.1, 0.66, -0.1);
    for (const s of [-1, 1]) p.g(new THREE.BoxGeometry(0.02, 0.02, 0.2), ORANGE, s * 0.32, 0.18, 0.2);
    T.body = p.done(); }
  { const p = part(); for (const s of [-1, 1]) { p.g(new THREE.TorusGeometry(0.2, 0.02, 6, 24), 0xff6a3a, s * 0.74, -0.15, 0, Math.PI / 2); p.b(new THREE.BoxGeometry(0.36, 0.02, 0.05), BLACK, s * 0.74, -0.15, 0); p.b(new THREE.BoxGeometry(0.05, 0.02, 0.36), BLACK, s * 0.74, -0.15, 0); } T.rotor = p.done(); }
  return T;
}
function bossTpl() {
  const T = {}, A = 0xf4f6fa, B2 = 0xe8433a;
  for (const s of [-1, 1]) { const p = part();
    p.rb(0.9, 1.6, 1.0, 0.15, A, 0, -0.8, 0.1); p.b(new THREE.SphereGeometry(0.42, 14, 10), B2, 0, -1.65, 0.1); p.rb(0.7, 1.6, 0.8, 0.12, B2, 0, -2.4, -0.15, 0.2);
    p.rb(1.3, 0.35, 1.8, 0.1, B2, 0, -3.2, 0.2); p.box(0.92, 0.2, 0.2, YEL, 0, -0.3, 0.55); p.g(new THREE.BoxGeometry(0.06, 0.8, 0.06), ORANGE, s * 0.47, -0.9, 0.4);
    for (const t of [-1, 1]) p.b(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8), BLACK, t * 0.3, -2.0, -0.5, 0.3);
    T[s < 0 ? 'legL' : 'legR'] = p.done(); }
  { const p = part();
    p.rb(3.0, 1.9, 2.4, 0.25, A, 0, 0.9, 0); p.rb(2.4, 1.0, 2.0, 0.2, B2, 0, -0.2, 0); p.rb(2.2, 0.8, 0.5, 0.15, B2, 0, 1.1, 1.25);
    p.rb(1.2, 0.7, 1.0, 0.15, A, 0, 2.05, 0.7); p.rb(1.0, 0.25, 0.3, 0.06, BLACK, 0, 2.05, 1.18);
    for (const x of [-0.3, 0, 0.3]) p.g(new THREE.SphereGeometry(0.09, 10, 8), REDV, x, 2.05, 1.32);
    p.b(new THREE.TorusGeometry(0.62, 0.12, 10, 28), B2, 0, 0.9, 1.25); p.g(new THREE.SphereGeometry(0.5, 20, 14), 0xff8a2a, 0, 0.9, 1.15);
    p.rb(1.6, 1.2, 1.0, 0.15, B2, 0, 1.1, -1.5); for (let i = 0; i < 4; i++) p.b(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 10), BLACK, -0.6 + i * 0.4, 2.0, -1.6);
    for (let i = 0; i < 4; i++) p.g(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 10), ORANGE, -0.6 + i * 0.4, 2.62, -1.6);
    for (const s of [-1, 1]) { p.box(0.1, 0.25, 2.2, YEL, s * 1.52, 0.4, 0); p.g(new THREE.BoxGeometry(0.04, 0.1, 1.8), ORANGE, s * 1.53, 1.5, 0); }
    // missile pod (left shoulder)
    p.rb(1.1, 0.9, 1.4, 0.12, A, -2.0, 1.8, 0.1); for (let i = 0; i < 6; i++) p.g(new THREE.CircleGeometry(0.11, 10), 0xff3a1a, -2.3 + (i % 3) * 0.3, 1.6 + Math.floor(i / 3) * 0.32, 0.81);
    p.box(0.6, 0.6, 0.6, B2, -1.6, 1.4, 0);
    T.torso = p.done(); }
  { const p = part(); // rotary cannon (spins)
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; p.b(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 8), BLACK, Math.cos(a) * 0.25, Math.sin(a) * 0.25, 1.1, Math.PI / 2); }
    p.b(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 16), B2, 0, 0, 0.2, Math.PI / 2); p.b(new THREE.TorusGeometry(0.33, 0.06, 6, 16), A, 0, 0, 1.9);
    p.g(new THREE.TorusGeometry(0.3, 0.03, 6, 16), 0xffaa33, 0, 0, 2.2); T.gun = p.done(); }
  { const p = part(); p.rb(1.0, 1.0, 1.4, 0.15, A, 0, 0, -0.2); p.b(new THREE.SphereGeometry(0.5, 12, 10), B2, 0, 0, -0.8); T.gunMount = p.done(); }
  return T;
}

// hex energy shield for heavies
function shieldMat() {
  return new THREE.ShaderMaterial({ uniforms: { uHit: { value: 0 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uHit, uTime; float hex(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.) * .5; p = abs(fract(p) - .5); return abs(max(p.x * 1.5 + p.y, p.y * 2.) - 1.); }
      void main(){ float h = 1. - smoothstep(0., .1, hex(vUv * vec2(9., 7.))); float e = smoothstep(.5, .35, distance(vUv, vec2(.5)) ); float edge = smoothstep(.3, .5, distance(vUv, vec2(.5))) * e;
        float a = (h * .5 + .08 + edge * 1.2) * e * (.75 + .25 * sin(uTime * 6. + vUv.y * 20.)) * (1. + uHit * 3.); gl_FragColor = vec4(vec3(.3, .7, 1.6) * a, 1.); }` });
}

// ---------------------------------------------------------------- enemy system
export const STATS = {
  drone: { hp: 45, score: 100, r: 0.6 }, walker: { hp: 90, score: 150, r: 0.45 }, heavy: { hp: 260, score: 350, r: 0.7 }, boss: { hp: 3400, score: 3000, r: 2.2 },
};

export function createEnemies(G) {
  const tpl = { walker: walkerTpl(false), heavy: walkerTpl(true), drone: droneTpl(), boss: bossTpl() };
  const baseBody = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP }), OL = outlineMat(0.025);
  const baseGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2) });
  const pool = { walker: [], heavy: [], drone: [], boss: [] }, list = [];

  function mesh(T, bm, gm, parent) { const g = new THREE.Group(); if (T.body) { const m = new THREE.Mesh(T.body, bm); m.castShadow = true; g.add(m); g.add(new THREE.Mesh(T.body, OL)); } if (T.glow) g.add(new THREE.Mesh(T.glow, gm)); parent.add(g); return g; }
  function make(type) {
    const T = tpl[type], bm = baseBody.clone(), gm = baseGlow.clone(), root = new THREE.Group(), P = {};
    if (type === 'drone') { P.body = mesh(T.body, bm, gm, root); P.rotor = mesh(T.rotor, bm, gm, P.body); }
    else if (type === 'boss') {
      P.hips = new THREE.Group(); P.hips.position.y = 3.6; root.add(P.hips);
      P.legL = mesh(T.legL, bm, gm, P.hips); P.legL.position.set(-1.1, 0, 0); P.legR = mesh(T.legR, bm, gm, P.hips); P.legR.position.set(1.1, 0, 0);
      P.torso = mesh(T.torso, bm, gm, P.hips); P.torso.position.y = 0.3;
      P.mount = mesh(T.gunMount, bm, gm, P.torso); P.mount.position.set(2.0, 0.9, 0.3); P.gun = mesh(T.gun, bm, gm, P.mount); P.gun.position.z = 0.4;
      root.scale.setScalar(1.0);
    } else {
      const k = type === 'heavy' ? 1.22 : 1;
      P.hips = mesh(T.hips, bm, gm, root); P.hips.position.y = 1.08 * k;
      P.legL = mesh(T.legL, bm, gm, P.hips); P.legL.position.set(-0.2 * k, -0.02, 0); P.legR = mesh(T.legR, bm, gm, P.hips); P.legR.position.set(0.2 * k, -0.02, 0);
      P.torso = mesh(T.torso, bm, gm, P.hips); P.torso.position.y = 0.1;
      P.head = mesh(T.head, bm, gm, P.torso); P.head.position.y = 0.76 + (k - 1) * 0.3;
      P.armL = mesh(T.armL, bm, gm, P.torso); P.armL.position.set(-0.5 * k, 0.66, 0); P.armR = mesh(T.armR, bm, gm, P.torso); P.armR.position.set(0.5 * k, 0.66, 0);
      if (type === 'heavy') { const sm = shieldMat(); P.shield = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 12, -0.9, 1.8, 0.75, 1.6), sm); P.shield.position.set(0, 1.5, 0.15); root.add(P.shield); P.shieldMat = sm; }
    }
    G.scene.add(root);
    return { type, root, P, bm, gm, alive: false };
  }
  function spawn(type, x, z, room, opts = {}) {
    let e = pool[type].find(o => !o.alive && !o.dying);
    if (!e) { e = make(type); pool[type].push(e); }
    const st = STATS[type], k = G.diff();
    Object.assign(e, { alive: true, dying: 0, hp: st.hp * (type === 'boss' ? 1 : 0.85 + 0.15 * k), max: 0, room, state: 'idle', t: rand(0, 1), cool: rand(1, 2.2), tele: 0, burst: 0, flash: 0, crouch: 0, yaw: 0, active: !!opts.active, cover: null,
      vel: new THREE.Vector3(), goal: null, walk: 0, alt: rand(2.4, 3.8), orbit: Math.random() < 0.5 ? 1 : -1, phase: Math.random() * 6, flank: false, cycles: 0, hitDir: 0, shieldHit: 0, attack: 0, spin: 0, stage: 0, markers: [] });
    e.max = e.hp;
    e.root.visible = true; e.root.position.set(x, type === 'drone' ? e.alt : 0, z); e.root.rotation.set(0, 0, 0);
    e.gm.color.setScalar(2.2); e.bm.emissive.setRGB(0, 0, 0);
    if (e.P.hips && type !== 'boss') { e.P.hips.rotation.set(0, 0, 0); e.P.torso.rotation.set(0, 0, 0); }
    if (opts.warp) { G.fx.burstGlow(V.set(x, 1.2, z), [0.6, 1.6, 4], 26, 3, 0.4, 0.8); G.fx.flash(V, 0x55aaff, 40, 0.4); G.snd.spawn(G.distTo(V)); e.warp = 0.6; e.active = true; } else e.warp = 0;
    face(e, G.player.pos);
    list.push(e); return e;
  }
  function face(e, p) { e.yaw = Math.atan2(p.x - e.root.position.x, p.z - e.root.position.z); e.root.rotation.y = e.yaw; }

  // hit spheres in world space
  const HB = {
    walker: [['head', 0, 1.98, 0.02, 0.24], ['body', 0, 1.48, 0, 0.44], ['legs', 0, 0.65, 0, 0.38]],
    heavy: [['head', 0, 2.42, 0.02, 0.28], ['body', 0, 1.75, 0, 0.62], ['legs', 0, 0.8, 0, 0.5]],
    drone: [['head', 0, 0, 0.42, 0.17], ['body', 0, 0, 0, 0.62]],
    boss: [['core', 0, 4.8, 1.25, 0.65], ['head', 0, 6.0, 0.8, 0.6], ['body', 0, 4.8, 0, 1.9], ['legs', -1.1, 1.8, 0, 0.9], ['legs', 1.1, 1.8, 0, 0.9]],
  };
  function spheres(e, out) {
    const p = e.root.position, c = Math.cos(e.root.rotation.y), s = Math.sin(e.root.rotation.y), dn = e.crouch * 0.45;
    let i = 0;
    for (const [name, x, y, z, r] of HB[e.type]) { const o = out[i] || (out[i] = { c: new THREE.Vector3() }); o.name = name; o.r = r; o.c.set(p.x + x * c + z * s, p.y + y - (name === 'legs' ? 0 : dn), p.z - x * s + z * c); i++; }
    out.length = i; return out;
  }
  const tmpS = [];
  /** ray vs enemies: returns nearest {e, t, part} */
  function ray(o, d, maxT) {
    let best = null;
    for (const e of list) {
      if (!e.alive) continue; const p = e.root.position; V.subVectors(p, o); const along = V.dot(d); if (along < -3 || along > maxT + 3) continue;
      const big = e.type === 'boss' ? 7 : 2.6; if (V.lengthSq() - along * along > big * big) continue;
      for (const h of spheres(e, tmpS)) {
        V.subVectors(o, h.c); const b = V.dot(d), c = V.lengthSq() - h.r * h.r, disc = b * b - c; if (disc < 0) continue;
        const t = -b - Math.sqrt(disc); if (t < 0 || t > maxT) continue;
        if (!best || t < best.t - 0.05 || (Math.abs(t - best.t) < 0.3 && (h.name === 'head' || h.name === 'core') && best.e === e)) best = { e, t, part: h.name };
      }
    }
    return best;
  }
  // shield: does a shot from `from` hit the heavy's frontal shield?
  function shielded(e, from) { if (e.type !== 'heavy' || !e.alive) return false; V.subVectors(from, e.root.position).setY(0).normalize(); return V.dot(V2.set(Math.sin(e.root.rotation.y), 0, Math.cos(e.root.rotation.y))) > 0.42; }

  function damage(e, dmg, part, hitPoint, opts = {}) {
    if (!e.alive) return 0;
    const mult = part === 'head' ? (e.type === 'boss' ? 1.6 : 2) : part === 'core' ? 2.5 : part === 'legs' ? 0.8 : 1;
    if (e.type === 'heavy' && !opts.pierce && !opts.splash && shielded(e, opts.from || G.player.pos)) { e.shieldHit = 1; G.fx.impact(hitPoint, V.subVectors(opts.from || G.player.pos, hitPoint).normalize(), [0.4, 0.8, 1.6], 0.7); G.snd.shieldHit(); return -1; }
    const d = dmg * mult; e.hp -= d; e.flash = 1; e.active = true;
    if (e.type === 'drone') { V.set(rand(-1, 1), rand(-0.3, 0.6), rand(-1, 1)).multiplyScalar(5); e.vel.add(V); }
    if (e.type === 'walker' && e.state === 'cover' && Math.random() < 0.3) e.state = 'pick';
    if (e.hp <= 0) kill(e, opts);
    return d;
  }
  function kill(e, opts) {
    e.alive = false; e.dying = e.type === 'boss' ? 4 : e.type === 'drone' ? 1.2 : 1.4; e.deathSpin = rand(-3, 3);
    const p = V.copy(e.root.position); p.y += e.type === 'drone' ? 0 : e.type === 'boss' ? 4 : 1.3;
    G.fx.impact(p, ZF.clone().set(0, 1, 0), [1, 0.7, 0.3], 2.5); G.fx.burstGlow(p, [4, 1.2, 0.3], 14, 4, 0.22, 0.6); G.fx.debris(p, e.type === 'boss' ? 30 : 8, [0.6, 0.62, 0.66], 6, e.type === 'heavy' ? 0.2 : 0.13);
    G.fx.smokePuff(p, 4, 0.05, 0.9, 2); G.snd.kill(G.distTo(p));
    if (e.cover) { e.cover.taken = null; e.cover = null; }
    G.onKill(e, opts);
  }

  // ---------------------------------------------------------------- projectiles
  const PMAX = 140, pgeo = new THREE.SphereGeometry(1, 10, 6);
  const pm = new THREE.InstancedMesh(pgeo, new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), PMAX);
  pm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PMAX * 3), 3); pm.frustumCulled = false; pm.count = 0; pm.renderOrder = 4; G.scene.add(pm);
  const shots = [];
  const KIND = { // speed, dmg, size, color, splash
    bolt: [26, 7, 0.07, [4, 0.7, 0.25], 0], dbolt: [20, 6, 0.08, [4, 0.3, 1.4], 0], orb: [13, 22, 0.24, [1.2, 0.6, 4.5], 3], round: [44, 6, 0.06, [4, 2.6, 0.6], 0], missile: [15, 24, 0.12, [4, 1.5, 0.5], 3.8],
  };
  function fire(kind, from, to, spreadDeg, extra = {}) {
    const [sp, dm, sz, c, splash] = KIND[kind];
    V.subVectors(to, from).normalize(); const s = spreadDeg * Math.PI / 180;
    V.x += rand(-s, s); V.y += rand(-s, s) * 0.6; V.z += rand(-s, s); V.normalize();
    shots.push({ kind, p: from.clone(), v: V.clone().multiplyScalar(sp * (extra.speed || 1)), dmg: dm * G.dmgScale(), sz, c, splash, life: 4, whiz: false, target: extra.target || null, src: extra.src });
    G.fx.glow.add(from.x, from.y, from.z, 0, 0, 0, 0.08, sz * 6, c[0], c[1], c[2], 1);
    G.fx.flash(from, new THREE.Color(c[0] / 4, c[1] / 4, c[2] / 4).getHex(), 10, 0.1);
  }
  function updateShots(dt) {
    const pl = G.player.pos;
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.life -= dt;
      if (s.kind === 'missile') {
        if (s.target) { V.subVectors(s.target, s.p); const d = V.length(); V.normalize().multiplyScalar(15); s.v.lerp(V, Math.min(1, dt * (s.life < 3.3 ? 2.6 : 0.3))); }
        else s.v.y -= 2 * dt;
        if (Math.random() < 0.8) G.fx.smoke.add(s.p.x, s.p.y, s.p.z, 0, 0.2, 0, 1.0, 0.3, 0.5, 0.48, 0.46, 0.5, 1.2, -0.1, 0.5);
      }
      const step = V2.copy(s.v).multiplyScalar(dt), n = Math.ceil(step.length() / 0.5); let hit = false;
      for (let k = 0; k < n && !hit; k++) {
        s.p.addScaledVector(step, 1 / n);
        // player (capsule approx)
        const dy = Math.max(pl.y - 1.6, Math.min(pl.y + 0.1, s.p.y)) - s.p.y, dx = s.p.x - pl.x, dz = s.p.z - pl.z, d2 = dx * dx + dz * dz + dy * dy;
        if (d2 < (0.42 + s.sz) ** 2 && !G.player.dead) { hit = 'player'; break; }
        if (!s.whiz && d2 < 2.2 && s.kind !== 'missile') { s.whiz = true; G.snd.whiz(); }
        if (s.p.y < 0) { hit = 'ground'; break; }
        if (G.solidAt(s.p)) { hit = 'wall'; break; }
      }
      if (hit || s.life <= 0) {
        if (hit === 'player') G.hurtPlayer(s.dmg, s.p.clone().sub(s.v), s.kind);
        if (hit) {
          const nrm = V.copy(s.v).normalize().negate();
          if (s.splash) { G.explode(s.p, s.splash, s.dmg, { enemy: true, col: s.kind === 'orb' ? [1.2, 1.2, 4] : [3, 1.4, 0.4], scale: s.kind === 'orb' ? 0.6 : 0.7, noPlayerDirect: hit === 'player' }); }
          else { G.fx.impact(s.p, nrm, [s.c[0] / 4, s.c[1] / 4, s.c[2] / 4], 0.6); }
        }
        shots.splice(i, 1);
      }
    }
    let n = 0;
    for (const s of shots) {
      if (n >= PMAX) break; Q.setFromUnitVectors(ZF, V.copy(s.v).normalize()); const L = s.kind === 'orb' ? 1.2 : s.kind === 'missile' ? 3 : 5;
      M.compose(s.p, Q, S.set(s.sz, s.sz, s.sz * L)); pm.setMatrixAt(n, M); pm.instanceColor.setXYZ(n, s.c[0], s.c[1], s.c[2]); n++;
    }
    pm.count = n; pm.instanceMatrix.needsUpdate = true; pm.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- AI
  const muzzle = new THREE.Vector3();
  function gunPos(e, out) {
    const p = e.root.position, c = Math.cos(e.yaw), s = Math.sin(e.yaw);
    if (e.type === 'drone') return out.set(p.x + s * 0.5, p.y - 0.25, p.z + c * 0.5);
    if (e.type === 'boss') return out.set(p.x + c * 2.0 + s * 3.4, p.y + 5.2, p.z - s * 2.0 + c * 3.4);
    const k = e.type === 'heavy' ? 1.22 : 1; return out.set(p.x + c * 0.5 * k + s * 0.9 * k, p.y + (1.15 - e.crouch * 0.45) * k, p.z - s * 0.5 * k + c * 0.9 * k);
  }
  const aimAt = (out) => out.set(G.player.pos.x, G.player.pos.y - 0.35, G.player.pos.z);
  function roomOf(e) { return G.level.rooms[e.room]; }
  function clampRoom(e, p) { const R = roomOf(e); if (!R) return; p.x = Math.max(R.x0 + 0.7, Math.min(R.x1 - 0.7, p.x)); p.z = Math.min(R.z0 - 0.7, Math.max(R.z1 + 0.7, p.z)); }
  function pickSpot(e) {
    const R = roomOf(e), pl = G.player.pos, me = e.root.position;
    // flank sometimes (one flanker at a time)
    const flankers = list.filter(o => o.alive && o.flank).length;
    if (e.type === 'walker' && flankers < 1 && e.cycles > 0 && Math.random() < 0.45) {
      const fwd = G.player.yaw, side = Math.random() < 0.5 ? 1 : -1, a = fwd + side * rand(1.4, 2.0), r = rand(6, 9);
      const p = new THREE.Vector3(pl.x - Math.sin(a) * r, 0, pl.z - Math.cos(a) * r); clampRoom(e, p);
      e.goal = p; e.flank = true; e.state = 'move'; return;
    }
    e.flank = false;
    let best = null, bs = -1e9;
    for (const c of R.cover) {
      if (c.taken && c.taken !== e) continue;
      const dp = Math.hypot(c.x - pl.x, c.z - pl.z), dm = Math.hypot(c.x - me.x, c.z - me.z); if (dp < 4) continue;
      // cover object between point and player?
      const cx = (c.c.x0 + c.c.x1) / 2, cz = (c.c.z0 + c.c.z1) / 2, tx = pl.x - c.x, tz = pl.z - c.z, ox = cx - c.x, oz = cz - c.z;
      const blocks = (tx * ox + tz * oz) / (Math.hypot(tx, tz) * Math.hypot(ox, oz) + 1e-6);
      const sc = blocks * 6 - Math.abs(dp - 10) * 0.6 - dm * 0.25 + rand(0, 2);
      if (sc > bs) { bs = sc; best = c; }
    }
    if (e.cover) e.cover.taken = null;
    if (best && bs > 0) { best.taken = e; e.cover = best; e.goal = new THREE.Vector3(best.x, 0, best.z); }
    else { const a = Math.random() * TAU, p = new THREE.Vector3(pl.x + Math.sin(a) * 9, 0, pl.z + Math.cos(a) * 9); clampRoom(e, p); e.goal = p; e.cover = null; }
    e.state = 'move';
  }
  function walk(e, dt, speed) {
    const p = e.root.position; V.subVectors(e.goal, p).setY(0); const d = V.length();
    if (d < 0.35) return true;
    V.multiplyScalar(Math.min(speed * dt, d) / d); const ox = p.x, oz = p.z; p.add(V); G.collide(p, STATS[e.type].r, 0.2, 1.8); clampRoom(e, p);
    const moved = Math.hypot(p.x - ox, p.z - oz); e.walk += moved * 3.2; if (moved < speed * dt * 0.2) { e.stuck = (e.stuck || 0) + dt; if (e.stuck > 0.8) { e.stuck = 0; return true; } } else e.stuck = 0;
    return false;
  }
  function sep(e) { for (const o of list) { if (o === e || !o.alive || o.type === 'drone' || o.type === 'boss') continue; const dx = e.root.position.x - o.root.position.x, dz = e.root.position.z - o.root.position.z, d = Math.hypot(dx, dz); if (d < 1.1 && d > 0.01) { e.root.position.x += dx / d * (1.1 - d) * 0.5; e.root.position.z += dz / d * (1.1 - d) * 0.5; } } }
  function animWalker(e, dt, moving) {
    const P = e.P, k = e.type === 'heavy' ? 1.22 : 1, s = Math.sin(e.walk) * (moving ? 0.6 : 0);
    P.legL.rotation.x = s; P.legR.rotation.x = -s; P.hips.position.y = (1.08 - e.crouch * 0.45) * k + Math.abs(Math.cos(e.walk)) * (moving ? 0.05 : 0);
    P.legL.rotation.x -= e.crouch * 0.9; P.legR.rotation.x -= e.crouch * 0.9; P.hips.rotation.x = 0;
    P.torso.rotation.x = e.crouch * 0.25; P.armL.rotation.x = -1.2 + (moving ? -s * 0.4 : 0) - e.crouch * 0.2;
    // gun arm tracks the player
    const pl = G.player.pos, gp = e.root.position; const dy = (pl.y - 0.4) - (gp.y + 1.5 * k), dh = Math.hypot(pl.x - gp.x, pl.z - gp.z);
    P.armR.rotation.x = -Math.PI / 2 - Math.atan2(dy, dh) * 0.9 + e.recoil * 0.4; P.armR.rotation.z = 0;
    P.head.rotation.y = Math.sin(e.t * 0.7) * (e.active ? 0.1 : 0.5);
  }
  function tickWalker(e, dt) {
    const pl = G.player.pos, p = e.root.position, k = e.type === 'heavy';
    gunPos(e, muzzle); const los = G.los(muzzle, aimAt(V2)); const dist = Math.hypot(pl.x - p.x, pl.z - p.z);
    if (!e.active) { if ((los && dist < 22) || G.playerRoom === e.room) e.active = true; animWalker(e, dt, false); return; }
    e.t += dt; e.cool -= dt; let moving = false, faceP = true;
    if (k) { // heavy: advance and pound
      if (dist > 7.5 || !los) { e.goal = e.goal || new THREE.Vector3(); e.goal.set(pl.x, 0, pl.z); moving = !walk(e, dt, 1.7); }
      if (e.tele > 0) { e.tele -= dt; e.gm.color.setScalar(2.2 + (1 - e.tele / 0.8) * 6); if (e.tele <= 0) { fire('orb', muzzle, aimAt(V2), 1.5 / G.diff(), { src: e }); G.snd.enemyShot(dist, 2); e.recoil = 1; e.cool = rand(1.6, 2.4) / G.diff(); e.gm.color.setScalar(2.2); } }
      else if (e.cool <= 0 && los && dist < 26) { e.tele = 0.8; G.snd.telegraph(dist); }
      // turn slowly so it can be flanked
      const want = Math.atan2(pl.x - p.x, pl.z - p.z); let dy = want - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += Math.sign(dy) * Math.min(Math.abs(dy), dt * 1.3); e.root.rotation.y = e.yaw;
      e.P.shieldMat.uniforms.uTime.value += dt; e.shieldHit = Math.max(0, e.shieldHit - dt * 4); e.P.shieldMat.uniforms.uHit.value = e.shieldHit;
      e.recoil = Math.max(0, (e.recoil || 0) - dt * 4); animWalker(e, dt, moving); sep(e); return;
    }
    switch (e.state) {
      case 'idle': case 'pick': pickSpot(e); break;
      case 'move': { moving = !walk(e, dt, e.flank ? 4.6 : 3.3); e.crouch = Math.max(0, e.crouch - dt * 4);
        if (e.flank && los && e.cool <= 0 && dist < 18) { e.burst = 2; e.state = 'aim'; e.tele = 0.35; e.goalAfter = 'move'; G.snd.telegraph(dist); }
        if (!moving) { e.state = e.cover ? 'cover' : 'aim'; e.t = 0; e.hold = rand(0.6, 1.5); e.flank = false; if (!e.cover) { e.tele = 0.55; G.snd.telegraph(dist); } }
        break; }
      case 'cover': e.crouch = Math.min(1, e.crouch + dt * 4); if (e.t > e.hold) { e.state = 'peek'; e.t = 0; } break;
      case 'peek': e.crouch = Math.max(0, e.crouch - dt * 5);
        if (e.crouch <= 0.05) { gunPos(e, muzzle); if (G.los(muzzle, aimAt(V2))) { e.state = 'aim'; e.tele = 0.55; G.snd.telegraph(dist); } else if (e.t > 0.8) { e.state = 'pick'; e.cycles++; } }
        break;
      case 'aim': e.tele -= dt; e.gm.color.setScalar(2.2 + 5 * (1 - Math.max(0, e.tele) / 0.55));
        // laser sight telegraph
        if (Math.random() < 0.7) G.fx.tracer(muzzle, V.copy(aimAt(V2)).lerp(muzzle, 0.05), [1.6, 0.12, 0.08], 0.008, 0.05);
        if (e.tele <= 0) { e.state = 'fire'; e.burst = e.burst || 3; e.shotT = 0; e.gm.color.setScalar(2.2); }
        if (e.goalAfter === 'move') moving = !walk(e, dt, 2.2);
        break;
      case 'fire': e.shotT -= dt; if (e.goalAfter === 'move') moving = !walk(e, dt, 2.2);
        if (e.shotT <= 0) { gunPos(e, muzzle); const spread = (2.2 + dist * 0.12 + G.player.speed * 0.5) / G.diff(); fire('bolt', muzzle, aimAt(V2), spread, { src: e }); G.snd.enemyShot(dist, 0); e.recoil = 1; e.burst--; e.shotT = 0.16; if (e.burst <= 0) { e.cycles++; e.goalAfter = null; e.state = e.cover && Math.random() < 0.75 ? 'cover' : 'pick'; e.t = 0; e.hold = rand(0.8, 1.8) / G.diff(); e.cool = rand(0.6, 1.4); } }
        break;
    }
    // face player (torso), legs follow
    if (faceP) { const want = Math.atan2(pl.x - p.x, pl.z - p.z); let dy = want - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += dy * Math.min(1, dt * 8); e.root.rotation.y = e.yaw; }
    e.recoil = Math.max(0, (e.recoil || 0) - dt * 6); animWalker(e, dt, moving); sep(e);
  }
  function tickDrone(e, dt) {
    const pl = G.player.pos, p = e.root.position; e.t += dt; e.phase += dt;
    const dist = p.distanceTo(pl); gunPos(e, muzzle); const los = G.los(muzzle, aimAt(V2));
    e.P.rotor.rotation.y += dt * 30; e.P.body.rotation.z = Math.sin(e.t * 2) * 0.1 - e.vel.x * 0.03;
    if (!e.active) { p.y = e.alt + Math.sin(e.t * 2) * 0.15; if ((los && dist < 22) || G.playerRoom === e.room) e.active = true; return; }
    // orbit the player
    const a = Math.atan2(p.x - pl.x, p.z - pl.z) + e.orbit * dt * 0.5, r = 7.5 + Math.sin(e.phase * 0.7) * 2;
    V.set(pl.x + Math.sin(a) * r, e.alt + Math.sin(e.phase * 1.3) * 0.6, pl.z + Math.cos(a) * r); clampRoom(e, V);
    V.sub(p).multiplyScalar(1.6); e.vel.lerp(V, Math.min(1, dt * 1.8)); p.addScaledVector(e.vel, dt); e.vel.multiplyScalar(1 - dt * 0.6);
    G.collide(p, 0.6, p.y - 0.4, p.y + 0.4); clampRoom(e, p); if (Math.random() < dt * 0.2) e.orbit *= -1;
    const want = Math.atan2(pl.x - p.x, pl.z - p.z); let dy = want - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += dy * Math.min(1, dt * 6); e.root.rotation.y = e.yaw;
    e.cool -= dt;
    if (e.tele > 0) { e.tele -= dt; e.gm.color.setScalar(2.2 + (1 - e.tele / 0.45) * 7); if (e.tele <= 0) { fire('dbolt', muzzle, aimAt(V2), (2.5 + dist * 0.1) / G.diff(), { src: e }); G.snd.enemyShot(dist, 1); e.cool = rand(1.4, 2.4) / G.diff(); e.gm.color.setScalar(2.2); } }
    else if (e.cool <= 0 && los && dist < 24) { e.tele = 0.45; G.snd.telegraph(dist); }
  }
  function tickBoss(e, dt) {
    const pl = G.player.pos, p = e.root.position, P = e.P; e.t += dt;
    if (!e.active) { if (G.playerRoom === e.room) e.active = true; return; }
    const dist = Math.hypot(pl.x - p.x, pl.z - p.z);
    // walk to keep ~13 m
    let moving = false;
    if (e.attack !== 2 && (dist > 15 || dist < 9)) { const a = Math.atan2(p.x - pl.x, p.z - pl.z); e.goal = e.goal || new THREE.Vector3(); e.goal.set(pl.x + Math.sin(a) * 12.5, 0, pl.z + Math.cos(a) * 12.5); clampRoom(e, e.goal); moving = !walk(e, dt, 2.0); }
    const want = Math.atan2(pl.x - p.x, pl.z - p.z); let dy = want - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += Math.sign(dy) * Math.min(Math.abs(dy), dt * 0.9); e.root.rotation.y = e.yaw;
    const s = Math.sin(e.walk * 0.5) * (moving ? 0.35 : 0); P.legL.rotation.x = s; P.legR.rotation.x = -s; P.hips.position.y = 3.6 + Math.abs(Math.cos(e.walk * 0.5)) * (moving ? 0.15 : 0);
    if (moving && Math.abs(Math.cos(e.walk * 0.5)) < 0.06 && !e.stepped) { e.stepped = 1; G.shake(0.25); G.snd.land(); } if (Math.abs(Math.cos(e.walk * 0.5)) > 0.3) e.stepped = 0;
    P.torso.rotation.y = 0; P.gun.rotation.z += dt * e.spin; e.spin = Math.max(0, e.spin - dt * 6);
    // phase drones
    const frac = e.hp / e.max; if ((frac < 0.66 && e.stage === 0) || (frac < 0.33 && e.stage === 1)) { e.stage++; for (const sx of [-6, 6]) spawn('drone', p.x + sx, p.z, e.room, { warp: true }); G.say('WARDEN: DEPLOYING SENTRIES', '#ff5a3a'); }
    e.cool -= dt;
    if (e.attack === 0 && e.cool <= 0) { e.attack = Math.random() < 0.55 ? 1 : 2; e.at = 0; if (e.attack === 1) { G.snd.telegraph(4); G.say('CANNON SPINNING UP', '#ffb020'); } else { G.say('MISSILE LOCK', '#ff3a2a'); } }
    if (e.attack === 1) { // rotary cannon: spin-up telegraph then a sweeping burst
      e.at += dt; e.spin = Math.min(30, e.spin + dt * 40);
      if (e.at > 1.1) { e.fireT = (e.fireT || 0) - dt; if (e.fireT <= 0) { e.fireT = 0.09; gunPos(e, muzzle); const lag = V2.set(pl.x, pl.y - 0.4, pl.z); fire('round', muzzle, lag, (3.2 + Math.sin(e.at * 5) * 2.5) / G.diff(), { src: e }); G.snd.enemyShot(dist * 0.6, 0); G.fx.glow.add(muzzle.x, muzzle.y, muzzle.z, 0, 0, 0, 0.06, 1.2, 4, 2.5, 0.8, 1); } }
      if (e.at > 3.3) { e.attack = 0; e.cool = rand(1.6, 2.4); }
    } else if (e.attack === 2) { // missiles: telegraphed impact rings around the player
      e.at += dt;
      if (!e.launched && e.at > 0.6) { e.launched = true; for (let i = 0; i < 6; i++) { const a = rand(0, TAU), r = i === 0 ? 0 : rand(1.5, 5); const tgt = new THREE.Vector3(pl.x + Math.cos(a) * r, 0.1, pl.z + Math.sin(a) * r); G.marker(tgt, 3.8, 2.4);
        setTimeout(() => { if (!e.alive || !G.running()) return; const from = V.set(p.x - 2.2 * Math.cos(e.yaw), 6.6, p.z + 2.2 * Math.sin(e.yaw)).clone(); fire('missile', from, V2.set(from.x, from.y + 10, from.z), 8, { target: tgt, src: e }); G.snd.missile(dist); }, i * 140); } }
      if (e.at > 2.6) { e.attack = 0; e.launched = false; e.cool = rand(1.4, 2.2); }
    }
    // stomp when the player gets close
    if (dist < 6.5 && e.attack === 0 && e.cool < 1) { e.attack = 3; e.at = 0; G.say('STOMP!', '#ffb020'); }
    if (e.attack === 3) { e.at += dt; P.hips.position.y = 3.6 + Math.sin(Math.min(1, e.at / 0.9) * Math.PI) * 1.1; if (e.at > 0.9 && !e.stomped) { e.stomped = 1; G.explode(V.set(p.x, 0.2, p.z), 8, 30, { enemy: true, scale: 1.3, col: [3, 2, 1] }); G.shake(0.8); }
      if (e.at > 1.5) { e.attack = 0; e.stomped = 0; e.cool = 1.5; } }
  }
  function tickDying(e, dt) {
    e.dying -= dt; const p = e.root.position;
    if (e.type === 'drone') { e.vel.y -= 14 * dt; p.addScaledVector(e.vel, dt); e.root.rotation.z += e.deathSpin * dt * 3; if (p.y < 0.4) { p.y = 0.4; if (!e.boomed) { e.boomed = 1; G.explode(p.clone(), 2.2, 20, { scale: 0.6, chain: true }); e.dying = Math.min(e.dying, 0.05); } } if (Math.random() < 0.6) G.fx.smoke.add(p.x, p.y, p.z, 0, 0.5, 0, 1, 0.3, 0.08, 0.08, 0.08, 0.6, 1, -0.2, 0.3); }
    else if (e.type === 'boss') { e.root.rotation.x = Math.min(0.5, e.root.rotation.x + dt * 0.12); if (Math.random() < dt * 6) { V.set(p.x + rand(-2, 2), rand(2, 6), p.z + rand(-2, 2)); G.explode(V.clone(), 3, 0, { scale: 0.8 }); } if (e.dying <= 0.05) G.explode(V.set(p.x, 4, p.z).clone(), 6, 0, { scale: 2.2 }); }
    else { const k = Math.min(1, (1.4 - e.dying) / 0.5); e.root.rotation.x = -k * 1.45 * (e.deathSpin > 0 ? 1 : -1) * 0.95; e.P.hips.position.y = Math.max(0.3, e.P.hips.position.y - dt * 2); if (Math.random() < 0.3) { V.set(p.x, 0.8, p.z); G.fx.impact(V, ZF.clone().set(0, 1, 0), [1, 0.6, 0.2], 0.5); } }
    if (e.dying <= 0) { e.dying = 0; e.boomed = 0; e.root.visible = false; const i = list.indexOf(e); if (i >= 0) list.splice(i, 1); if (e.type !== 'drone' && e.type !== 'boss') { V.set(p.x, 0.9, p.z); G.fx.smokePuff(V, 4, 0.06, 0.8, 1.5); G.fx.burstGlow(V, [3, 1, 0.2], 6, 2, 0.2, 0.4); } }
  }

  return {
    list, spawn, ray, damage, shielded, spheres, fire, shots,
    count: () => list.filter(e => e.alive).length,
    alive: (room) => list.filter(e => e.alive && (room == null || e.room === room)),
    boss: () => list.find(e => e.type === 'boss' && (e.alive || e.dying)),
    clear() { for (const e of list) { e.alive = false; e.dying = 0; e.root.visible = false; if (e.cover) e.cover.taken = null; } list.length = 0; shots.length = 0; pm.count = 0; },
    update(dt) {
      for (const e of [...list]) {
        if (e.dying) { tickDying(e, dt); continue; }
        if (!e.alive) continue;
        if (e.warp > 0) { e.warp -= dt; e.root.scale.setScalar(1 - Math.max(0, e.warp) / 0.6 * 0.9); if (e.warp <= 0) e.root.scale.setScalar(1); }
        if (e.type === 'drone') tickDrone(e, dt); else if (e.type === 'boss') tickBoss(e, dt); else tickWalker(e, dt);
        e.flash = Math.max(0, e.flash - dt * 8); e.bm.emissive.setRGB(e.flash * 1.2, e.flash * 0.6, e.flash * 0.3);
      }
      updateShots(dt);
    },
  };
}
