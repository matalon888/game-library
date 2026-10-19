// Hivefall bugs: instanced arachnid rigs whose legs walk in the vertex shader (tripod gait driven by a per-instance
// phase), with chitin vertex colours, glowing bio-luminescent sacs, hit flash, attack glow and a death curl.
// One draw call per bug type (+ one per type for shadows). AI: flanking swarms, ranged spitters that lob acid,
// armoured chargers that telegraph a rush, and a tunnelling queen.
import { THREE } from './kit/cine.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { ground, COL, RING } from './world.js';
import { ramp, INK } from './style.js';

const V3 = THREE.Vector3;
// ------------------------------------------------------------------ geometry
function tagged(g, { color = '#3a2a24', glow = 0, leg = null }) {
  g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  const n = g.attributes.position.count, c = new THREE.Color(color), col = new Float32Array(n * 3), gl = new Float32Array(n), lg = new Float32Array(n * 4), lw = new Float32Array(n);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; gl[i] = glow; if (leg) { lg.set(leg, i * 4); lw[i] = 1; } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); g.setAttribute('aLeg', new THREE.BufferAttribute(lg, 4)); g.setAttribute('aLegW', new THREE.BufferAttribute(lw, 1));
  return g;
}
function ell(rx, ry, rz, x, y, z, ws = 18, hs = 12) { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); g.translate(x, y, z); return g; }
function seg(a, b, r1, r2, s = 7) { const d = new V3().subVectors(b, a), L = d.length(); const g = new THREE.CylinderGeometry(r2, r1, L, s, 2); g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); return g; }
function cone(r, h, x, y, z, rx, ry, rz) { const g = new THREE.ConeGeometry(r, h, 7); g.translate(0, h / 2, 0); g.rotateX(rx); g.rotateY(ry || 0); g.rotateZ(rz || 0); g.translate(x, y, z); return g; }

function buildBug(o) {
  const P = [], dark = o.dark, mid = o.mid, light = o.light, glowC = o.glow;
  const hT = o.hT;
  P.push(tagged(ell(0.34, 0.28, 0.46, 0, hT, 0.12), { color: mid }));                        // thorax
  for (let i = 0; i < 3; i++) P.push(tagged(ell(0.36 - i * 0.03, 0.12, 0.2, 0, hT + 0.2, 0.36 - i * 0.24, 12, 6), { color: light }));   // dorsal plates
  const A = o.abd; P.push(tagged(ell(A[0], A[1], A[2], 0, hT + A[3], -0.35 - A[2] * 0.75), { color: o.sac ? o.glow : dark, glow: o.sac ? 0.35 : 0 }));
  for (let i = 0; i < 4; i++) { const z = -0.35 - A[2] * 0.75 + (i - 1.5) * A[2] * 0.42, k = Math.sqrt(Math.max(0.05, 1 - Math.pow((i - 1.5) * 0.42, 2))); const t = new THREE.TorusGeometry(1, 0.08, 6, 20); t.scale(A[0] * k * 1.02, A[1] * k * 1.02, 1); t.translate(0, hT + A[3], z); P.push(tagged(t, { color: light })); }
  // belly glow spots
  for (let i = 0; i < 3; i++) P.push(tagged(ell(0.09 * A[0] * 2.5, 0.05, 0.12, (i - 1) * A[0] * 0.45, hT + A[3] - A[1] * 0.82, -0.35 - A[2] * 0.75, 8, 6), { color: glowC, glow: 1 }));
  if (o.sac) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.push(tagged(ell(0.16, 0.16, 0.2, Math.cos(a) * A[0] * 0.8, hT + A[3] + Math.sin(a) * A[1] * 0.8, -0.35 - A[2] * 1.1, 10, 8), { color: glowC, glow: 1 })); }
  // head + mandibles + eyes
  const hz = 0.62 + (o.headZ || 0);
  P.push(tagged(ell(0.3, 0.27, 0.32, 0, hT, hz), { color: mid }));
  for (const s of [-1, 1]) {
    P.push(tagged(cone(0.07, 0.42 * o.mand, s * 0.12, hT - 0.12, hz + 0.18, 1.35, 0, s * 0.35), { color: light }));
    P.push(tagged(cone(0.045, 0.3 * o.mand, s * 0.2, hT - 0.06, hz + 0.1, 1.2, 0, s * 0.9), { color: dark }));
    P.push(tagged(ell(0.11, 0.12, 0.09, s * 0.12, hT + 0.12, hz + 0.2, 12, 10), { color: '#ffffff' }));          // big cartoon eyes
    P.push(tagged(ell(0.055, 0.065, 0.04, s * 0.13, hT + 0.12, hz + 0.28, 10, 8), { color: '#1a1030' }));
    P.push(tagged(ell(0.018, 0.018, 0.01, s * 0.11, hT + 0.15, hz + 0.315, 6, 4), { color: '#ffffff', glow: 0.6 }));
  }
  if (o.armor) {   // charger: a huge frontal shield + horns
    P.push(tagged(ell(0.78, 0.5, 0.62, 0, hT + 0.18, hz - 0.05, 22, 12), { color: o.armorCol }));
    for (let i = 0; i < 4; i++) P.push(tagged(ell(0.8 - i * 0.05, 0.08, 0.2, 0, hT + 0.5 - i * 0.02, hz - 0.35 - i * 0.22, 14, 6), { color: o.armorCol }));
    for (const s of [-1, 1]) { P.push(tagged(cone(0.12, 0.8, s * 0.42, hT + 0.4, hz + 0.25, 0.9, 0, -s * 0.5), { color: o.hornCol || '#fff3c4' })); P.push(tagged(cone(0.08, 0.5, s * 0.6, hT + 0.15, hz + 0.3, 1.2, 0, -s * 0.9), { color: o.hornCol || '#fff3c4' })); }
  }
  if (o.crown) for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.3; P.push(tagged(cone(0.06, 0.55 + (3 - Math.abs(i - 3)) * 0.12, Math.sin(a) * 0.25, hT + 0.16, hz - 0.1 + Math.cos(a) * 0.05, -0.5, 0, -a * 1.2), { color: '#ffd23f' })); }
  // dorsal spikes
  for (let i = 0; i < (o.spikes || 4); i++) P.push(tagged(cone(0.05, 0.28 + i * 0.03, 0, hT + 0.26 + (i > 1 ? A[3] * 0.8 : 0), 0.35 - i * 0.35, -0.5, 0, 0), { color: light }));
  // legs: hips on the thorax, knees high, feet wide (tripod gait phases)
  const pairs = o.pairs || 3;
  for (let i = 0; i < pairs; i++) for (const s of [-1, 1]) {
    const fz = pairs === 3 ? [1, 0, -1][i] : [1, 0.35, -0.35, -1][i];
    const hip = new V3(s * 0.26, hT - 0.02, 0.32 - i * (0.42 / (pairs - 1)) * 1.1);
    const knee = new V3(s * 0.8 * o.leg, hT + 0.5 * o.leg, hip.z + fz * 0.38 * o.leg);
    const foot = new V3(s * 1.25 * o.leg, 0.0, hip.z + fz * 0.75 * o.leg);
    const phase = ((i % 2 === 0) === (s > 0) ? 0 : Math.PI) + i * 0.15;
    const L = [hip.x, hip.y, hip.z, phase];
    P.push(tagged(seg(hip, knee, 0.075 * o.legT, 0.06 * o.legT), { color: mid, leg: L }));
    P.push(tagged(ell(0.08 * o.legT, 0.08 * o.legT, 0.08 * o.legT, knee.x, knee.y, knee.z, 8, 6), { color: light, leg: L }));
    P.push(tagged(seg(knee, foot, 0.06 * o.legT, 0.012, 6), { color: dark, leg: L }));
    if (o.armor) P.push(tagged(cone(0.05, 0.25, knee.x, knee.y, knee.z, -0.3, 0, -s * 0.6), { color: o.hornCol || '#fff3c4', leg: L }));
  }
  const g = mergeGeometries(P); g.scale(o.scale, o.scale, o.scale); g.computeBoundingSphere(); return g;
}

// ------------------------------------------------------------------ shader patch (legs walk on the GPU)
const HEAD = `attribute vec4 aLeg; attribute float aLegW; attribute float aGlow; attribute vec4 aInst; varying float vGlow; varying vec4 vInst; uniform float uLegScale;
mat3 bugRotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
float bugSwing(){ float ph = aInst.x + aLeg.w; return sin(ph) * .42 * (1. - aInst.w) * sign(aLeg.x) + sin(aInst.x * 7.0 + aLeg.w * 3.) * aInst.w * .25; }
vec3 bugDeform(vec3 p){
  if (aLegW < .5) { p.y += sin(aInst.x * 2.) * .025 * uLegScale * (1. - aInst.w); return p; }
  float ph = aInst.x + aLeg.w; vec3 piv = aLeg.xyz * uLegScale; vec3 q = p - piv;
  q = bugRotY(bugSwing()) * q;
  float reach = length(q.xz);
  q.y += (max(0., cos(ph)) * .22 * (1. - aInst.w) + aInst.w * .9) * reach;
  q.x *= 1. - aInst.w * .4;
  return piv + q;
}`;
function patch(mat, U, glowCol, isDepth, olw = 0) {
  mat.onBeforeCompile = (sh) => {
    if (isDepth === 'outline') { sh.uniforms.uLegScale = U.legScale; sh.vertexShader = HEAD + '\nuniform float uOW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vec3 nn = aLegW > .5 ? bugRotY(bugSwing()) * normal : normal; transformed = bugDeform(transformed) + normalize(nn) * uOW; vGlow = aGlow; vInst = aInst;'); sh.uniforms.uOW = { value: olw }; return; }
    sh.uniforms.uLegScale = U.legScale; sh.uniforms.uGlowCol = { value: new THREE.Color(glowCol) }; sh.uniforms.uTime = U.time;
    sh.vertexShader = HEAD + '\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n if (aLegW > .5) objectNormal = bugRotY(bugSwing()) * objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed = bugDeform(transformed); vGlow = aGlow; vInst = aInst;');
    if (!isDepth) sh.fragmentShader = 'varying float vGlow; varying vec4 vInst; uniform vec3 uGlowCol; uniform float uTime;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float pulse = .75 + .25 * sin(uTime * 4. + vInst.x * .3);
      totalEmissiveRadiance += uGlowCol * vGlow * (1.6 * pulse + vInst.z * 7.) * (1. - vInst.w * .85) + vec3(.5, .5, .45) * vInst.y * .6;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.), vInst.y * .15);`);
  };
  mat.customProgramCacheKey = () => 'bug' + (isDepth ? isDepth + olw : '') + glowCol;
}

export const TYPES = {
  runner: { pool: 340, hp: 34, speed: 7.6, r: 1.0, cy: 0.85, dmg: 5, score: 25, spec: { dark: '#1f7a4a', mid: '#3fd46b', light: '#ffe36b', glow: '#c6ff5a', hT: 0.62, abd: [0.42, 0.34, 0.6, 0.1], mand: 0.8, leg: 1, legT: 1.7, scale: 1.75 } },
  spitter: { pool: 48, hp: 90, speed: 5.2, r: 1.35, cy: 1.25, dmg: 12, score: 70, spec: { dark: '#4a2a8a', mid: '#8a5cff', light: '#ffb3f0', glow: '#ff5fd2', hT: 0.75, abd: [0.66, 0.6, 0.85, 0.35], mand: 0.6, leg: 1.05, legT: 1.7, scale: 2.0, sac: true } },
  charger: { pool: 26, hp: 330, speed: 4.6, r: 2.1, cy: 1.5, dmg: 28, score: 180, spec: { dark: '#a8361f', mid: '#ff6a3a', light: '#ffd23f', glow: '#ffe14a', armorCol: '#ffb02e', hornCol: '#fff3c4', hT: 0.6, abd: [0.5, 0.42, 0.62, 0.15], mand: 1.2, leg: 0.85, legT: 2.2, scale: 3.0, armor: true, headZ: 0.05 } },
  queen: { pool: 1, hp: 5000, speed: 3.2, r: 4.4, cy: 3.4, dmg: 30, score: 6000, spec: { dark: '#5a1a6a', mid: '#d14bd6', light: '#ffd23f', glow: '#ff7be8', hT: 0.8, abd: [0.9, 0.75, 1.5, 0.45], mand: 1.4, leg: 1.25, legT: 1.8, scale: 5.4, sac: true, crown: true, pairs: 4, spikes: 6 } },
};

export class Swarm {
  constructor(scene, G) {
    this.G = G; this.U = { time: { value: 0 }, legScale: { value: 1 } }; this.meshes = {}; this.pools = {}; this.all = [];
    for (const [k, T] of Object.entries(TYPES)) {
      const geo = buildBug(T.spec); const n = T.pool;
      const inst = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); inst.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aInst', inst);
      const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
      const U = { time: this.U.time, legScale: { value: T.spec.scale } };
      patch(mat, U, T.spec.glow, false);
      const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); patch(dm, U, '#000', true);
      const m = new THREE.InstancedMesh(geo, mat, n); m.customDepthMaterial = dm; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const om = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }); patch(om, U, '#000', 'outline', k === 'queen' ? 0.06 : 0.035 * T.spec.scale / 1.3);
      const ol = new THREE.InstancedMesh(geo, om, n); ol.instanceMatrix = m.instanceMatrix; ol.frustumCulled = false; ol.count = 0; scene.add(ol);
      scene.add(m); this.meshes[k] = { mesh: m, inst, ol };
      this.pools[k] = [];
    }
    // acid globs (instanced glowing spheres)
    this.globs = []; this.globMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 12, 8), new THREE.MeshStandardMaterial({ color: '#2a5a14', emissive: '#9aff4a', emissiveIntensity: 5, roughness: 0.2 }), 60);
    this.globMesh.count = 0; this.globMesh.frustumCulled = false; scene.add(this.globMesh);
    this.grid = new Map(); this.o = new THREE.Object3D(); this.kills = 0; this.chit = 0;
  }
  get alive() { return this.all.filter(b => !b.dead); }
  count(type) { let n = 0; for (const b of this.all) if (!b.dead && (!type || b.type === type)) n++; return n; }
  clear() { this.all.length = 0; this.globs.length = 0; for (const k in this.pools) this.pools[k].length = 0; }
  spawn(type, x, z, o = {}) {
    const T = TYPES[type]; if (this.all.filter(b => b.type === type).length >= T.pool) return null;
    const fk = o.hpK || 1;
    const b = { type, T, x, z, y: ground(x, z) - (o.emerge ? T.r * 1.6 : 0), vx: 0, vz: 0, yaw: Math.atan2(-x, -z), pitch: 0, roll: 0, hp: T.hp * fk, max: T.hp * fk, phase: Math.random() * 10, flash: 0, charge: 0,
      dead: false, dieT: 0, state: o.emerge ? 'emerge' : 'move', t: o.emerge ? 1.0 : 0, cd: 1 + Math.random() * 2, flank: (Math.random() - 0.5) * 2, target: o.target || 'player', spd: T.speed * (0.85 + Math.random() * 0.3) * (o.spdK || 1), atk: 0, stun: 0, seen: 0, id: Math.random() };
    if (o.emerge) this.G.dirt(new V3(x, ground(x, z), z), T.r);
    this.all.push(b); return b;
  }
  // ray vs bug spheres: returns nearest hit (also used by the bot for line-of-fire)
  raycast(o, d, max) {
    let best = null, bd = max;
    for (const b of this.all) { if (b.dead || b.state === 'tunnel') continue; const r = b.T.r * (b.type === 'queen' ? 1 : 1.05);
      const cx = b.x - o.x, cy = b.y + b.T.cy - o.y, cz = b.z - o.z, t = cx * d.x + cy * d.y + cz * d.z; if (t < 0 || t > bd + r) continue;
      const px = cx - d.x * t, py = cy - d.y * t, pz = cz - d.z * t, dd = px * px + py * py + pz * pz; if (dd > r * r) continue;
      const th = t - Math.sqrt(r * r - dd); if (th < bd) { bd = th; best = b; } }
    return best ? { bug: best, dist: bd, point: new V3(o.x + d.x * bd, o.y + d.y * bd, o.z + d.z * bd) } : null;
  }
  // damage with armour: chargers shrug off frontal fire (sparks), take extra from behind
  damage(b, amt, kind = 'bullet', from = null) {
    if (b.dead) return false; let mult = 1, armored = false;
    if (b.type === 'charger' && from && kind !== 'flame' && kind !== 'blast') { const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), dx = from.x - b.x, dz = from.z - b.z, L = Math.hypot(dx, dz) || 1; const dot = (fx * dx + fz * dz) / L; if (dot > 0.35) { mult = 0.3; armored = true; } else if (dot < -0.3) mult = 1.6; if (b.stun > 0) mult *= 2; }
    if (b.type === 'queen' && b.state === 'tunnel') return false;
    b.hp -= amt * mult; b.flash = 1;
    if (b.hp <= 0) { this.kill(b, kind); return true; }
    return armored ? 'armor' : false;
  }
  kill(b, kind) {
    b.dead = true; b.dieT = 0; b.state = 'dead'; this.kills++;
    const p = new V3(b.x, b.y + b.T.cy, b.z); this.G.gooBurst(p, b.T.r, kind, b.type); this.G.onKill(b);
  }
  forRadius(x, z, r, fn) { for (const b of this.all) if (!b.dead && Math.hypot(b.x - x, b.z - z) < r + b.T.r) fn(b, Math.hypot(b.x - x, b.z - z)); }
  nearest(x, z, filter) { let best = null, bd = 1e9; for (const b of this.all) { if (b.dead || b.state === 'tunnel' || (filter && !filter(b))) continue; const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } } return best; }

  update(dt, ctx) {
    this.U.time.value += dt;
    const P = ctx.player, grid = this.grid; grid.clear();
    for (const b of this.all) if (!b.dead) { const k = ((b.x / 3) | 0) * 1000 + ((b.z / 3) | 0); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(b); }
    let near = 0;
    for (let i = this.all.length - 1; i >= 0; i--) {
      const b = this.all[i], T = b.T;
      b.flash = Math.max(0, b.flash - dt * 7);
      if (b.dead) { b.dieT += dt; b.roll = Math.min(Math.PI * 0.95, b.roll + dt * 9); b.charge = 0; if (b.dieT > 2.2) b.y -= dt * 0.9; if (b.dieT > 3.4) this.all.splice(i, 1); continue; }
      // ----- target selection
      let tx = P.x, tz = P.z, toUplink = false;
      if (b.target === 'uplink' && Math.hypot(P.x - b.x, P.z - b.z) > 9) { tx = 0; tz = 0; toUplink = true; }
      const dx = tx - b.x, dz = tz - b.z, dist = Math.hypot(dx, dz) || 0.001, dirx = dx / dist, dirz = dz / dist;
      const dP = Math.hypot(P.x - b.x, P.z - b.z); if (dP < 30) near += T.r;
      let want = 0, mx = 0, mz = 0;
      if (b.type === 'queen') { this.queen(b, dt, ctx, dP); this.place(b); continue; }
      if (b.state === 'emerge') { b.t -= dt; b.y += (ground(b.x, b.z) - b.y) * Math.min(1, dt * 5); b.phase += dt * 14; if (b.t <= 0) b.state = 'move'; this.place(b); continue; }
      b.cd -= dt; b.stun = Math.max(0, b.stun - dt);
      if (b.stun > 0) { b.charge = 0; b.phase += dt * 3; this.place(b); continue; }
      // ----- behaviour per type
      if (b.type === 'runner') {
        const stopR = toUplink ? 4.6 : 3.3;
        if (b.state === 'attack') { b.atk += dt; b.pitch = -Math.sin(Math.min(1, b.atk / 0.35) * Math.PI) * 0.55; if (b.atk > 0.3 && !b.hit) { b.hit = true; if (toUplink ? dist < 6 : dP < 4.2) toUplink ? ctx.hurtUplink(T.dmg * 0.5) : ctx.hurtPlayer(T.dmg, b); } if (b.atk > 0.55) { b.state = 'move'; b.cd = 0.7 + Math.random() * 0.5; } }
        else if (dist < stopR + 0.3 && b.cd <= 0) { b.state = 'attack'; b.atk = 0; b.hit = false; }
        else if (dist > stopR) { want = b.spd * (dist < 8 && !toUplink ? 1.25 : 1); mx = dirx; mz = dirz; }
      } else if (b.type === 'spitter') {
        const dPl = dP; const pdx = (P.x - b.x) / (dPl || 1), pdz = (P.z - b.z) / (dPl || 1);
        if (b.state === 'aim') { b.charge = Math.min(1, b.charge + dt * 1.1); b.yaw = turn(b.yaw, Math.atan2(pdx, pdz), dt * 6); b.pitch = -b.charge * 0.35;
          if (b.charge >= 1) { b.state = 'move'; b.charge = 0; b.pitch = 0; b.cd = (3.2 + Math.random() * 2) / (ctx.aggro || 1); this.lob(b, P, ctx); } }
        else {
          if (dPl > 24 || toUplink && dist > 18) { want = b.spd; mx = toUplink ? dirx : pdx; mz = toUplink ? dirz : pdz; }
          else if (dPl < 13) { want = b.spd * 0.8; mx = -pdx; mz = -pdz; }
          else { want = b.spd * 0.55; mx = -pdz * Math.sign(b.flank || 1); mz = pdx * Math.sign(b.flank || 1); }
          if (b.cd <= 0 && dPl < 34) { b.state = 'aim'; b.charge = 0; ctx.sfx('spit', dPl); }
        }
      } else if (b.type === 'charger') {
        const pdx = (P.x - b.x) / (dP || 1), pdz = (P.z - b.z) / (dP || 1);
        if (b.state === 'tell') { b.t -= dt; b.charge = Math.min(1, b.charge + dt * 1.2); b.pitch = -Math.sin(Math.min(1, (1.1 - b.t) / 0.5) * Math.PI * 0.5) * 0.35; b.yaw = turn(b.yaw, Math.atan2(pdx, pdz), dt * 5);
          if (b.t <= 0) { b.state = 'rush'; b.t = 1.7; b.rx = Math.sin(b.yaw); b.rz = Math.cos(b.yaw); b.pitch = 0.12; b.hit = false; } }
        else if (b.state === 'rush') { b.t -= dt; want = 21; mx = b.rx; mz = b.rz; b.charge = 1;
          if (!b.hit && dP < 4.6) { b.hit = true; ctx.hurtPlayer(T.dmg, b, 14); }
          if (b.t <= 0) { b.state = 'move'; b.cd = 3 + Math.random() * 2; b.charge = 0; b.pitch = 0; } }
        else { want = b.spd; mx = dirx; mz = dirz; b.charge = Math.max(0, b.charge - dt);
          if (b.cd <= 0 && dP < 24 && dP > 6) { b.state = 'tell'; b.t = 1.1; ctx.sfx('screech', dP); }
          if (toUplink && dist < 6.5 && b.cd <= 0) { ctx.hurtUplink(T.dmg * 0.6); b.cd = 1.4; b.pitch = -0.3; } }
      }
      // ----- steering: flank arcs + separation
      if (want > 0) {
        if (b.state !== 'rush') { const fa = b.flank * 0.85 * Math.max(0, Math.min(1, (dist - 7) / 30)); const c = Math.cos(fa), s = Math.sin(fa); const rx = mx * c - mz * s, rz = mx * s + mz * c; mx = rx; mz = rz; }
        let sxp = 0, szp = 0; const gx = (b.x / 3) | 0, gz = (b.z / 3) | 0;
        for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) { const c = grid.get((gx + ox) * 1000 + gz + oz); if (!c) continue;
          for (const o of c) { if (o === b) continue; const ex = b.x - o.x, ez = b.z - o.z, d2 = ex * ex + ez * ez, rr = (T.r + o.T.r) * 0.9; if (d2 < rr * rr && d2 > 1e-4) { const d = Math.sqrt(d2), f = (rr - d) / rr; sxp += ex / d * f; szp += ez / d * f; } } }
        mx += sxp * 1.6; mz += szp * 1.6; const L = Math.hypot(mx, mz) || 1; mx /= L; mz /= L;
        if (b.state !== 'rush') b.yaw = turn(b.yaw, Math.atan2(mx, mz), dt * 7);
      }
      const ax = Math.sin(b.yaw) * want, az = Math.cos(b.yaw) * want;
      b.vx += ((b.state === 'rush' ? mx * want : ax) - b.vx) * Math.min(1, dt * 6); b.vz += ((b.state === 'rush' ? mz * want : az) - b.vz) * Math.min(1, dt * 6);
      b.x += b.vx * dt; b.z += b.vz * dt;
      // obstacles: spires/boulders/modules/mast push bugs out (a rushing charger slams and is stunned)
      { const ex = b.x - P.x, ez = b.z - P.z, d = Math.hypot(ex, ez), m = b.T.r * 2.1 + 1.0; if (d < m && d > 0.01 && b.state !== 'rush') { b.x = P.x + ex / d * m; b.z = P.z + ez / d * m; } }
      const hitObs = this.collide(b);
      if (hitObs && b.state === 'rush') { b.state = 'move'; b.stun = 2.2; b.t = 0; b.charge = 0; ctx.slam(b); }
      const sp = Math.hypot(b.vx, b.vz); b.phase += dt * sp * (b.type === 'charger' ? 1.4 : 2.3);
      this.place(b);
      if (b.type === 'runner' && Math.random() < dt * 0.05 && dP < 25) { this.chit++; if (this.chit % 3 === 0) ctx.sfx('chitter', dP); }
    }
    this.nearMass = near;
    this.updateGlobs(dt, ctx);
    this.upload();
  }
  collide(b) {
    let hit = false; const r = b.T.r * 0.7;
    for (const c of COL.circles) { const dx = b.x - c.x, dz = b.z - c.z; if (Math.abs(dx) > c.r + r || Math.abs(dz) > c.r + r) continue; const d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 0.001) { b.x = c.x + dx / d * m; b.z = c.z + dz / d * m; hit = true; } }
    for (const o of COL.boxes) { const dx = b.x - o.x, dz = b.z - o.z, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hw + r && Math.abs(lz) < o.hd + r) { const px = o.hw + r - Math.abs(lx), pz = o.hd + r - Math.abs(lz); let nx = lx, nz = lz; if (px < pz) nx = Math.sign(lx) * (o.hw + r); else nz = Math.sign(lz) * (o.hd + r); b.x = o.x + nx * o.c + nz * o.s; b.z = o.z - nx * o.s + nz * o.c; hit = true; } }
    return hit;
  }
  place(b) {
    if (!b.dead && b.state !== 'emerge' && b.state !== 'tunnel' && b.type !== 'queen') {
      let gy = ground(b.x, b.z); const r = Math.hypot(b.x, b.z), band = Math.abs(r - RING);
      if (band < 1.4) gy += 1.25 * Math.cos(band / 1.4 * Math.PI / 2);   // scramble over the sandbags
      b.y += (gy - b.y) * 0.35;
    }
  }
  upload() {
    const o = this.o, cnt = {};
    for (const k in this.meshes) cnt[k] = 0;
    for (const b of this.all) {
      const M = this.meshes[b.type], i = cnt[b.type]++; if (i >= b.T.pool) continue;
      o.position.set(b.x, b.y, b.z); o.rotation.set(b.pitch, b.yaw, b.roll, 'YXZ'); o.scale.setScalar(1); o.updateMatrix(); M.mesh.setMatrixAt(i, o.matrix);
      M.inst.setXYZW(i, b.phase, b.flash, b.charge, b.dead ? Math.min(1, b.dieT * 3) : 0);
    }
    for (const k in this.meshes) { const M = this.meshes[k]; M.mesh.count = cnt[k]; M.ol.count = cnt[k]; M.mesh.instanceMatrix.needsUpdate = true; M.inst.needsUpdate = true; }
  }
  // ballistic acid glob aimed at where the player will be
  lob(b, P, ctx, spread = 0, from = null) {
    const s = from || new V3(b.x + Math.sin(b.yaw) * 0.4 * b.T.spec.scale, b.y + b.T.cy + 0.6, b.z + Math.cos(b.yaw) * 0.4 * b.T.spec.scale);
    const lead = Math.min(1, Math.hypot(P.x - s.x, P.z - s.z) / 22);
    const tx = P.x + P.vx * lead * 0.6 + (Math.random() - .5) * (2 + spread), tz = P.z + P.vz * lead * 0.6 + (Math.random() - .5) * (2 + spread), ty = ground(tx, tz);
    const T = 0.9 + lead * 0.7, g = 22; const v = new V3((tx - s.x) / T, (ty - s.y + 0.5 * g * T * T) / T, (tz - s.z) / T);
    this.globs.push({ p: s, v, g, life: 4 });
  }
  updateGlobs(dt, ctx) {
    let n = 0; const o = this.o;
    for (let i = this.globs.length - 1; i >= 0; i--) { const q = this.globs[i]; q.v.y -= q.g * dt; q.p.addScaledVector(q.v, dt); q.life -= dt; ctx.trail(q.p);
      const gy = ground(q.p.x, q.p.z), dP = Math.hypot(ctx.player.x - q.p.x, ctx.player.y - 0.8 - q.p.y, ctx.player.z - q.p.z);
      if (q.p.y <= gy || q.life <= 0 || dP < 1.1) { ctx.splash(q.p, dP); this.globs.splice(i, 1); } }
    for (const q of this.globs) { if (n >= 60) break; o.position.copy(q.p); o.rotation.set(0, 0, 0); const s = 1 + Math.sin(this.U.time.value * 30) * 0.15; o.scale.set(s, s, s * 1.4); o.lookAt(q.p.x + q.v.x, q.p.y + q.v.y, q.p.z + q.v.z); o.updateMatrix(); this.globMesh.setMatrixAt(n++, o.matrix); }
    this.globMesh.count = n; this.globMesh.instanceMatrix.needsUpdate = true;
  }
  // ----- the queen: surface, fight (spit volleys, brood calls, stomps), burrow, tunnel toward you, erupt
  queen(b, dt, ctx, dP) {
    b.t -= dt; b.cd -= dt; const P = ctx.player;
    const face = () => { b.yaw = turn(b.yaw, Math.atan2(P.x - b.x, P.z - b.z), dt * 1.5); };
    if (b.state === 'emerge' || b.state === 'rise') { b.y += (ground(b.x, b.z) - b.y) * Math.min(1, dt * 1.6); b.phase += dt * 6; face(); if (b.t <= 0) { b.state = 'fight'; b.t = 11 + Math.random() * 4; b.cd = 1.5; } return; }
    if (b.state === 'fight') {
      face(); const want = dP > 10 ? b.spd : 0; b.x += Math.sin(b.yaw) * want * dt; b.z += Math.cos(b.yaw) * want * dt; b.phase += dt * want * 0.9; this.collide(b);
      b.y += (ground(b.x, b.z) - b.y) * 0.2;
      if (b.stomp > 0) { b.stomp -= dt; b.pitch = -Math.sin((1 - b.stomp) * Math.PI) * 0.25; b.charge = 1 - b.stomp; if (b.stomp <= 0) { b.pitch = 0; b.charge = 0; ctx.quake(new V3(b.x + Math.sin(b.yaw) * 4, b.y, b.z + Math.cos(b.yaw) * 4), 10, 26); } }
      else if (b.cd <= 0) {
        const r = Math.random(); b.cd = 2.6 + Math.random();
        if (dP < 11) { b.stomp = 1; ctx.sfx('roar'); }
        else if (r < 0.5) { for (let i = 0; i < 5; i++) setTimeout(() => !b.dead && this.lob(b, P, ctx, 5, new V3(b.x, b.y + 6, b.z)), i * 140); b.charge = 0.8; ctx.sfx('spit', dP); }
        else { ctx.sfx('roar'); for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, rr = 6 + Math.random() * 6; this.spawn('runner', b.x + Math.cos(a) * rr, b.z + Math.sin(a) * rr, { emerge: true }); } }
      }
      b.charge = Math.max(0, b.charge - dt * 0.5);
      if (b.t <= 0) { b.state = 'burrow'; b.t = 2.2; ctx.sfx('rumble'); ctx.dirt(new V3(b.x, b.y, b.z), 6); }
      return;
    }
    if (b.state === 'burrow') { b.y -= dt * 5; b.phase += dt * 12; if (Math.random() < dt * 8) ctx.dirt(new V3(b.x + (Math.random() - .5) * 8, ground(b.x, b.z), b.z + (Math.random() - .5) * 8), 3); if (b.t <= 0) { b.state = 'tunnel'; b.t = 5.5; } return; }
    if (b.state === 'tunnel') { // a moving plume of dust tracks you underground
      const dx = P.x - b.x, dz = P.z - b.z, d = Math.hypot(dx, dz) || 1; const sp = Math.min(13, d * 2); b.x += dx / d * sp * dt; b.z += dz / d * sp * dt; b.y = ground(b.x, b.z) - 14;
      if (Math.random() < dt * 22) ctx.plume(new V3(b.x, ground(b.x, b.z), b.z));
      if (b.t <= 0 || (d < 3 && b.t < 3.8)) { b.state = 'tell'; b.t = 1.3; b.tx = P.x + (Math.random() - .5) * 3; b.tz = P.z + (Math.random() - .5) * 3; b.x = b.tx; b.z = b.tz; ctx.sfx('rumble'); ctx.warnRing(new V3(b.x, ground(b.x, b.z), b.z), 6.5, 1.3); }
      return;
    }
    if (b.state === 'tell') { if (Math.random() < dt * 30) ctx.dirt(new V3(b.x + (Math.random() - .5) * 9, ground(b.x, b.z), b.z + (Math.random() - .5) * 9), 2); if (b.t <= 0) { b.state = 'rise'; b.t = 1.4; b.y = ground(b.x, b.z) - 6; ctx.quake(new V3(b.x, ground(b.x, b.z), b.z), 7, 24); ctx.sfx('roar'); } }
  }
}
function turn(a, b, k) { let d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-k, Math.min(k, d)); }
