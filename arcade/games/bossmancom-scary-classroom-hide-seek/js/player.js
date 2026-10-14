import * as THREE from '../vendor/three.module.js';

const STAND_EYE = 1.65;
const CROUCH_EYE = 0.85;
const SNEAK_EYE = 1.45;
const WALK_SPEED = 3.6;
const SPRINT_SPEED = 6.2;
const CROUCH_SPEED = 1.7;
const SNEAK_SPEED = 2.0;
const MOUSE_SENS = 0.0022;
const TOUCH_LOOK_SENS = 0.0035;

export class Player {
  constructor(camera, world, audio) {
    this.camera = camera;
    this.world = world;
    this.audio = audio;

    this.position = new THREE.Vector3(0, 0, 5);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.keys = {
      forward: false,
      back: false,
      left: false,
      right: false,
      sprint: false,
      crouch: false,
      sneak: false,
      interact: false,
    };

    /** Virtual stick axes -1..1 (mobile / gamepad-style) */
    this.moveAxis = { x: 0, y: 0 };

    this.isCrouching = false;
    this.isSneaking = false;
    this.insideSpot = null;
    this.locked = false;
    this.noise = 0;
    this.enabled = false;
    this._eyeHeight = STAND_EYE;
    this._targetEye = STAND_EYE;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    Object.keys(this.keys).forEach((k) => (this.keys[k] = false));
    this.moveAxis.x = 0;
    this.moveAxis.y = 0;
  }

  reset(pos = new THREE.Vector3(0, 0, 5)) {
    this.position.copy(pos);
    this.yaw = Math.PI;
    this.pitch = 0;
    this.isCrouching = false;
    this.isSneaking = false;
    this.insideSpot = null;
    this.locked = false;
    this.noise = 0;
    this.moveAxis.x = 0;
    this.moveAxis.y = 0;
    this._eyeHeight = STAND_EYE;
    this._targetEye = STAND_EYE;
    this._applyCamera();
  }

  /** Mobile / UI: set stick (-1..1). y>0 = forward */
  setMoveAxis(x, y) {
    this.moveAxis.x = THREE.MathUtils.clamp(x, -1, 1);
    this.moveAxis.y = THREE.MathUtils.clamp(y, -1, 1);
  }

  setSprint(on) {
    this.keys.sprint = !!on;
  }

  setCrouch(on) {
    this.keys.crouch = !!on;
  }

  setSneak(on) {
    this.keys.sneak = !!on;
  }

  /** Look delta from touch drag (pixels) */
  applyLookDelta(dx, dy, sens = TOUCH_LOOK_SENS) {
    if (!this.enabled) return;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.4, 1.4);
  }

  tryInteract() {
    this._tryInteract();
  }

  _onKeyDown(e) {
    if (!this.enabled) return;
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.back = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = true;
        break;
      case 'Space':
        e.preventDefault();
        this.keys.crouch = true;
        break;
      case 'KeyC':
      case 'ControlLeft':
      case 'ControlRight':
        this.keys.sneak = true;
        break;
      case 'KeyE':
        if (!this.keys.interact) this._tryInteract();
        this.keys.interact = true;
        break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.back = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = false;
        break;
      case 'Space':
        this.keys.crouch = false;
        break;
      case 'KeyC':
      case 'ControlLeft':
      case 'ControlRight':
        this.keys.sneak = false;
        break;
      case 'KeyE':
        this.keys.interact = false;
        break;
    }
  }

  _onMouseMove(e) {
    if (!this.enabled || !document.pointerLockElement) return;
    this.yaw -= e.movementX * MOUSE_SENS;
    this.pitch -= e.movementY * MOUSE_SENS;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.4, 1.4);
  }

  _tryInteract() {
    if (!this.enabled) return;
    if (this.insideSpot) {
      this.position.copy(this.insideSpot.exitPos);
      this.insideSpot.inside = false;
      this.insideSpot = null;
      this.locked = false;
      this.audio?.lockerCreak();
      return;
    }

    const spot = this.world.nearestInteractable(this.position, 1.85);
    if (spot && spot.enterable) {
      spot.inside = true;
      this.insideSpot = spot;
      this.locked = true;
      this.position.copy(spot.enterPos);
      this.isCrouching = true;
      if (spot.lookDir) {
        this.yaw = Math.atan2(-spot.lookDir.x, -spot.lookDir.z);
      }
      this.pitch = 0;
      this.audio?.lockerCreak();
    }
  }

  get cover() {
    return this.world.getHideCover(
      this.position,
      this.isCrouching || this.isSneaking,
      this.insideSpot
    );
  }

  get isHidden() {
    return this.cover >= 0.9 || !!this.insideSpot;
  }

  get headPosition() {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + this._eyeHeight,
      this.position.z
    );
  }

  update(dt) {
    if (!this.enabled) return;

    if (this.insideSpot) {
      this.isCrouching = true;
      this.isSneaking = false;
    } else {
      this.isCrouching = this.keys.crouch;
      // Sneak works while walking; crouch overrides posture
      this.isSneaking = this.keys.sneak && !this.isCrouching;
    }

    if (this.isCrouching) this._targetEye = CROUCH_EYE;
    else if (this.isSneaking) this._targetEye = SNEAK_EYE;
    else this._targetEye = STAND_EYE;

    this._eyeHeight += (this._targetEye - this._eyeHeight) * Math.min(1, dt * 10);

    let moving = false;
    let isSprint = false;
    let isSneakMove = false;

    if (!this.locked) {
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(
        Math.sin(this.yaw + Math.PI / 2),
        0,
        Math.cos(this.yaw + Math.PI / 2)
      );

      const wish = new THREE.Vector3();
      if (this.keys.forward) wish.add(forward);
      if (this.keys.back) wish.sub(forward);
      if (this.keys.left) wish.sub(right);
      if (this.keys.right) wish.add(right);

      // Virtual stick
      if (Math.abs(this.moveAxis.x) > 0.08 || Math.abs(this.moveAxis.y) > 0.08) {
        wish.addScaledVector(forward, this.moveAxis.y);
        wish.addScaledVector(right, this.moveAxis.x);
      }

      if (wish.lengthSq() > 0) {
        wish.normalize();
        moving = true;
        isSprint =
          this.keys.sprint && !this.isCrouching && !this.isSneaking;
        isSneakMove = this.isSneaking || this.isCrouching;

        let speed = WALK_SPEED;
        if (this.isCrouching) speed = CROUCH_SPEED;
        else if (this.isSneaking) speed = SNEAK_SPEED;
        else if (isSprint) speed = SPRINT_SPEED;

        // Stick magnitude scales speed a bit
        const stickMag = Math.hypot(this.moveAxis.x, this.moveAxis.y);
        if (stickMag > 0.08) {
          speed *= THREE.MathUtils.clamp(stickMag, 0.35, 1);
        }

        this.position.addScaledVector(wish, speed * dt);
      }

      const height = this.isCrouching ? 1.0 : 1.7;
      this.position.copy(this.world.resolveCollision(this.position, 0.3, height));
    }

    // Noise model
    let targetNoise = 0;
    if (moving) {
      if (this.isCrouching) targetNoise = 0.12;
      else if (this.isSneaking) targetNoise = 0.14;
      else if (isSprint) targetNoise = 1.0;
      else targetNoise = 0.5;
    }
    if (this.insideSpot) targetNoise = Math.min(targetNoise, 0.05);

    this.noise += (targetNoise - this.noise) * Math.min(1, dt * 6);

    this.audio?.updateFootsteps(
      dt,
      moving && !this.locked,
      isSprint,
      isSneakMove
    );
    this._applyCamera();
  }

  _applyCamera() {
    this.camera.position.set(
      this.position.x,
      this.position.y + this._eyeHeight,
      this.position.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
  }
}
