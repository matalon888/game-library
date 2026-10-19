// Hollowtide — the machines: Menders (maintenance crawlers that weld anything that moves) and the Warden
// (a tall security unit that hunts by sound). Models built from primitives, merged per material; AI on the tile grid.
import { THREE } from './kit/cine.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { T, blocked, los, path, tileOf, solidTile } from './world.js';

import { RAMP } from './world.js';
const S = function (o) { const q = { ...o }; delete q.metalness; delete q.roughness; return new THREE.MeshToonMaterial({ gradientMap: RAMP(), ...q }); };
const MM = {
  paint: new S({ color: 0xffc531 }), dark: new S({ color: 0x33406b }), steel: new S({ color: 0xe9eef3 }), stripe: new S({ color: 0xff5d5d }),
  wPaint: new S({ color: 0x6a4fd0 }), wHaz: new S({ color: 0xff7a3d }), wDark: new S({ color: 0x2b2d52 }),
  torch: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, .5) }),
};
// screen faces drawn on canvases: the robots' mood is readable at a glance
function face(draw, w = 160, h = 96) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#0d1630'; x.fillRect(0, 0, w, h); x.lineCap = x.lineJoin = 'round'; draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.5, 1.5, 1.5) }); }
const eyes = (x, w, h, col, kind) => {
  x.fillStyle = x.strokeStyle = col; x.lineWidth = 9;
  for (const s of [-1, 1]) { const cx = w / 2 + s * 36, cy = h / 2;
    if (kind === 'happy') { x.beginPath(); x.ellipse(cx, cy, 16, 22, 0, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 5, cy - 8, 5, 0, 7); x.fill(); x.fillStyle = col; }
    if (kind === 'sus') { x.beginPath(); x.ellipse(cx, cy + 4, 17, 10, 0, 0, 7); x.fill(); x.fillRect(cx - 24, cy - 14, 48, 6); }
    if (kind === 'angry') { x.beginPath(); x.moveTo(cx - 20, cy - 4 - s * 12); x.lineTo(cx + 20, cy - 4 + s * 12); x.lineTo(cx + 18, cy + 18); x.lineTo(cx - 18, cy + 18); x.closePath(); x.fill(); }
    if (kind === 'dizzy') { x.beginPath(); for (let a = 0; a < 14; a += .3) x.lineTo(cx + Math.cos(a) * a * 1.6, cy + Math.sin(a) * a * 1.6); x.lineWidth = 5; x.stroke(); }
    if (kind === 'dead') { x.lineWidth = 8; x.beginPath(); x.moveTo(cx - 14, cy - 14); x.lineTo(cx + 14, cy + 14); x.moveTo(cx + 14, cy - 14); x.lineTo(cx - 14, cy + 14); x.stroke(); }
  }
};
export const FACES = {
  idle: face((x, w, h) => eyes(x, w, h, '#4ff0ff', 'happy')),
  sus: face((x, w, h) => { eyes(x, w, h, '#ffd23f', 'sus'); x.fillStyle = '#ffd23f'; x.font = 'bold 30px sans-serif'; x.fillText('?', w - 26, 30); }),
  angry: face((x, w, h) => eyes(x, w, h, '#ff3d5a', 'angry')),
  dizzy: face((x, w, h) => eyes(x, w, h, '#8fa8ff', 'dizzy')),
  dead: face((x, w, h) => eyes(x, w, h, '#45506a', 'dead')),
};
const wface = (col, pupil = 0, lid = 0) => face((x, w, h) => { x.fillStyle = col; x.beginPath(); x.ellipse(w / 2, h / 2, 46, 34, 0, 0, 7); x.fill(); x.fillStyle = '#0d1630'; x.beginPath(); x.arc(w / 2 + pupil, h / 2, 15, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(w / 2 + pupil + 6, h / 2 - 7, 5, 0, 7); x.fill(); if (lid) { x.fillStyle = '#0d1630'; x.fillRect(0, 0, w, h / 2 - 34 + lid); x.save(); x.translate(w / 2, h / 2 - 30 + lid); x.rotate(.0); x.restore(); } });
export const WFACES = { patrol: wface('#4ff0ff', 0, 14), search: wface('#ffd23f', 0, 22), hunt: wface('#ff3d5a', 0, 26), attack: wface('#ffffff', 0, 0), stunned: face((x, w, h) => eyes(x, w, h, '#8fa8ff', 'dizzy')) };
function G(list) { return mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g), false); }
const box = (w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };
const rbox = (w, h, d, x = 0, y = 0, z = 0, r = .05) => { const g = new RoundedBoxGeometry(w, h, d, 2, r); g.translate(x, y, z); return g; };
const cyl = (r, l, x = 0, y = 0, z = 0, axis = 'y', seg = 12, r2 = r) => { const g = new THREE.CylinderGeometry(r, r2, l, seg); if (axis === 'x') g.rotateZ(Math.PI / 2); if (axis === 'z') g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; };
const sph = (r, x = 0, y = 0, z = 0) => { const g = new THREE.SphereGeometry(r, 16, 10); g.translate(x, y, z); return g; };
const mesh = (g, m, sh = true) => { const o = new THREE.Mesh(g, m); o.castShadow = sh; o.receiveShadow = true; return o; };
// a limb segment from a to b (Vector3s), as a box of thickness t
function seg(a, b, t, t2 = t) { const d = new THREE.Vector3().subVectors(b, a), l = d.length(); const g = new THREE.BoxGeometry(t, l, t2); g.translate(0, l / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.applyQuaternion(q); g.translate(a.x, a.y, a.z); return g; }
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ Mender model
export function makeMender() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(mesh(G([rbox(.78, .3, .86, 0, .66, 0, .08), rbox(.5, .16, .5, 0, .85, -.05, .06), box(.12, .22, .5, .3, .8, -.05, 0, 0, -.5), box(.12, .22, .5, -.3, .8, -.05, 0, 0, .5)]), MM.paint));
  body.add(mesh(G([rbox(.62, .14, .72, 0, .47, 0, .04), cyl(.09, .5, .18, .9, -.25, 'z'), cyl(.09, .5, -.18, .9, -.25, 'z'), box(.5, .06, .06, 0, .95, .15), box(.04, .25, .04, .2, 1.05, -.3), sph(.035, .2, 1.18, -.3)]), MM.dark));
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(.52, .3), FACES.idle); eye.position.set(0, .68, .438); body.add(eye);
  body.add(mesh(G([box(.7, .07, .05, 0, .86, .42), box(.07, .38, .05, .33, .68, .42), box(.07, .38, .05, -.33, .68, .42), box(.7, .06, .05, 0, .5, .42)]), MM.stripe));
  const legs = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const piv = new THREE.Group(); piv.position.set(sx * .33, .55, sz * .28);
    piv.add(mesh(G([seg(v3(0, 0, 0), v3(sx * .38, .2, sz * .1), .09), seg(v3(sx * .38, .2, sz * .1), v3(sx * .55, -.55, sz * .2), .07), cyl(.06, .12, sx * .38, .2, sz * .1, 'z'), sph(.05, sx * .55, -.55, sz * .2)]), MM.dark));
    g.add(piv); legs.push(piv);
  }
  const arms = [];
  for (const sx of [1, -1]) {
    const piv = new THREE.Group(); piv.position.set(sx * .24, .6, .38);
    piv.add(mesh(G([seg(v3(0, 0, 0), v3(sx * .05, -.1, .35), .07), seg(v3(sx * .05, -.1, .35), v3(0, -.05, .62), .055), cyl(.03, .1, 0, -.05, .66, 'z')]), MM.steel));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), MM.torch); tip.position.set(0, -.05, .72); piv.add(tip); piv.tip = tip;
    body.add(piv); arms.push(piv);
  }
  g.body = body; g.legs = legs; g.arms = arms; g.eye = eye;
  return g;
}

// ------------------------------------------------------------------ Warden model
export function makeWarden() {
  const g = new THREE.Group(), torso = new THREE.Group(); torso.position.y = 1.55; g.add(torso);
  torso.add(mesh(G([rbox(.85, .7, .55, 0, .35, 0, .1), rbox(.7, .5, .5, 0, -.15, .05, .08), rbox(.5, .3, .4, 0, -.45, 0, .06), cyl(.12, .9, .25, .4, -.35, 'y'), cyl(.12, .9, -.25, .4, -.35, 'y'), box(.9, .12, .2, 0, .72, -.1), cyl(.18, .3, 0, .78, .05, 'y', 12)]), MM.wPaint));
  torso.add(mesh(G([box(.6, .35, .06, 0, .35, .3), box(.25, .45, .08, .45, .45, .05, 0, 0, -.3), box(.25, .45, .08, -.45, .45, .05, 0, 0, .3)]), MM.wHaz));
  const head = new THREE.Group(); head.position.set(0, .95, .25); torso.add(head);
  head.add(mesh(G([rbox(.62, .46, .55, 0, 0, .1, .12), box(.42, .1, .4, 0, .24, .05), cyl(.06, .4, 0, -.3, -.05)]), MM.wPaint));
  const sens = new THREE.Mesh(new THREE.PlaneGeometry(.5, .3), WFACES.patrol); sens.position.set(0, .02, .385); head.add(sens);
  head.add(mesh(G([box(.08, .5, .08, .26, .3, -.1, 0, 0, -.3), box(.08, .5, .08, -.26, .3, -.1, 0, 0, .3)]), MM.wHaz)); head.add(mesh(G([sph(.06, .33, .55, -.1), sph(.06, -.33, .55, -.1)]), MM.torch));
  const lamp = new THREE.SpotLight(0xff5040, 0, 20, .42, .6, 1.4); lamp.position.set(0, 0, .4); const tgt = new THREE.Object3D(); tgt.position.set(0, -1.6, 5); head.add(lamp, tgt); lamp.target = tgt;
  const legs = [], arms = [];
  for (const sx of [1, -1]) {
    const hip = new THREE.Group(); hip.position.set(sx * .32, 1.25, 0); g.add(hip);
    hip.add(mesh(G([seg(v3(0, 0, 0), v3(0, -.62, .3), .2, .26), cyl(.14, .3, 0, 0, 0, 'x')]), MM.wPaint));
    const knee = new THREE.Group(); knee.position.set(0, -.62, .3); hip.add(knee);
    knee.add(mesh(G([seg(v3(0, 0, 0), v3(0, -.63, -.28), .15, .2), box(.28, .08, .5, 0, -.66, -.15), cyl(.11, .26, 0, 0, 0, 'x')]), MM.steel));
    hip.knee = knee; legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(sx * .55, .55, 0); torso.add(sh);
    sh.add(mesh(G([sph(.17), seg(v3(0, 0, 0), v3(sx * .1, -.7, .05), .14)]), MM.wPaint));
    const el = new THREE.Group(); el.position.set(sx * .1, -.7, .05); sh.add(el);
    el.add(mesh(G([seg(v3(0, 0, 0), v3(0, -.7, .2), .11), ...[-1, 0, 1].map(k => seg(v3(k * .06, -.7, .2), v3(k * .1, -.95, .35), .04)), sph(.09)]), MM.steel));
    sh.el = el; arms.push(sh);
  }
  g.scale.setScalar(1.18);
  g.torso = torso; g.head = head; g.sens = sens; g.lamp = lamp; g.legs = legs; g.arms = arms;
  return g;
}

// ------------------------------------------------------------------ shared movement on the grid
const tmp = new THREE.Vector3();
function steer(a, ctx, tx, tz, speed, dt) {
  const L = ctx.L;
  // repath every 0.35 s toward the target tile
  a.repath -= dt;
  const [tc, tr] = tileOf(tx, tz), [c, r] = tileOf(a.x, a.z);
  if (a.repath <= 0 || !a.path || a.goalT !== tc + ',' + tr) {
    a.repath = .35; a.goalT = tc + ',' + tr;
    a.path = path(L, [c, r], [tc, tr], (cc, rr) => { const ch = L.at(cc, rr); if (ch === '#') return false; if (/[abc]/.test(ch)) { const d = L.doors.find(d => d.c === cc && d.r === rr); return d && d.unlocked; } return true; }) || [];
  }
  let wx = tx, wz = tz;
  if (a.path.length && !(los(L, a.x, a.z, tx, tz) && Math.hypot(tx - a.x, tz - a.z) < 6)) {
    while (a.path.length && Math.hypot(a.path[0][0] * T - a.x, a.path[0][1] * T - a.z) < .6) a.path.shift();
    if (a.path.length) { wx = a.path[0][0] * T; wz = a.path[0][1] * T; }
  }
  const dx = wx - a.x, dz = wz - a.z, d = Math.hypot(dx, dz);
  if (d < .05) return 0;
  const want = Math.atan2(dx, dz); let df = want - a.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); a.yaw += df * Math.min(1, dt * 7);
  const sp = speed * Math.max(.25, Math.cos(Math.min(1.5, Math.abs(df)))), mx = dx / d * sp * dt, mz = dz / d * sp * dt;
  let moved = 0;
  if (!blocked(L, a.x + mx, a.z, a.rad)) { a.x += mx; moved += Math.abs(mx); }
  if (!blocked(L, a.x, a.z + mz, a.rad)) { a.z += mz; moved += Math.abs(mz); }
  return moved / dt;
}
function separate(list, dt) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]; if (a.dead || b.dead) continue; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.rad + b.rad;
    if (d > 0 && d < m) { const p = (m - d) / 2 / d; a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p; }
  }
}
export { separate };
const angTo = (a, x, z) => { let d = Math.atan2(x - a.x, z - a.z) - a.yaw; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };

// ------------------------------------------------------------------ Mender AI
export class Mender {
  constructor(ctx, x, z) {
    this.ctx = ctx; this.m = makeMender(); ctx.scene.add(this.m); this.x = x; this.z = z; this.yaw = Math.random() * 6; this.rad = .45;
    this.hp = 3; this.state = 'idle'; this.aware = 0; this.t = 0; this.cool = 0; this.walk = 0; this.home = { x, z }; this.wander = null; this.flank = Math.random() < .5 ? 1 : -1; this.hitT = 0; this.servo = Math.random() * 2; this.repath = 0;
    this.kind = 'mender';
  }
  get center() { return tmp.set(this.x, .7, this.z); }
  hear(n) { if (this.dead) return; const d = Math.hypot(n.x - this.x, n.z - this.z); if (d < n.r * .9 && this.state !== 'hunt' && this.state !== 'attack') { this.state = 'investigate'; this.target = { x: n.x, z: n.z }; this.t = 0; } }
  damage(n, from) {
    if (this.dead) return false; this.hp -= n; this.hitT = .15; this.aware = 1; if (this.state !== 'attack') this.state = 'hunt';
    if (this.hp === 1) { this.state = 'retreat'; this.t = 1.1; }
    if (this.hp <= 0) { this.die(from); return true; }
    return false;
  }
  stun(s) { if (this.dead) return; this.state = 'stunned'; this.t = s; }
  die() {
    this.dead = true; this.state = 'dead'; const c = this.ctx, p = v3(this.x, .7, this.z);
    c.fx.burst(p, 40, 'spark'); c.fx.burst(p, 14, 'smoke'); c.lights.flash(p, 0xffb050, 40, .25);
    for (let i = 0; i < 12; i++) c.debris.spawn(p.clone().add(v3(Math.random() - .5, Math.random() * .3, Math.random() - .5)), v3(Math.random() * 6 - 3, 2 + Math.random() * 4, Math.random() * 6 - 3), i % 3 ? 0x2a2f33 : 0xb48a2c, .7 + Math.random() * 1.2);
    c.snd('break', this.x, this.z, 30);
    this.m.eye.material = FACES.dead; this.m.arms.forEach(a => a.tip.visible = false);
    this.fall = 0;
  }
  update(dt, P) {
    const c = this.ctx, m = this.m;
    if (this.dead) { if (this.fall < 1) { this.fall = Math.min(1, this.fall + dt * 3); m.body.rotation.z = this.fall * .9; m.body.position.y = -this.fall * .35; m.legs.forEach((l, i) => l.rotation.z = (i % 2 ? -1 : 1) * this.fall * .9); } m.position.set(this.x, 0, this.z); return; }
    this.cool -= dt; this.hitT -= dt; this.servo -= dt;
    const dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz);
    const sightR = P.hidden ? 0 : (P.lightOn ? 15 : 7) * (P.crouch ? .6 : 1) * (P.inDark ? .8 : 1);
    const see = d < sightR && (angTo(this, P.x, P.z) < 1.2 || d < 3) && los(c.L, this.x, this.z, P.x, P.z);
    if (see) this.aware = Math.min(1.2, this.aware + dt * (2.6 - d / sightR * 1.6)); else this.aware = Math.max(0, this.aware - dt * .25);
    if (this.aware >= 1 && (this.state === 'idle' || this.state === 'investigate')) { this.state = 'hunt'; c.snd('windup', this.x, this.z, 20, .5); c.onAlert && c.onAlert(this); }
    if (see && this.state === 'hunt') this.last = { x: P.x, z: P.z };
    let speed = 0;
    const fk = c.fk;
    switch (this.state) {
      case 'idle': {
        if (!this.wander || Math.hypot(this.wander.x - this.x, this.wander.z - this.z) < .6 || (this.t += dt) > 7) { this.t = 0; const a = Math.random() * 6.28; this.wander = { x: this.home.x + Math.cos(a) * 3, z: this.home.z + Math.sin(a) * 3 }; if (blocked(c.L, this.wander.x, this.wander.z, .5)) this.wander = { ...this.home }; }
        speed = steer(this, c, this.wander.x, this.wander.z, 1.0, dt); break;
      }
      case 'investigate': {
        speed = steer(this, c, this.target.x, this.target.z, 2.0 * fk, dt); this.t += dt;
        if (Math.hypot(this.target.x - this.x, this.target.z - this.z) < 1.2 || this.t > 9) { this.yaw += dt * 2; if (this.t > 11) { this.state = 'idle'; this.home = { x: this.x, z: this.z }; } }
        break;
      }
      case 'hunt': {
        const tgt = see ? P : (this.last || P);
        if (see && d < 2.1 && this.cool <= 0) { this.state = 'attack'; this.t = .55; c.snd('windup', this.x, this.z, 20); break; }
        // flank: approach on an arc instead of a straight line
        let tx = tgt.x, tz = tgt.z;
        if (see && d > 3.5) { const px = -dz / d, pz = dx / d, k = Math.min(2.5, d * .35) * this.flank; if (!blocked(c.L, tx + px * k, tz + pz * k, .5)) { tx += px * k; tz += pz * k; } }
        speed = steer(this, c, tx, tz, 2.7 * fk, dt);
        if (!see && this.last && Math.hypot(this.last.x - this.x, this.last.z - this.z) < 1) { this.state = 'investigate'; this.target = this.last; this.t = 6; }
        break;
      }
      case 'attack': {
        this.t -= dt; this.yaw += Math.atan2(Math.sin(Math.atan2(dx, dz) - this.yaw), Math.cos(Math.atan2(dx, dz) - this.yaw)) * Math.min(1, dt * 8);
        if (this.t > 0) { m.eye.material = FACES.angry; m.eye.scale.setScalar(1 + Math.sin(c.time * 50) * .08); }
        else if (this.t > -.22) { const s = 4.5 * dt; if (!blocked(c.L, this.x + Math.sin(this.yaw) * s, this.z + Math.cos(this.yaw) * s, this.rad)) { this.x += Math.sin(this.yaw) * s; this.z += Math.cos(this.yaw) * s; }
          if (!this.struck && d < 1.9) { this.struck = true; c.hurt(13 * fk, this); c.fx.burst(v3(P.x, 1.2, P.z), 14, 'spark'); } }
        else { this.state = 'hunt'; this.cool = 1.0; this.struck = false; this.flank = -this.flank; }
        break;
      }
      case 'retreat': {
        this.t -= dt; const ax = this.x - dx / (d || 1) * 3, az = this.z - dz / (d || 1) * 3; speed = steer(this, c, ax, az, 3.0, dt); if (this.t <= 0) this.state = 'hunt'; break;
      }
      case 'stunned': {
        this.t -= dt; m.body.rotation.z = Math.sin(c.time * 40) * .05; if (Math.random() < dt * 6) c.fx.burst(v3(this.x, .9, this.z), 4, 'spark');
        if (this.t <= 0) { this.state = 'hunt'; m.body.rotation.z = 0; } break;
      }
    }
    // eye colour: cyan idle, amber suspicious, red hostile
    const hostile = this.state === 'hunt' || this.state === 'attack' || this.state === 'retreat';
    if (this.state !== 'attack') { m.eye.scale.setScalar(this.hitT > 0 ? 1.15 : 1); m.eye.material = this.state === 'stunned' ? FACES.dizzy : hostile ? FACES.angry : this.aware > .2 || this.state === 'investigate' ? FACES.sus : FACES.idle; }

    // animation
    this.walk += dt * (speed * 4.5 + .3);
    m.position.set(this.x, 0, this.z); m.rotation.y = this.yaw;
    m.body.position.y = Math.abs(Math.sin(this.walk)) * .04 * Math.min(1, speed) + (this.hitT > 0 ? -.05 : 0);
    m.legs.forEach((l, i) => { const ph = this.walk + (i === 0 || i === 3 ? 0 : Math.PI); l.rotation.x = Math.sin(ph) * .35 * Math.min(1, speed); l.rotation.z = Math.max(0, Math.cos(ph)) * .2 * Math.min(1, speed) * (i % 2 ? -1 : 1); });
    const raise = this.state === 'attack' ? (this.t > 0 ? -.9 : .4) : Math.sin(c.time * 3 + this.home.x) * .1;
    m.arms.forEach((a, i) => { a.rotation.x = raise + (i ? .1 : 0); a.tip.scale.setScalar(1 + Math.random() * .6); });
    if (this.servo <= 0 && speed > .2) { this.servo = .5 + Math.random(); c.snd('servo', this.x, this.z, 16); }
  }
}

// ------------------------------------------------------------------ Warden AI
export class Warden {
  constructor(ctx, x, z) {
    this.ctx = ctx; this.m = makeWarden(); ctx.scene.add(this.m); this.x = x; this.z = z; this.yaw = 0; this.rad = .55; this.kind = 'warden';
    this.state = 'patrol'; this.t = 0; this.walk = 0; this.stepT = 0; this.goal = null; this.lost = 0; this.listenCd = 0; this.repath = 0; this.flinch = 0; this.seeT = 0;
    this.beam = ctx.makeBeam(); this.beam.material = this.beam.material.clone(); this.beam.material.uniforms.uI.value = .05; this.m.head.add(this.beam); this.beam.position.set(0, 0, .4); this.beam.rotation.x = -.32; this.beam.scale.set(.6, .6, .9);
    this.m.lamp.intensity = 40;
  }
  get center() { return tmp.set(this.x, 1.7, this.z); }
  hear(n) {
    if (this.state === 'stunned' || this.state === 'attack') return;
    const d = Math.hypot(n.x - this.x, n.z - this.z); if (d > n.r) return;
    if (this.state === 'hunt' && this.seeT < 1) { this.last = { x: n.x, z: n.z }; return; }
    if (this.state !== 'hunt') { this.state = 'investigate'; this.goal = { x: n.x, z: n.z }; this.t = 0; if (this.listenCd <= 0) { this.listenCd = 2.5; this.ctx.snd('wListen', this.x, this.z, 40); this.ctx.onWardenHear && this.ctx.onWardenHear(); } }
  }
  damage() { this.flinch = .3; if (this.state !== 'stunned' && this.state !== 'attack') { if (this.state !== 'hunt') this.ctx.snd('wRoar', this.x, this.z, 50); this.state = 'hunt'; this.last = { x: this.ctx.P.x, z: this.ctx.P.z }; this.seeT = 0; } return false; }
  stun(s) { this.state = 'stunned'; this.t = s; this.m.lamp.intensity = 0; this.m.sens.material = WFACES.stunned; this.ctx.snd('break', this.x, this.z, 40, .6); }
  update(dt, P) {
    const c = this.ctx, m = this.m; this.listenCd -= dt; this.flinch -= dt;
    const dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz);
    const range = P.hidden ? 0 : (P.lightOn ? 12 : 6) * (P.crouch ? .75 : 1);
    const see = this.state !== 'stunned' && ((d < range && angTo(this, P.x, P.z) < 1.0) || d < 2.4 && !P.hidden) && los(c.L, this.x, this.z, P.x, P.z);
    if (see) { this.seeT = 0; this.last = { x: P.x, z: P.z }; } else this.seeT += dt;
    if (see && this.state !== 'hunt' && this.state !== 'attack' && this.state !== 'stunned') { this.state = 'hunt'; c.snd('wRoar', this.x, this.z, 60); c.onAlert && c.onAlert(this); }
    // seen climbing into a locker up close = dragged out
    if (P.hidden && P.hidAt && c.time - P.hidAt < .6 && this.state === 'hunt' && this.seeT < .6 && d < 3.5) { c.caught(this); }
    let speed = 0; const fk = c.fk;
    if (this.flinch > 0 && this.state !== 'stunned') { /* staggers in place */ }
    else switch (this.state) {
      case 'patrol': {
        // the station keeps it within earshot: patrol goals drift toward the player's area
        if (!this.goal || Math.hypot(this.goal.x - this.x, this.goal.z - this.z) < 1 || (this.t += dt) > 14) {
          this.t = 0; const L = c.L; let best = null;
          for (let k = 0; k < 30; k++) { const cc = (Math.random() * L.w) | 0, rr = (Math.random() * L.h) | 0; if (solidTile(L, cc, rr) || /[abc]/.test(L.at(cc, rr))) continue; const gx = cc * T, gz = rr * T, pd = Math.hypot(gx - P.x, gz - P.z); if (pd < 6) continue; const sc = Math.abs(pd - 12) + Math.random() * 8; if (!best || sc < best.sc) best = { x: gx, z: gz, sc }; }
          this.goal = best || { x: this.x, z: this.z };
        }
        speed = steer(this, c, this.goal.x, this.goal.z, 1.5 * fk, dt); break;
      }
      case 'investigate': {
        speed = steer(this, c, this.goal.x, this.goal.z, 2.5 * fk, dt); this.t += dt;
        if (Math.hypot(this.goal.x - this.x, this.goal.z - this.z) < 1.2 || this.t > 12) { this.state = 'search'; this.t = 5 + Math.random() * 3; }
        break;
      }
      case 'search': {
        this.t -= dt; this.yaw += Math.sin(c.time * .9) * dt * 1.6; m.head.rotation.y = Math.sin(c.time * 1.7) * .7;
        if (this.t <= 0) { this.state = 'patrol'; this.goal = null; m.head.rotation.y = 0; } break;
      }
      case 'hunt': {
        const tgt = see ? P : this.last;
        if (see && d < 1.9) { this.state = 'attack'; this.t = .7; c.snd('windup', this.x, this.z, 30, 1); break; }
        speed = steer(this, c, tgt.x, tgt.z, (see ? 4.1 : 3.4) * fk, dt);
        if (this.seeT > 4.5 || (!see && Math.hypot(tgt.x - this.x, tgt.z - this.z) < 1)) { this.state = 'search'; this.t = 6; }
        break;
      }
      case 'attack': {
        this.t -= dt; const want = Math.atan2(dx, dz); this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * 6);
        if (this.t <= 0) { if (d < 2.4 && !P.hidden) c.caught(this); else { this.state = 'hunt'; } }
        break;
      }
      case 'stunned': {
        this.t -= dt; if (Math.random() < dt * 8) c.fx.burst(v3(this.x + Math.random() - .5, 1.5 + Math.random(), this.z + Math.random() - .5), 6, 'spark');
        m.lamp.intensity = Math.random() < .1 ? 20 : 0;
        if (this.t <= 0) { this.state = 'search'; this.t = 4; m.lamp.intensity = 40;  c.snd('wRoar', this.x, this.z, 50, .7); }
        break;
      }
    }
    // body language
    const hunting = this.state === 'hunt' || this.state === 'attack';
    if (this.state !== 'stunned') m.sens.material = this.state === 'attack' ? WFACES.attack : hunting ? WFACES.hunt : this.state === 'investigate' || this.state === 'search' ? WFACES.search : WFACES.patrol;
    if (this.state !== 'stunned') { m.lamp.color.setHex(hunting ? 0xff3020 : 0xffd0b0); m.lamp.intensity = hunting ? 70 : 40; this.beam.material.uniforms.uI.value = hunting ? .08 : .05; }
    this.walk += dt * speed * 2.2;
    m.position.set(this.x, 0, this.z); m.rotation.y = this.yaw;
    const sl = this.state === 'stunned' ? 1 : 0;
    m.torso.rotation.x = .25 + sl * .45 + (hunting ? .15 : 0) + Math.sin(c.time * 1.3) * .03; m.torso.position.y = 1.55 + Math.abs(Math.sin(this.walk)) * .06 - sl * .3;
    m.legs.forEach((l, i) => { const ph = this.walk + i * Math.PI; l.rotation.x = Math.sin(ph) * .45 * Math.min(1, speed / 2) - sl * .4; l.knee.rotation.x = Math.max(0, -Math.cos(ph)) * .6 * Math.min(1, speed / 2) + sl * .8; });
    m.arms.forEach((a, i) => { const ph = this.walk + i * Math.PI; const atk = this.state === 'attack' ? (this.t > 0 ? -2.2 : .6) : 0; a.rotation.x = atk || Math.sin(ph) * .3 * Math.min(1, speed / 2) + sl * .6; a.el.rotation.x = this.state === 'attack' ? -.6 : -.3 - (hunting ? .4 : 0); });
    if (this.state === 'investigate' || this.state === 'patrol') m.head.rotation.y = Math.sin(c.time * .8) * .4;
    else if (this.state === 'hunt') m.head.rotation.y *= .9;
    this.stepT -= dt * Math.max(.4, speed);
    if (this.stepT <= 0 && speed > .3) { this.stepT = 1.25; c.snd('wStep', this.x, this.z, 38); c.wardenStep && c.wardenStep(this); }
  }
}
