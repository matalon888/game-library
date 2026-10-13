/* ============================================================
   First-person controller running Minecraft's own movement model.

   Minecraft physics is TICK based, not frame based: twenty fixed
   steps a second, velocities in blocks-per-tick, and a specific
   order of operations. Run the same arithmetic per frame and you
   get different speeds on different monitors, so this accumulates
   time and steps a fixed 20 Hz tick, interpolating the camera
   between ticks so it still looks smooth at any frame rate.

   Constants and order of operations follow the documented model
   (see README). Cross-checked against the published figures:
   walk 4.317 blocks/s, sprint 5.612, sneak 1.295, jump 1.2522
   blocks high. `selfTest()` measures all four.

   Reference implementation for the same model: PrismarineJS's
   prismarine-physics (MIT).
   ============================================================ */
import * as THREE from "three";
import { isSolid, isPassable, B } from "./blocks.js";

export const TPS = 20, TICK = 1 / TPS;

/* ---- Minecraft's numbers, in blocks and blocks-per-tick ---- */
export const MC = {
  gravity: 0.08,            // subtracted from vy each tick
  drag: 0.98,               // then vy is multiplied by this
  slipperiness: 0.6,        // default ground block
  airFriction: 0.91,        // horizontal decay in air
  baseAccel: 0.1,           // ground acceleration before slipperiness term
  airAccel: 0.02,
  inputScale: 0.98,         // the player's own input is scaled by this
  sprintMul: 1.3,
  sneakMul: 0.3,
  jump: 0.42,               // upward velocity on jump
  sprintJumpBoost: 0.2,     // forward kick when jumping while sprinting
  stepHeight: 0.6,          // a full block still needs a jump — as it should
  height: 1.8, halfWidth: 0.3, eye: 1.62, sneakEye: 1.54,
  waterDrag: 0.8, waterGravity: 0.02, waterAccel: 0.02,
  flySpeed: 0.55, flyDrag: 0.90
};
const EPS = 1e-4;

export class Player {
  /* `headless` skips DOM binding — used by selfTest, which builds a
     throwaway player and must not attach input listeners of its own. */
  constructor(camera, dom, world, headless) {
    this.cam = camera; this.dom = dom; this.world = world;
    this.pos = new THREE.Vector3(0, 40, 0);
    this.prev = this.pos.clone();
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = -0.15;
    this.grounded = false; this.sneaking = false; this.sprinting = false;
    this.blocked = false; this.scrambling = false;
    this.flying = false; this.inWater = false;
    this.bob = 0; this.phase = 0;
    this.keys = Object.create(null);
    this.locked = false;
    this.sensitivity = 0.0022;
    this.invertY = false;
    this.bobEnabled = true;
    this.acc = 0;
    this.onFootstep = null; this.onLockChange = null;
    if (!headless) this._bind();
  }

  _bind() {
    this.dom.addEventListener("click", () => { if (!this.locked) this.dom.requestPointerLock(); });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.sensitivity;
      const dy = e.movementY * this.sensitivity * (this.invertY ? -1 : 1);
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy));
    });
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (["Space", "Tab", "KeyE", "KeyF", "KeyJ"].includes(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => { this.keys[e.code] = false; });
    window.addEventListener("blur", () => { this.keys = Object.create(null); });
  }

  spawnOn(x, z) {
    const h = this.world.heightAt(Math.floor(x), Math.floor(z));
    this.pos.set(x + 0.5, h + 1.4, z + 0.5);
    this.prev.copy(this.pos);
    this.vx = this.vy = this.vz = 0;
    this.acc = 0;
  }
  get eyeY() { return this.pos.y + (this.sneaking ? MC.sneakEye : MC.eye) + this.bob; }
  toggleFly() { this.flying = !this.flying; this.vy = 0; return this.flying; }

  solidAt(x, y, z) {
    const id = this.world.get(x, y, z);
    return isSolid(id) && !isPassable(id);
  }
  /* slipperiness of whatever is underfoot */
  groundSlip() {
    const y = Math.floor(this.pos.y - 0.1);
    const id = this.world.get(Math.floor(this.pos.x), y, Math.floor(this.pos.z));
    return id === B.WATER ? MC.slipperiness : MC.slipperiness;   // no ice in this world yet
  }

  /* ---------------- the frame: accumulate, tick, interpolate ---------------- */
  update(dt) {
    this.acc += dt;
    let steps = 0;
    while (this.acc >= TICK && steps < 5) { this.acc -= TICK; this.tick(); steps++; }
    if (steps === 5) this.acc = 0;                       // never spiral

    const a = Math.max(0, Math.min(1, this.acc / TICK));
    const ix = this.prev.x + (this.pos.x - this.prev.x) * a;
    const iy = this.prev.y + (this.pos.y - this.prev.y) * a;
    const iz = this.prev.z + (this.pos.z - this.prev.z) * a;

    const planar = Math.hypot(this.vx, this.vz) * TPS;
    this.cam.position.set(ix, iy + (this.sneaking ? MC.sneakEye : MC.eye) + this.bob, iz);
    this.cam.rotation.order = "YXZ";
    this.cam.rotation.set(this.pitch, this.yaw, Math.sin(this.phase) * 0.005 * (planar > 0.6 ? 1 : 0));
  }

  /* ---------------- one Minecraft tick ---------------- */
  tick() {
    this.prev.copy(this.pos);
    const k = this.locked ? this.keys : Object.create(null);

    let fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    let str = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    this.sneaking = !this.flying && !!(k.ControlLeft || k.KeyC);
    this.sprinting = !!(k.ShiftLeft || k.ShiftRight) && fwd > 0 && !this.sneaking;

    this.inWater = this.world.get(Math.floor(this.pos.x),
                                  Math.floor(this.pos.y + 0.4),
                                  Math.floor(this.pos.z)) === B.WATER;

    if (this.flying) { this._flyTick(fwd, str, k); return; }

    /* 1. the player's own input is scaled, then sneak/sprint applied */
    let inF = fwd * MC.inputScale, inS = str * MC.inputScale;
    if (this.sneaking) { inF *= MC.sneakMul; inS *= MC.sneakMul; }

    /* 2. jump, before the move — a sprint jump also kicks you forward */
    if (k.Space && this.grounded && !this.inWater) {
      this.vy = MC.jump;
      if (this.sprinting) {
        this.vx += -Math.sin(this.yaw) * MC.sprintJumpBoost;
        this.vz += -Math.cos(this.yaw) * MC.sprintJumpBoost;
      }
      this.grounded = false;
    } else if (k.Space && this.inWater) {
      this.vy += 0.04;
    }

    /* 3. acceleration: on the ground it depends on what you are standing on */
    const slip = this.groundSlip();
    let accel;
    if (this.inWater) accel = MC.waterAccel;
    else if (this.grounded) accel = MC.baseAccel * (0.6 / slip) * (0.6 / slip) * (0.6 / slip);
    else accel = MC.airAccel;
    if (this.sprinting) accel *= MC.sprintMul;

    this._accelerate(inS, inF, accel);

    /* 4. move, resolving Y then X then Z */
    this.grounded = false;
    this.blocked = false;
    this._moveY(this.vy);
    this._moveX(this.vx);
    this._moveZ(this.vz);

    /* Scrambling out of a cut. Below the old ground surface, pressed against
       a face, holding jump climbs it — which is what people actually do to
       get out of a trench, and it means a deep sondage is never a trap. */
    this.scrambling = false;
    if (k.Space && this._wallNear() && this.world.surfaceAt) {
      /* surfaceAt gives the INDEX of the top solid block; you stand on top of
         it, one metre higher. Comparing against the index stops the climb a
         block and a half below the rim. */
      const rim = this.world.surfaceAt(Math.floor(this.pos.x), Math.floor(this.pos.z)) + 1;
      const below = rim - this.pos.y;
      /* only inside a cut — the height field already follows the river bed,
         so this cannot be used to climb natural ground */
      if (below > 0.6) {
        this.vy = Math.max(this.vy, 0.34);
        /* a nudge over the lip — without it you crest the wall, lose contact
           with it, and drop back down the shaft you were climbing */
        this.vx += -Math.sin(this.yaw) * 0.055;
        this.vz += -Math.cos(this.yaw) * 0.055;
        this.scrambling = true;
      }
    }

    /* 5. gravity and drag, then horizontal friction — in that order */
    if (this.inWater) {
      this.vy = (this.vy - MC.waterGravity) * MC.waterDrag;
      this.vx *= MC.waterDrag; this.vz *= MC.waterDrag;
    } else {
      this.vy = (this.vy - MC.gravity) * MC.drag;
      const f = this.grounded ? slip * MC.airFriction : MC.airFriction;
      this.vx *= f; this.vz *= f;
    }
    if (Math.abs(this.vx) < 1e-5) this.vx = 0;
    if (Math.abs(this.vz) < 1e-5) this.vz = 0;

    this._bobAndSteps();
  }

  /* Minecraft's moveRelative: normalise only when the input exceeds one */
  _accelerate(strafe, forward, accel) {
    let d = strafe * strafe + forward * forward;
    if (d < 1e-4) return;
    d = Math.sqrt(d);
    if (d < 1) d = 1;
    const f = accel / d;
    const s = strafe * f, w = forward * f;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    this.vx += -sin * w + cos * s;
    this.vz += -cos * w - sin * s;
  }

  _flyTick(fwd, str, k) {
    this._accelerate(str, fwd, MC.flySpeed * (k.ShiftLeft ? 2 : 1));
    const rise = (k.Space ? 1 : 0) - ((k.ControlLeft || k.KeyC) ? 1 : 0);
    this.vy += rise * MC.flySpeed * 0.9;
    this._moveY(this.vy); this._moveX(this.vx); this._moveZ(this.vz);
    this.vx *= MC.flyDrag; this.vy *= MC.flyDrag; this.vz *= MC.flyDrag;
    this.bob += (0 - this.bob) * 0.25;
  }

  _bobAndSteps() {
    const planar = Math.hypot(this.vx, this.vz);
    if (this.grounded && planar > 0.03) {
      const prev = this.phase;
      this.phase += planar * 1.9;
      this.bob = this.bobEnabled ? Math.sin(this.phase) * 0.045 * (this.sneaking ? 0.4 : 1) : 0;
      if (Math.floor(prev / Math.PI) !== Math.floor(this.phase / Math.PI) && this.onFootstep)
        this.onFootstep(this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z)));
    } else this.bob *= 0.82;
  }

  /* ---------------- collision, one axis at a time ---------------- */
  /* Is there a face within arm's reach? Collision resolution cannot answer
     this: once a wall has zeroed your velocity you stop colliding with it,
     so the flag it sets goes quiet exactly when you need it. */
  _wallNear() {
    const p = this.pos, r = 0.45;
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]])
      for (const dy of [0.15, 0.6, 1.4])
        if (this.solidAt(Math.floor(p.x + dx), Math.floor(p.y + dy), Math.floor(p.z + dz))) return true;
    return false;
  }

  _hits() {
    const p = this.pos;
    const x0 = Math.floor(p.x - MC.halfWidth), x1 = Math.floor(p.x + MC.halfWidth);
    const z0 = Math.floor(p.z - MC.halfWidth), z1 = Math.floor(p.z + MC.halfWidth);
    const y0 = Math.floor(p.y + EPS), y1 = Math.floor(p.y + MC.height - EPS);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++)
          if (this.solidAt(x, y, z)) return true;
    return false;
  }
  _moveY(dy) {
    if (!dy) return;
    this.pos.y += dy;
    if (!this._hits()) return;
    if (dy < 0) { this.pos.y = Math.floor(this.pos.y) + 1; this.grounded = true; }
    else this.pos.y = Math.ceil(this.pos.y + MC.height) - MC.height - 1 - EPS;
    this.vy = 0;
  }
  _moveX(dx) {
    if (!dx) return;
    const y0 = this.pos.y;
    this.pos.x += dx;
    if (!this._hits()) return;
    if (this._step(y0)) return;
    this.pos.x = dx > 0 ? Math.floor(this.pos.x + MC.halfWidth) - MC.halfWidth - EPS
                        : Math.floor(this.pos.x - MC.halfWidth) + 1 + MC.halfWidth + EPS;
    this.vx = 0; this.blocked = true;
  }
  _moveZ(dz) {
    if (!dz) return;
    const y0 = this.pos.y;
    this.pos.z += dz;
    if (!this._hits()) return;
    if (this._step(y0)) return;
    this.pos.z = dz > 0 ? Math.floor(this.pos.z + MC.halfWidth) - MC.halfWidth - EPS
                        : Math.floor(this.pos.z - MC.halfWidth) + 1 + MC.halfWidth + EPS;
    this.vz = 0; this.blocked = true;
  }
  /* auto-step, but only stepHeight — a whole block still needs a jump */
  _step(y0) {
    if (!this.grounded && !this.inWater) return false;
    for (let lift = 0.1; lift <= MC.stepHeight + 1e-9; lift += 0.1) {
      this.pos.y = y0 + lift;
      if (!this._hits()) return true;
    }
    this.pos.y = y0;
    return false;
  }

  /* ---------------- verification ----------------
     Runs the model on a flat floor and reports the figures that can
     be checked against the published ones. */
  selfTest() {
    const flat = { get: (x, y, z) => (y < 40 ? B.STONE : B.AIR), heightAt: () => 39 };
    const sub = new Player({ position: new THREE.Vector3(), rotation: { order: "", set() {} } },
                           null, flat, true);
    /* each run resets the same throwaway player and returns the measured
       speed straight away — returning the object would hand back whatever
       state the LAST run left behind */
    /* Measure DISTANCE TRAVELLED, not the velocity left in the field.
       Friction is applied at the end of a tick, so the stored velocity is
       always the post-friction value — the distance actually covered per
       tick is that plus the next tick's acceleration, and it is the
       distance that the published blocks-per-second figures describe. */
    const speedAfter = (keys, settle) => {
      sub.pos.set(0.5, 40, 0.5); sub.prev.copy(sub.pos);
      sub.vx = sub.vy = sub.vz = 0; sub.yaw = 0; sub.locked = true;
      sub.grounded = false;
      sub.keys = Object.assign(Object.create(null), keys);
      for (let i = 0; i < settle; i++) sub.tick();
      const x0 = sub.pos.x, z0 = sub.pos.z, N = 100;
      for (let i = 0; i < N; i++) sub.tick();
      return +(Math.hypot(sub.pos.x - x0, sub.pos.z - z0) / N * TPS).toFixed(4);
    };
    const walk = speedAfter({ KeyW: true }, 200);
    const sprint = speedAfter({ KeyW: true, ShiftLeft: true }, 200);
    const sneak = speedAfter({ KeyW: true, KeyC: true }, 200);

    /* jump apex from a standing start */
    sub.pos.set(0.5, 40, 0.5); sub.prev.copy(sub.pos);
    sub.vx = sub.vy = sub.vz = 0; sub.grounded = false;
    sub.keys = Object.create(null);
    for (let i = 0; i < 5; i++) sub.tick();
    sub.keys.Space = true; sub.tick(); sub.keys.Space = false;
    let apex = sub.pos.y - 40;
    for (let i = 0; i < 40; i++) { sub.tick(); apex = Math.max(apex, sub.pos.y - 40); }

    return {
      walk, sprint, sneak,
      jump: +apex.toFixed(4)
    };
  }
}
