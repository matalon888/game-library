import * as THREE from '../vendor/three.module.js';

const STATES = {
  PATROL: 'patrol',
  INVESTIGATE: 'investigate',
  CHASE: 'chase',
  SEARCH: 'search',
  CHECK_LOCKER: 'check_locker',
};

/**
 * Tall distorted seeker — narrow FOV cone, patrols, randomly opens lockers.
 */
export class Seeker {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    this.position = new THREE.Vector3(6, 0, -5);
    this.yaw = 0;
    this.state = STATES.PATROL;
    this.patrolSpeed = 2.2;
    this.chaseSpeed = 4.0;
    this.investigateSpeed = 3.0;

    this.patrolIndex = 0;
    this.target = null;
    this.lastKnown = null;
    this.stateTimer = 0;
    this.searchYaw = 0;
    this.detection = 0;
    this.catchRange = 1.15;

    // Narrow flashlight-style FOV
    this.viewDistance = 11;
    this.viewHalfAngleDeg = 28; // half-angle → ~56° total cone
    this.viewAngle = Math.cos(THREE.MathUtils.degToRad(this.viewHalfAngleDeg));
    this.hearRadius = 11;

    this.checkCooldown = 4;
    this.checkTimer = 2 + Math.random() * 3;
    this.checkSpot = null;
    this.checkPhase = 'approach'; // approach | open | done

    this.mesh = this._buildMesh();
    this.scene.add(this.mesh);

    this.eyeHeight = 2.35;
    this._bob = 0;
    this.caught = false;

    // Optional FOV cone helper (updated each frame, subtle)
    this.fovHelper = this._buildFovHelper();
    this.scene.add(this.fovHelper);
  }

  _buildMesh() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({
      color: 0x1a1520,
      flatShading: true,
    });
    const skinMat = new THREE.MeshLambertMaterial({
      color: 0x3a3040,
      flatShading: true,
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xaa2200 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.4), bodyMat);
    torso.position.y = 1.5;
    torso.castShadow = true;
    group.add(torso);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), skinMat);
    neck.position.y = 2.35;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.4), skinMat);
    head.position.y = 2.85;
    head.castShadow = true;
    group.add(head);

    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.05), eyeMat);
    eyeL.position.set(-0.12, 2.9, 0.2);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    group.add(eyeL, eyeR);

    const armGeo = new THREE.BoxGeometry(0.14, 1.3, 0.14);
    const armL = new THREE.Mesh(armGeo, bodyMat);
    armL.position.set(-0.5, 1.4, 0);
    armL.rotation.z = 0.15;
    armL.castShadow = true;
    const armR = new THREE.Mesh(armGeo, bodyMat);
    armR.position.set(0.5, 1.4, 0);
    armR.rotation.z = -0.15;
    armR.castShadow = true;
    group.add(armL, armR);
    this._armL = armL;
    this._armR = armR;

    const legGeo = new THREE.BoxGeometry(0.2, 1.1, 0.22);
    const legL = new THREE.Mesh(legGeo, bodyMat);
    legL.position.set(-0.2, 0.55, 0);
    legL.castShadow = true;
    const legR = new THREE.Mesh(legGeo, bodyMat);
    legR.position.set(0.2, 0.55, 0);
    legR.castShadow = true;
    group.add(legL, legR);
    this._legL = legL;
    this._legR = legR;

    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 6, 6),
      new THREE.MeshBasicMaterial({
        color: 0x110810,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      })
    );
    aura.position.y = 1.4;
    aura.scale.set(1, 1.8, 1);
    group.add(aura);

    return group;
  }

  _buildFovHelper() {
    // Thin translucent cone on floor for feedback (narrow FOV)
    const len = this.viewDistance * 0.55;
    const halfW = Math.tan(THREE.MathUtils.degToRad(this.viewHalfAngleDeg)) * len;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(-halfW, -len);
    shape.lineTo(halfW, -len);
    shape.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xaa3344,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.05;
    mesh.visible = false;
    return mesh;
  }

  reset() {
    this.position.set(6, 0, -5);
    this.yaw = Math.PI;
    this.state = STATES.PATROL;
    this.patrolIndex = 0;
    this.target = null;
    this.lastKnown = null;
    this.stateTimer = 0;
    this.detection = 0;
    this.caught = false;
    this.checkTimer = 2 + Math.random() * 4;
    this.checkSpot = null;
    this.checkPhase = 'approach';
    this._syncMesh();
  }

  get eyePosition() {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );
  }

  canSee(player) {
    // Checking a locker can catch occupant without normal LOS
    if (
      this.state === STATES.CHECK_LOCKER &&
      this.checkPhase === 'open' &&
      this.checkSpot &&
      player.insideSpot === this.checkSpot
    ) {
      return true;
    }

    if (player.insideSpot && player.insideSpot.cover >= 0.95) {
      const d = this.position.distanceTo(player.position);
      return d < 0.75;
    }

    const eye = this.eyePosition;
    const head = player.headPosition;
    const toPlayer = head.clone().sub(eye);
    const dist = toPlayer.length();
    if (dist > this.viewDistance) return false;

    toPlayer.normalize();
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const flatTo = new THREE.Vector3(toPlayer.x, 0, toPlayer.z).normalize();
    const dot = forward.dot(flatTo);
    if (dot < this.viewAngle) return false;

    const cover = player.cover;
    const effectiveDist = dist / Math.max(0.15, 1 - cover * 0.85);
    if (effectiveDist > this.viewDistance) return false;

    if (player.isCrouching && cover > 0.5 && dist > 4.0 * (1 - cover * 0.5)) {
      return false;
    }
    if (player.isSneaking && cover > 0.3 && dist > 6) {
      return false;
    }

    if (this._blockedByWall(eye, head)) return false;
    return true;
  }

  _blockedByWall(from, to) {
    const dir = to.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    const steps = Math.ceil(dist / 0.4);
    const p = from.clone();
    for (let i = 1; i < steps; i++) {
      p.copy(from).addScaledVector(dir, (dist * i) / steps);
      for (const c of this.world.colliders) {
        if (c.max.y - c.min.y < 1.0) continue;
        if (
          p.x >= c.min.x &&
          p.x <= c.max.x &&
          p.y >= c.min.y &&
          p.y <= c.max.y &&
          p.z >= c.min.z &&
          p.z <= c.max.z
        ) {
          return true;
        }
      }
    }
    return false;
  }

  hear(player) {
    const dist = this.position.distanceTo(player.position);
    if (dist > this.hearRadius) return 0;
    const muffling = 1 - player.cover * 0.7;
    // Sneak muffles more
    const sneakMul = player.isSneaking ? 0.55 : 1;
    return player.noise * muffling * sneakMul * (1 - dist / this.hearRadius);
  }

  notifyNoise(pos, strength) {
    if (strength < 0.25) return;
    if (this.state === STATES.CHASE) return;
    if (this.state === STATES.CHECK_LOCKER && this.checkPhase === 'open') return;
    this.lastKnown = pos.clone();
    this.state = STATES.INVESTIGATE;
    this.stateTimer = 6;
    this.target = pos.clone();
    this.checkSpot = null;
  }

  update(dt, player) {
    if (this.caught) return;

    const seen = this.canSee(player);
    const hearLevel = this.hear(player);

    if (seen && this.state !== STATES.CHECK_LOCKER) {
      this.detection = Math.min(1, this.detection + dt * 1.8);
      this.lastKnown = player.position.clone();
      if (this.detection >= 0.55 || this.state === STATES.CHASE) {
        this.state = STATES.CHASE;
        this.target = player.position.clone();
        this.stateTimer = 2;
      }
    } else if (this.state !== STATES.CHECK_LOCKER) {
      this.detection = Math.max(0, this.detection - dt * 0.35);
    }

    if (this.state !== STATES.CHASE && this.state !== STATES.CHECK_LOCKER) {
      if (hearLevel > 0.35) this.notifyNoise(player.position, hearLevel);
      else if (hearLevel > 0.55) {
        this.lastKnown = player.position.clone();
        this.state = STATES.CHASE;
        this.target = player.position.clone();
      }
    }

    // Random locker checks while patrolling / searching
    if (
      this.state === STATES.PATROL ||
      this.state === STATES.SEARCH
    ) {
      this.checkTimer -= dt;
      if (this.checkTimer <= 0) {
        const spot = this.world.randomLockerNear(this.position, 12);
        if (spot) {
          this.checkSpot = spot;
          this.checkPhase = 'approach';
          this.state = STATES.CHECK_LOCKER;
          this.stateTimer = 8;
          // Stand in front of locker
          const front = spot.exitPos
            ? spot.exitPos.clone()
            : spot.position.clone().add(
                (spot.lookDir || new THREE.Vector3(0, 0, 1)).clone().multiplyScalar(0.9)
              );
          this.target = front;
        } else {
          this.checkTimer = this.checkCooldown + Math.random() * 4;
        }
      }
    }

    switch (this.state) {
      case STATES.PATROL:
        this._patrol(dt);
        break;
      case STATES.INVESTIGATE:
        this._goTo(dt, this.target, this.investigateSpeed);
        this.stateTimer -= dt;
        if (this._reached(this.target, 1.0) || this.stateTimer <= 0) {
          this.state = STATES.SEARCH;
          this.stateTimer = 4;
          this.searchYaw = this.yaw;
        }
        break;
      case STATES.CHASE:
        this.target = player.position.clone();
        this._goTo(dt, this.target, this.chaseSpeed);
        this.stateTimer -= dt;
        if (!seen && this.stateTimer <= 0) {
          this.state = STATES.INVESTIGATE;
          this.target = this.lastKnown
            ? this.lastKnown.clone()
            : player.position.clone();
          this.stateTimer = 5;
        } else if (seen) {
          this.stateTimer = 1.5;
        }
        this._tryCatch(player, hearLevel, seen);
        break;
      case STATES.SEARCH:
        this.yaw = this.searchYaw + Math.sin(this.stateTimer * 2.5) * 0.9;
        this.stateTimer -= dt;
        this._animateIdle(dt);
        if (this.stateTimer <= 0) this.state = STATES.PATROL;
        break;
      case STATES.CHECK_LOCKER:
        this._checkLocker(dt, player, hearLevel);
        break;
    }

    if (
      this.state !== STATES.SEARCH &&
      !(this.state === STATES.CHECK_LOCKER && this.checkPhase === 'open')
    ) {
      this._bob += dt * (this.state === STATES.CHASE ? 10 : 6);
      const swing = Math.sin(this._bob) * 0.35;
      this._legL.rotation.x = swing;
      this._legR.rotation.x = -swing;
      this._armL.rotation.x = -swing * 0.6;
      this._armR.rotation.x = swing * 0.6;
    }

    this._syncMesh();
    this._updateFovHelper();
  }

  _checkLocker(dt, player, hearLevel) {
    if (!this.checkSpot) {
      this.state = STATES.PATROL;
      this.checkTimer = this.checkCooldown + Math.random() * 5;
      return;
    }

    if (this.checkPhase === 'approach') {
      this._goTo(dt, this.target, this.investigateSpeed);
      // Face locker
      const to = this.checkSpot.position.clone().sub(this.position);
      if (to.lengthSq() > 0.01) {
        const desired = Math.atan2(-to.x, -to.z);
        let dyaw = desired - this.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        this.yaw += THREE.MathUtils.clamp(dyaw, -4 * dt, 4 * dt);
      }

      if (this._reached(this.target, 0.65)) {
        this.checkPhase = 'open';
        this.stateTimer = 1.6 + Math.random() * 0.6;
        // Reach toward locker
        this._armR.rotation.x = -1.1;
        this._armL.rotation.x = -0.4;
      }

      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        // Gave up approaching
        this.state = STATES.PATROL;
        this.checkSpot = null;
        this.checkTimer = this.checkCooldown + Math.random() * 5;
      }
    } else if (this.checkPhase === 'open') {
      this.stateTimer -= dt;
      // If player is in this locker — found
      if (player.insideSpot === this.checkSpot) {
        this.caught = true;
        return;
      }
      // Nearby crouching player peeking gets spotted
      if (
        !player.insideSpot &&
        this.position.distanceTo(player.position) < 1.4 &&
        this.canSee(player)
      ) {
        this.state = STATES.CHASE;
        this.target = player.position.clone();
        this.checkSpot = null;
        return;
      }

      if (this.stateTimer <= 0) {
        this.checkPhase = 'done';
        this.state = STATES.PATROL;
        this.checkSpot = null;
        this.checkTimer = this.checkCooldown + Math.random() * 6;
      }
    }
  }

  _tryCatch(player, hearLevel, seen) {
    if (
      this.position.distanceTo(player.position) < this.catchRange &&
      (!player.insideSpot || this.position.distanceTo(player.position) < 0.85)
    ) {
      if (player.insideSpot && player.insideSpot.cover >= 0.95) {
        if (seen || hearLevel > 0.4) this.caught = true;
      } else {
        this.caught = true;
      }
    }
  }

  _patrol(dt) {
    const pts = this.world.patrolPoints;
    if (!pts.length) return;
    const dest = pts[this.patrolIndex];
    this._goTo(dt, dest, this.patrolSpeed);
    if (this._reached(dest, 0.8)) {
      this.patrolIndex = (this.patrolIndex + 1) % pts.length;
    }
  }

  _goTo(dt, dest, speed) {
    if (!dest) return;
    const dx = dest.x - this.position.x;
    const dz = dest.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return;

    const desiredYaw = Math.atan2(-dx, -dz);
    let dyaw = desiredYaw - this.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.yaw += THREE.MathUtils.clamp(dyaw, -3 * dt, 3 * dt);

    if (Math.abs(dyaw) < 0.9) {
      const move = Math.min(speed * dt, dist);
      this.position.x += -Math.sin(this.yaw) * move;
      this.position.z += -Math.cos(this.yaw) * move;
    }

    this.position.copy(this.world.resolveCollision(this.position, 0.35, 2.5));
  }

  _reached(dest, r) {
    if (!dest) return true;
    return this.position.distanceTo(dest) < r;
  }

  _animateIdle(dt) {
    this._bob += dt * 2;
    this._armL.rotation.x = Math.sin(this._bob) * 0.1;
    this._armR.rotation.x = -Math.sin(this._bob) * 0.1;
  }

  _syncMesh() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.mesh.rotation.y = this.yaw;
  }

  _updateFovHelper() {
    if (!this.fovHelper) return;
    this.fovHelper.visible = this.mesh.visible;
    this.fovHelper.position.x = this.position.x;
    this.fovHelper.position.z = this.position.z;
    this.fovHelper.rotation.z = -this.yaw;
  }

  syncMesh() {
    this._syncMesh();
    this._updateFovHelper();
  }

  proximityTo(player) {
    const d = this.position.distanceTo(player.position);
    return THREE.MathUtils.clamp(1 - d / 16, 0, 1);
  }
}
