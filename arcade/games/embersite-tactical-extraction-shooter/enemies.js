// WARDEN automated security: Pickets (patrol bots), Striders (quad sentries), Kestrels (sniper drones), Bulwarks
// (armored walkers) and Hauler dropships that bring reinforcements. Perception with a detection meter, cover + flanking,
// telegraphed attacks (visor flare, laser sight, spin-up whine, pod beeps), plasma bolts the player can dodge.
import { THREE } from './kit/cine.js';
import { picket, strider, kestrel, bulwark, hauler } from './models.js';
const V3 = THREE.Vector3;
const TYPES = {
  picket: { hp: 100, walk: 1.5, run: 3.4, view: 72, fov: .3, eye: 1.95, score: 100, burst: 3, gap: .13, dmg: 7, bolt: 62, spread: .035, tele: .5, cool: [1.3, 2.3], range: 70, radius: .45, height: 2.1, label: 'PICKET' },
  strider: { hp: 170, walk: 1.2, run: 3.6, view: 58, fov: .2, eye: 1.4, score: 150, burst: 6, gap: .08, dmg: 5, bolt: 80, spread: .05, tele: .65, cool: [1.4, 2.4], range: 55, radius: .8, height: 1.6, label: 'STRIDER' },
  kestrel: { hp: 70, walk: 6, run: 9, view: 170, fov: -1, eye: 0, score: 200, burst: 1, gap: 0, dmg: 42, bolt: 240, spread: .008, tele: 1.7, cool: [3.5, 5], range: 180, radius: .6, height: 1, label: 'KESTREL', fly: true },
  bulwark: { hp: 1300, walk: 1.1, run: 1.8, view: 90, fov: .1, eye: 4.3, score: 800, burst: 16, gap: .07, dmg: 6, bolt: 75, spread: .06, tele: .95, cool: [1.6, 2.6], range: 80, radius: 1.3, height: 5, label: 'BULWARK', armor: true },
};
export function createEnemies(G) {
  const { scene, world, fx, audio } = G;
  const list = [], bolts = [], ships = [];
  const E = { list, bolts, ships, alarm: false, alarmT: 0 };
  const tmp = new V3(), tmp2 = new V3(), up = new V3(0, 1, 0);
  const rnd = (a, b) => a + Math.random() * (b - a);

  class Enemy {
    constructor(type, x, z, o = {}) {
      const T = this.T = TYPES[type]; this.type = type;
      const m = this.m = { picket, strider, kestrel, bulwark }[type](); scene.add(m.root);
      this.p = new V3(x, world.h(x, z), z); this.home = this.p.clone();
      if (T.fly) this.p.y += 22 + rnd(0, 8);
      this.yaw = o.yaw ?? rnd(0, 6.28); this.hp = this.maxHp = T.hp * (o.hpMul || 1); this.alive = true;
      this.state = 'patrol'; this.aw = 0; this.seen = false; this.lastSeen = -99; this.lastKnown = new V3(); this.marked = false;
      this.route = o.route || Array.from({ length: 4 }, (_, i) => { const a = i / 4 * 6.28 + rnd(-.4, .4), r = o.patrol ?? rnd(8, 22); return new V3(x + Math.cos(a) * r, 0, z + Math.sin(a) * r); });
      this.ri = 0; this.goal = this.route[0].clone(); this.wait = rnd(0, 2); this.think = rnd(0, .25); this.cool = rnd(1, 2); this.tele = 0; this.shots = 0; this.shotT = 0;
      this.phase = rnd(0, 6); this.speed = 0; this.stuck = 0; this.flash = 0; this.dieT = 0; this.flank = Math.random() < .35; this.repick = 0; this.rocketT = rnd(6, 9);
      this.aimDir = new V3(0, 0, 1); this.laser = -1; this.tilt = 0; this.dropping = o.dropping || false; this.vy = 0;
      this.m.root.position.copy(this.p); this.m.root.rotation.y = this.yaw;
      this.outlines = []; m.root.traverse(o => { if (o.material && o.material.side === THREE.BackSide) this.outlines.push(o); });
      for (const L of m.legs || []) for (const x of [L.t, L.k, L.u, L.l]) if (x) x.castShadow = false;
      list.push(this);
    }
    eye(out = tmp) { return this.T.fly ? out.copy(this.p) : out.set(this.p.x, this.p.y + this.T.eye, this.p.z); }
    alert(pos, hard = false) {
      if (!this.alive) return;
      if (hard || this.aw >= 1) { this.aw = 1; if (this.state !== 'combat') { this.state = 'combat'; this.repick = 0; audio.alert(this.p.distanceTo(G.player.p)); G.onSpotted && G.onSpotted(this); } this.lastKnown.copy(pos); this.lastSeen = Math.max(this.lastSeen, G.time - 2); }
      else { this.aw = Math.max(this.aw, .55); if (this.state === 'patrol') this.state = 'suspicious'; this.lastKnown.copy(pos); this.investT = 8; }
    }
    damage(dmg, crit, from, ap = false) {
      if (!this.alive) return null;
      if (this.T.armor && !crit) dmg *= ap ? .75 : .35;
      this.hp -= dmg; this.flash = 1;
      const wasCombat = this.state === 'combat';
      this.alert(G.player.p, true);
      for (const o of list) if (o !== this && o.alive && o.p.distanceTo(this.p) < 30) o.alert(G.player.p, false);
      if (this.hp <= 0) { this.die(); return { killed: true, stealth: !wasCombat }; }
      return { killed: false };
    }
    die() {
      this.alive = false; this.dieT = 0; this.m.mat.userData.dark.value = .32; this.m.mat.userData.glow.value = 0; this.tele = 0;
      if (this.laser >= 0) { fx.freeStreak(this.laser); this.laser = -1; }
      const c = tmp.copy(this.p).add(new V3(0, this.T.height * .6, 0)), big = this.type === 'bulwark', d = this.p.distanceTo(G.player.p);
      audio.robotDie(d, big); fx.sparks(c, 24, 9); fx.flash(c, 0xffa040, 30, 12, .15);
      if (big || this.type === 'strider') { fx.explosion(c, big ? 1.6 : .8); audio.boom(d); fx.shake(big ? .8 : .3 * Math.max(0, 1 - d / 40)); }
      fx.debris(c, big ? 16 : 7, ['#eef0f3', '#ff6a1f', '#2b3140'], big ? 10 : 6, big ? .35 : .14);
      fx.emitter({ p: c, life: big ? 20 : 8, rate: big ? 10 : 5, kind: 'smoke', size: big ? 2 : 1 });
      fx.emitter({ p: c, life: big ? 12 : 3, rate: 14, kind: 'fire', size: big ? 2 : 1 });
      this.fallDir = Math.random() < .5 ? -1 : 1;
    }
    hits() { this.m.root.updateMatrixWorld(); return this.m.hits.map(h => ({ c: this.m.root.localToWorld(h.o.clone()), r: h.r, crit: !!h.crit })); }
    remove() { scene.remove(this.m.root); if (this.laser >= 0) fx.freeStreak(this.laser); }
    perceive(dt) {
      const P = G.player, T = this.T; if (!P.alive || G.phase !== 'active') { this.seen = false; return; }
      const eye = this.eye(tmp2.clone()), chest = P.chest(), d = eye.distanceTo(chest);
      let vis = P.crouch ? .55 : 1; if (P.crouch && world.grassAt(P.p.x, P.p.z) > .5) vis *= .7; if (P.sprint) vis *= 1.2; if (G.time - P.loudT < 1.5) vis *= 1.6;
      const range = T.view * vis * (this.state === 'combat' ? 1.5 : 1);
      this.seen = false;
      if (d < range) {
        tmp.subVectors(chest, eye).normalize(); const fwd = new V3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        const inFov = T.fov < -.5 || d < 7 || (tmp.x * fwd.x + tmp.z * fwd.z) > T.fov || this.state === 'combat';
        if (inFov && world.los(eye, chest)) this.seen = true;
      }
      if (this.seen) {
        const rate = Math.pow(Math.max(0, 1.1 - d / range), 1.5) * (this.state === 'suspicious' ? 2.4 : 1.6) * G.k;
        this.aw = Math.min(1, this.aw + Math.max(.12, rate) * dt);
        this.lastKnown.copy(P.p);
        if (this.aw >= 1) { if (this.state !== 'combat') { this.alert(P.p, true); G.onAlarm(this); } this.lastSeen = G.time; }
        else if (this.aw > .3 && this.state === 'patrol') { this.state = 'suspicious'; this.investT = 6; }
      } else if (this.state !== 'combat') this.aw = Math.max(0, this.aw - dt * .08);
    }
    pickGoal() {
      const P = G.player, T = this.T, me = this.p, toP = tmp.subVectors(this.lastKnown, me); const dist = toP.length();
      if (T.fly) { const a = Math.atan2(me.x - this.lastKnown.x, me.z - this.lastKnown.z) + rnd(-.9, .9), r = rnd(55, 95); this.goal.set(this.lastKnown.x + Math.sin(a) * r, 0, this.lastKnown.z + Math.cos(a) * r); return; }
      if (this.type === 'bulwark' || this.type === 'strider') { // advance / strafe
        const a = Math.atan2(toP.x, toP.z) + (this.type === 'strider' ? rnd(-1.4, 1.4) : rnd(-.4, .4)), step = this.type === 'strider' ? rnd(5, 10) : Math.min(dist - 18, 14);
        this.goal.set(me.x + Math.sin(a) * step, 0, me.z + Math.cos(a) * step); return;
      }
      // cover: a point behind an obstacle relative to the player
      let best = null, bs = 1e9;
      for (const c of G.coverNear(me.x, me.z, 30)) {
        const bx = c.x - this.lastKnown.x, bz = c.z - this.lastKnown.z, bl = Math.hypot(bx, bz); if (bl < 10 || bl > 60) continue;
        const cx = c.x + bx / bl * (c.r + 1.2), cz = c.z + bz / bl * (c.r + 1.2);
        if (world.depth(cx, cz) > .4) continue;
        let s = Math.hypot(cx - me.x, cz - me.z) + Math.random() * 8;
        if (this.flank) { const side = Math.abs((bx * toP.z - bz * toP.x) / (bl * dist + 1e-3)); s -= side * 20; }
        if (list.some(o => o !== this && o.alive && o.goal && Math.hypot(o.goal.x - cx, o.goal.z - cz) < 2)) s += 30;
        if (s < bs) { bs = s; best = [cx, cz]; }
      }
      if (best) this.goal.set(best[0], 0, best[1]);
      else { const a = Math.atan2(toP.x, toP.z) + (this.flank ? rnd(.9, 1.4) * (Math.random() < .5 ? -1 : 1) : rnd(-.7, .7)), r = Math.min(dist * .4, 12); this.goal.set(me.x + Math.sin(a) * r, 0, me.z + Math.cos(a) * r); }
    }
    fire() {
      const T = this.T, P = G.player, mz = this.m.root.localToWorld(this.m.muzzle.clone());
      const target = P.chest().clone(); const d = mz.distanceTo(target);
      const lead = P.vel.clone().multiplyScalar(d / T.bolt * .6); target.add(lead);
      const err = T.spread * (1 + P.vel.length() * .12) / G.k * (this.type === 'kestrel' ? 1 : 1 + Math.max(0, d - 25) / 60);
      const dir = target.sub(mz).normalize().add(new V3(rnd(-err, err), rnd(-err, err) * .7, rnd(-err, err))).normalize();
      bolts.push({ p: mz.clone(), v: dir.multiplyScalar(T.bolt), life: 3, dmg: T.dmg, from: this.p.clone(), s: fx.streak(mz, mz, this.type === 'kestrel' ? new THREE.Color(6, 1.2, 1.6) : new THREE.Color(5, 1.4, .5), this.type === 'kestrel' ? .09 : .07), kind: this.type, splash: 0 });
      audio.enemyShot(this.type, this.p.distanceTo(P.p)); fx.flash(mz, 0xff6a30, 8, 6, .05); fx.add.spawn(mz, new V3(), .07, .6, .9, 5, 1.6, .6, 1);
    }
    rockets() {
      const P = G.player;
      for (let i = 0; i < 4; i++) setTimeout(() => {
        if (!this.alive) return; const pod = this.m.root.localToWorld(this.m.pods[i % 2].clone());
        const dir = new V3(rnd(-.3, .3), 1.2, rnd(-.3, .3)).add(tmp.subVectors(P.p, pod).normalize()).normalize();
        bolts.push({ p: pod, v: dir.multiplyScalar(26), life: 6, dmg: 28, from: this.p.clone(), s: fx.streak(pod, pod, new THREE.Color(5, 2.2, .6), .16), kind: 'rocket', splash: 4.5, home: true });
        audio.enemyShot('bulwark', this.p.distanceTo(P.p)); fx.puff(pod, 3, [.8, .8, .82], .5, 1, 1);
      }, i * 180);
    }
    update(dt) {
      const T = this.T, m = this.m, P = G.player;
      this.flash = Math.max(0, this.flash - dt * 6); m.mat.userData.flash.value = this.flash * .9;
      const near = this.p.distanceTo(G.camera.position) < 70; if (near !== this.ol) { this.ol = near; for (const o of this.outlines) o.visible = near; }
      if (!this.alive) { // collapse
        this.dieT += dt;
        if (T.fly) { this.vy -= 18 * dt; this.p.y += this.vy * dt; m.root.rotation.x += dt * 3; const g = world.h(this.p.x, this.p.z); if (this.p.y < g + .4) { if (!this.crashed) { this.crashed = true; fx.explosion(this.p, .7); audio.boom(this.p.distanceTo(P.p)); } this.p.y = g + .4; this.vy = 0; } m.root.position.copy(this.p); }
        else { this.tilt = Math.min(1.45, this.tilt + dt * (2 + this.tilt * 4)); m.root.rotation.z = this.tilt * this.fallDir * (this.type === 'strider' ? .4 : 1); if (m.root.children[0]) m.root.position.y = this.p.y - this.tilt * .1; }
        return;
      }
      if (this.dropping) { this.vy -= 14 * dt; this.p.y += this.vy * dt; const g = world.h(this.p.x, this.p.z); if (this.p.y <= g) { this.p.y = g; this.dropping = false; fx.puff(this.p, 8, [.75, .65, .5], .8, .5, 1.2, 2); audio.land(); } m.root.position.copy(this.p); m.root.rotation.y = this.yaw; return; }
      this.think -= dt; if (this.think <= 0) { this.think = .22; this.perceive(.22); }
      // state machine → movement goal + speed
      let speed = 0, face = null;
      if (this.state === 'patrol') {
        const g = this.route[this.ri]; tmp.set(g.x - this.p.x, 0, g.z - this.p.z);
        if (tmp.length() < 1.5) { this.wait -= dt; if (this.wait <= 0) { this.ri = (this.ri + 1) % this.route.length; this.wait = rnd(1.5, 4); } }
        else { this.goal.copy(g); speed = T.walk; }
      } else if (this.state === 'suspicious') {
        face = this.lastKnown; this.investT -= dt;
        if (this.aw > .5) { this.goal.copy(this.lastKnown); speed = T.walk * .8; }
        if (this.investT <= 0) { this.state = 'patrol'; }
      } else if (this.state === 'combat') {
        const sinceSeen = G.time - this.lastSeen;
        this.repick -= dt;
        if (this.repick <= 0) { this.pickGoal(); this.repick = T.fly ? rnd(5, 8) : rnd(3, 6); }
        if (sinceSeen > 7 && !this.searching) { this.searching = true; this.goal.copy(this.lastKnown).add(new V3(rnd(-8, 8), 0, rnd(-8, 8))); }
        if (sinceSeen < 2) this.searching = false;
        speed = this.tele > 0 || this.shots > 0 ? (T.fly ? T.walk : 0) : T.run;
        face = this.seen ? P.p : (tmp2.set(this.goal.x, 0, this.goal.z));
        // attack cycle
        this.cool -= dt;
        const dP = this.p.distanceTo(P.p);
        if (this.cool <= 0 && this.tele <= 0 && this.shots <= 0 && this.seen && dP < T.range) { this.tele = T.tele / Math.sqrt(G.k); audio.charge(dP, this.type === 'kestrel' ? 300 : this.type === 'bulwark' ? 120 : 600); if (this.type === 'kestrel') audio.laser(dP); }
        if (this.tele > 0) {
          this.tele -= dt; m.mat.userData.glow.value = 5 + (1 - this.tele / T.tele) * 14;
          if (this.type === 'kestrel') { const mz = m.root.localToWorld(m.muzzle.clone()), tgt = P.chest().clone().add(new V3(Math.sin(G.time * 7) * .4, Math.cos(G.time * 5) * .3, 0).multiplyScalar(this.tele)); const end = tmp.subVectors(tgt, mz).normalize().multiplyScalar(mz.distanceTo(tgt) + 30).add(mz);
            const hit = world.ray(mz, tmp2.subVectors(end, mz).normalize(), mz.distanceTo(end), { trees: true }); if (hit) end.copy(hit.p);
            if (this.laser < 0) this.laser = fx.streak(mz, end, new THREE.Color(8, .4, .4), .025); else fx.setStreak(this.laser, mz, end); }
          if (this.tele <= 0) { m.mat.userData.glow.value = 5; if (this.laser >= 0) { fx.freeStreak(this.laser); this.laser = -1; } if (this.seen || this.type !== 'kestrel') { this.shots = T.burst; this.shotT = 0; } this.cool = rnd(...T.cool) / G.k; }
        }
        if (this.shots > 0) { this.shotT -= dt; if (this.shotT <= 0) { this.shotT = T.gap; this.shots--; this.fire(); } }
        if (this.type === 'bulwark') { this.rocketT -= dt; if (this.rocketT <= 0 && this.seen && dP > 12) { this.rocketT = rnd(8, 11) / G.k; this.rockets(); for (let i = 0; i < 3; i++) setTimeout(() => audio.beep(i === 2), i * 150); } }
      }
      // move
      tmp.set(this.goal.x - this.p.x, 0, this.goal.z - this.p.z); const dist = tmp.length();
      if (dist < 1.2) speed = 0;
      this.speed += (speed - this.speed) * Math.min(1, dt * 4);
      if (this.speed > .05 && dist > .01) {
        tmp.divideScalar(dist);
        if (this.stuck > .6) { const s = this.stuckSide || 1; tmp.set(tmp.x * .3 - tmp.z * s, 0, tmp.z * .3 + tmp.x * s).normalize(); }
        const nx = this.p.x + tmp.x * this.speed * dt, nz = this.p.z + tmp.z * this.speed * dt;
        if (T.fly || world.depth(nx, nz) < .6) {
          const prev = this.p.clone(); this.p.x = nx; this.p.z = nz;
          if (!T.fly) { world.collide(this.p, T.radius, this.p.y, T.height); }
          const moved = Math.hypot(this.p.x - prev.x, this.p.z - prev.z);
          if (moved < this.speed * dt * .4) { this.stuck += dt; if (this.stuck > .6 && !this.stuckSide) this.stuckSide = Math.random() < .5 ? -1 : 1; if (this.stuck > 2.5) { this.stuck = 0; this.stuckSide = 0; this.repick = 0; this.ri = (this.ri + 1) % this.route.length; } }
          else if (this.stuck > 0) { this.stuck = Math.max(0, this.stuck - dt * .5); if (this.stuck === 0) this.stuckSide = 0; }
        } else { this.repick = 0; this.ri = (this.ri + 1) % this.route.length; }
        if (!face) face = tmp2.set(this.p.x + tmp.x, 0, this.p.z + tmp.z);
      }
      // ground / hover
      const g = world.h(this.p.x, this.p.z);
      if (T.fly) { const want = Math.max(g, world.waterY(this.p.x, this.p.z)) + (this.state === 'combat' ? 18 : 24) + Math.sin(G.time * .8 + this.phase) * 1.2; this.p.y += (want - this.p.y) * Math.min(1, dt * 1.5); }
      else this.p.y = world.groundAt(this.p.x, this.p.z, this.p.y + .5);
      if (face) { const want = Math.atan2(face.x - this.p.x, face.z - this.p.z); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * (this.type === 'bulwark' ? 1.6 : 5)); }
      m.root.position.copy(this.p); m.root.rotation.y = this.yaw;
      // animation
      const sp = this.speed; this.phase += dt * (2.2 + sp * 2.4);
      if (this.type === 'picket' || this.type === 'bulwark') {
        const a = Math.min(1, sp / 2) * (this.type === 'bulwark' ? .45 : .6), s = Math.sin(this.phase);
        m.legs[0].t.rotation.x = s * a; m.legs[1].t.rotation.x = -s * a; m.legs[0].k.rotation.x = Math.max(0, -s) * a * 1.4; m.legs[1].k.rotation.x = Math.max(0, s) * a * 1.4;
        m.upper.position.y = (this.type === 'bulwark' ? 2.65 : 1) + Math.abs(Math.cos(this.phase)) * a * .07 - (this.tele > 0 ? .04 : 0);
        m.upper.rotation.x = this.tele > 0 ? -.05 : 0; m.upper.rotation.z = Math.sin(this.phase) * a * .05;
        if (this.type === 'bulwark' && sp > .3 && Math.sin(this.phase) * Math.sin(this.phase - dt * 4) < 0) { const d = this.p.distanceTo(P.p); if (d < 30) fx.shake(.12 * (1 - d / 30)); }
      } else if (this.type === 'strider') {
        const a = Math.min(1, sp / 2.5) * .5;
        m.legs.forEach((L, i) => { const ph = this.phase * 1.4 + (i === 0 || i === 3 ? 0 : Math.PI); L.u.rotation.z = .55 + Math.max(0, Math.sin(ph)) * a; L.u.rotation.y = Math.cos(ph) * a * .6; });
        m.body.position.y = .95 + Math.sin(this.phase * 2.8) * .03 * (a > 0 ? 1 : 0);
        if (this.state === 'combat' && this.seen) { const want = Math.atan2(P.p.x - this.p.x, P.p.z - this.p.z) - this.yaw; m.turret.rotation.y += (Math.atan2(Math.sin(want), Math.cos(want)) - m.turret.rotation.y) * Math.min(1, dt * 6); } else m.turret.rotation.y *= .97;
      } else if (this.type === 'kestrel') { m.root.rotation.z = Math.sin(G.time * 1.3 + this.phase) * .08; m.root.rotation.x = Math.min(.25, sp * .02); }
    }
  }
  E.spawn = (type, x, z, o) => new Enemy(type, x, z, o);
  E.clear = () => { for (const e of list) e.remove(); list.length = 0; for (const b of bolts) fx.freeStreak(b.s); bolts.length = 0; for (const s of ships) scene.remove(s.m.root); ships.length = 0; E.alarm = false; };
  // ray/segment vs enemy hit spheres → closest
  E.hitTest = (a, b) => {
    let best = null; const ab = tmp.subVectors(b, a), L = ab.length(); if (L < 1e-6) return null; const d = ab.clone().divideScalar(L);
    for (const e of list) {
      if (!e.alive || e.dropping) continue; if (e.p.distanceTo(a) > L + 8) continue;
      for (const h of e.hits()) { const oc = tmp2.subVectors(a, h.c), bq = oc.dot(d), cq = oc.lengthSq() - h.r * h.r, disc = bq * bq - cq; if (disc < 0) continue; const t = -bq - Math.sqrt(disc); if (t < 0 || t > L) continue; if (!best || t < best.t || (h.crit && Math.abs(t - best.t) < .3)) best = { e, t, crit: h.crit, p: a.clone().addScaledVector(d, t) }; }
    }
    return best;
  };
  E.noise = (pos, radius, loud) => { for (const e of list) { if (!e.alive) continue; const d = e.p.distanceTo(pos); if (d > radius) continue; if (loud && d < radius * .45) e.alert(G.player.p.clone().add(new V3(rnd(-6, 6), 0, rnd(-6, 6))), true); else e.alert(pos.clone().add(new V3(rnd(-10, 10), 0, rnd(-10, 10))), false); } };
  // reinforcement dropship
  E.dropship = (tx, tz, n = 3, types = ['picket']) => {
    const m = hauler(); scene.add(m.root);
    const a = Math.atan2(tx, tz) + rnd(-.6, .6), from = new V3(Math.sin(a) * 340, 90, Math.cos(a) * 340);
    const s = { m, p: from, target: new V3(tx, world.h(tx, tz) + 14, tz), phase: 'in', t: 0, n, types, em: [] };
    m.root.position.copy(from); ships.push(s);
    for (const sx of [-3.1, 3.1]) s.em.push(fx.emitter({ p: from, life: 60, rate: 18, kind: 'fire', size: 1.6, follow: (() => { const o = new THREE.Object3D(); o.position.set(sx, -1.1, 0); m.root.add(o); return o; })() }));
    G.onDropship && G.onDropship(s); return s;
  };
  E.update = (dt) => {
    for (const e of list) e.update(dt);
    // remove old wrecks
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].alive && list[i].dieT > 25) { list[i].remove(); list.splice(i, 1); }
    const P = G.player;
    // bolts
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.life -= dt;
      if (b.home) { const want = tmp.subVectors(P.chest(), b.p).normalize().multiplyScalar(b.v.length()); b.v.lerp(want, Math.min(1, dt * .9)); fx.puff(b.p, 1, [.85, .85, .88], .3, .2, .7, .1); }
      const a = b.p.clone(), nb = b.p.clone().addScaledVector(b.v, dt); const L = a.distanceTo(nb), dir = tmp2.subVectors(nb, a).normalize().clone();
      let hit = world.ray(a, dir, L, { trees: true }), hitP = false;
      // player capsule test
      if (P.alive) { const c = P.chest(); const oc = tmp.subVectors(a, c), bq = oc.dot(dir), t = Math.max(0, Math.min(L, -bq)); const cl = a.clone().addScaledVector(dir, t); const dy = cl.y - c.y; const r = Math.hypot(cl.x - c.x, cl.z - c.z);
        if (r < .42 && dy > -1.1 && dy < .55 && (!hit || t < hit.t)) { hitP = true; hit = { t, p: cl, n: dir.clone().negate(), kind: 'player' }; }
        else if (t > 0 && t < L && r < 2.2 && !b.whiz && Math.abs(dy) < 2) { b.whiz = true; G.onWhiz && G.onWhiz(b); } }
      if (hit || b.life <= 0) {
        if (hit) {
          if (b.splash) { fx.explosion(hit.p, .7); audio.boom(hit.p.distanceTo(P.p)); const d = hit.p.distanceTo(P.chest()); if (d < b.splash && P.alive) G.hurtPlayer(b.dmg * (1 - d / b.splash * .6), b.from); fx.shake(Math.max(0, .5 - d / 30)); }
          else if (hitP) G.hurtPlayer(b.dmg, b.from);
          else { fx.impact(hit, dir); fx.add.spawn(hit.p, new V3(), .1, .6, 1.2, 5, 1.5, .5, 1); }
        }
        fx.freeStreak(b.s); bolts.splice(i, 1); continue;
      }
      b.p.copy(nb); const tail = b.p.clone().addScaledVector(dir, -Math.min(b.kind === 'kestrel' ? 9 : 2.6, b.v.length() * .04)); fx.setStreak(b.s, b.p, tail);
    }
    // dropships
    for (let i = ships.length - 1; i >= 0; i--) {
      const s = ships[i], m = s.m; s.t += dt;
      if (s.phase === 'in') { tmp.subVectors(s.target, s.p); const d = tmp.length(); const v = Math.min(40, d * .8 + 4); s.p.addScaledVector(tmp.normalize(), Math.min(d, v * dt)); m.root.rotation.y = Math.atan2(tmp.x, tmp.z); m.root.rotation.x = Math.min(.3, v / 120); if (d < .8) { s.phase = 'drop'; s.t = 0; } }
      else if (s.phase === 'drop') { m.root.rotation.x *= .95; if (s.t > .8 && s.n > 0 && s.t > .8 + (3 - s.n) * .5) { const e = E.spawn(s.types[s.n % s.types.length], s.p.x + rnd(-2, 2), s.p.z + rnd(-2, 2), { dropping: true }); e.p.y = s.p.y - 1.5; e.alert(P.p, true); s.n--; } if (s.t > 3.5) { s.phase = 'out'; s.t = 0; } }
      else { s.p.y += dt * (6 + s.t * 6); s.p.addScaledVector(new V3(Math.sin(m.root.rotation.y), 0, Math.cos(m.root.rotation.y)), dt * (10 + s.t * 12)); if (s.t > 14) { scene.remove(m.root); for (const e of s.em) e.life = 0; ships.splice(i, 1); continue; } }
      m.root.position.copy(s.p); m.root.position.y += Math.sin(G.time * 2) * .2;
    }
  };
  return E;
}
