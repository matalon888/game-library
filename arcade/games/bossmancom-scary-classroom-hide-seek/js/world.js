import * as THREE from '../vendor/three.module.js';

/** Flat low-poly material helper */
function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    ...opts,
  });
}

function box(w, h, d, color, x, y, z, rotY = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat(color)
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Classroom + short hallway. Provides colliders, hide spots, patrol points.
 */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // { min: Vector3, max: Vector3 } AABB in world space
    this.hideSpots = []; // { type, mesh, enterPos, lookDir, occupied }
    this.patrolPoints = [];
    this.lights = [];
    this.flickerLights = [];
    this.interactables = []; // lockers/cabinets player can enter

    this._build();
  }

  _addCollider(mesh, pad = 0) {
    mesh.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(mesh);
    if (pad) {
      box3.min.addScalar(-pad);
      box3.max.addScalar(pad);
    }
    // Don't block vertical too tightly for floors
    this.colliders.push({
      min: box3.min.clone(),
      max: box3.max.clone(),
      mesh,
    });
  }

  _addSolid(mesh, addCollider = true) {
    this.scene.add(mesh);
    if (addCollider) this._addCollider(mesh);
    return mesh;
  }

  _build() {
    // —— Dimensions ——
    // Classroom: x [-10, 10], z [-8, 8]
    // Hallway extends z [8, 18], x [-3, 3]

    this._floorAndWalls();
    this._lighting();
    this._desks();
    this._teacherArea();
    this._lockersAndCabinets();
    this._bookshelves();
    this._doorsAndDecor();
    this._patrolRoute();
  }

  _floorAndWalls() {
    const floorMat = mat(0x3a3a38);
    const wallMat = mat(0x4a5548); // sickly green institutional
    const wallMat2 = mat(0x454840);
    const trimMat = mat(0x2a2a28);

    // Classroom floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(20.2, 0.2, 16.2),
      floorMat
    );
    floor.position.set(0, -0.1, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Long locker hallway: z 8 → 40 (connected to classroom door)
    this.hallStartZ = 8;
    this.hallEndZ = 40;
    this.hallHalfW = 2.7;
    const hallLen = this.hallEndZ - this.hallStartZ;
    const hallMidZ = (this.hallStartZ + this.hallEndZ) / 2;

    const hallFloor = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.2, hallLen + 0.4),
      mat(0x353532)
    );
    hallFloor.position.set(0, -0.1, hallMidZ);
    hallFloor.receiveShadow = true;
    this.scene.add(hallFloor);

    // Ceiling classroom
    const ceil = new THREE.Mesh(
      new THREE.BoxGeometry(20.2, 0.15, 16.2),
      mat(0x2e2e2c)
    );
    ceil.position.set(0, 4.0, 0);
    this.scene.add(ceil);

    // Ceiling hallway
    const hallCeil = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.15, hallLen + 0.4),
      mat(0x2a2a28)
    );
    hallCeil.position.set(0, 3.6, hallMidZ);
    this.scene.add(hallCeil);

    // Walls helper — thick walls for collision
    const wallH = 4.1;
    const thick = 0.35;

    // Classroom walls
    // Back wall (teacher side) z = -8
    this._addSolid(box(20.5, wallH, thick, 0x4a5548, 0, wallH / 2, -8));
    // Front wall with doorway to hallway z = 8
    this._addSolid(box(7, wallH, thick, 0x4a5548, -6.5, wallH / 2, 8));
    this._addSolid(box(7, wallH, thick, 0x4a5548, 6.5, wallH / 2, 8));
    this._addSolid(box(3.2, 0.9, thick, 0x3a3a38, 0, 3.55, 8), false);

    // Left wall x = -10
    this._addSolid(box(thick, wallH, 16.5, 0x454840, -10, wallH / 2, 0));
    // Right wall x = 10
    this._addSolid(box(thick, wallH, 16.5, 0x454840, 10, wallH / 2, 0));

    // Long hallway walls
    this._addSolid(box(thick, 3.7, hallLen + 0.5, 0x3d4038, -3, 1.85, hallMidZ));
    this._addSolid(box(thick, 3.7, hallLen + 0.5, 0x3d4038, 3, 1.85, hallMidZ));
    // Hall end wall
    this._addSolid(box(6.5, 3.7, thick, 0x3a3d35, 0, 1.85, this.hallEndZ));

    // Baseboards
    this._addSolid(box(20, 0.12, 0.08, 0x2a2a28, 0, 0.06, -7.9), false);
    this._addSolid(box(0.08, 0.12, 16, 0x2a2a28, -9.9, 0.06, 0), false);
    this._addSolid(box(0.08, 0.12, 16, 0x2a2a28, 9.9, 0.06, 0), false);

    // Floor tile grid (visual only)
    const gridHelper = new THREE.GridHelper(20, 20, 0x2a2a28, 0x333330);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    // Map bounds for minimap (classroom + long hall)
    this.mapBounds = { minX: -10, maxX: 10, minZ: -8, maxZ: this.hallEndZ };
  }

  _lighting() {
    // Brighter institutional ambient (still moody, easier to read space)
    const amb = new THREE.AmbientLight(0x3a3e48, 0.72);
    this.scene.add(amb);

    // Soft fill so corners aren't pitch black
    const fill = new THREE.HemisphereLight(0xc8d0e0, 0x2a2820, 0.45);
    this.scene.add(fill);

    // Moonlight / exit glow from hallway
    const moon = new THREE.DirectionalLight(0x8899bb, 0.4);
    moon.position.set(-5, 10, 20);
    this.scene.add(moon);

    // Fluorescent strips in classroom + long hallway
    const fixtures = [
      [-5, 3.85, -3],
      [5, 3.85, -3],
      [-5, 3.85, 3],
      [5, 3.85, 3],
      [0, 3.5, 12],
      [0, 3.5, 20],
      [0, 3.5, 28],
      [0, 3.5, 36],
    ];

    fixtures.forEach(([x, y, z], i) => {
      // Fixture mesh
      const fixture = box(2.4, 0.08, 0.35, 0xa8a898, x, y, z);
      fixture.castShadow = false;
      this.scene.add(fixture);

      const light = new THREE.PointLight(0xeef2dc, 1.55, 18, 1.2);
      light.position.set(x, y - 0.15, z);
      light.castShadow = i < 2; // limit shadow casters for perf
      if (light.castShadow) {
        light.shadow.mapSize.set(512, 512);
        light.shadow.camera.near = 0.2;
        light.shadow.camera.far = 16;
        light.shadow.bias = -0.01;
      }
      this.scene.add(light);
      this.lights.push(light);
      this.flickerLights.push({
        light,
        base: 1.35 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
        rate: 1.2 + Math.random() * 2,
        glitch: Math.random() < 0.25, // less frequent full blackouts
      });

      // Glow plane
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.25),
        new THREE.MeshBasicMaterial({
          color: 0xe0e8b8,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        })
      );
      glow.rotation.x = Math.PI / 2;
      glow.position.set(x, y - 0.05, z);
      this.scene.add(glow);
    });

    // Red exit sign glow at hall end
    const endZ = this.hallEndZ ?? 40;
    const exitLight = new THREE.PointLight(0xff4422, 0.55, 10, 2);
    exitLight.position.set(0, 2.8, endZ - 0.5);
    this.scene.add(exitLight);
    const exitSign = box(0.8, 0.3, 0.08, 0xaa2200, 0, 2.9, endZ - 0.25);
    this.scene.add(exitSign);
  }

  _deskUnit(x, z, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    // Desktop
    const top = box(1.2, 0.06, 0.7, 0x5c4030, 0, 0.78, 0);
    group.add(top);
    // Legs
    const legC = 0x3a3028;
    [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].forEach(([lx, lz]) => {
      group.add(box(0.06, 0.75, 0.06, legC, lx, 0.375, lz));
    });
    // Chair
    const seat = box(0.5, 0.05, 0.5, 0x3a4550, 0, 0.42, 0.55);
    group.add(seat);
    group.add(box(0.5, 0.45, 0.05, 0x3a4550, 0, 0.65, 0.78)); // back
    group.add(box(0.05, 0.4, 0.05, 0x2a3038, -0.2, 0.2, 0.55));
    group.add(box(0.05, 0.4, 0.05, 0x2a3038, 0.2, 0.2, 0.55));

    this.scene.add(group);

    // Collider for desk body (approximate)
    const deskMesh = box(1.15, 0.8, 0.65, 0x5c4030, x, 0.4, z, rotY);
    deskMesh.visible = false;
    this.scene.add(deskMesh);
    this._addCollider(deskMesh);

    // Hide spot under desk
    this.hideSpots.push({
      type: 'desk',
      position: new THREE.Vector3(x, 0, z),
      radius: 0.85,
      crouchOnly: true,
      cover: 0.75, // detection reduction when crouching here
    });

    return group;
  }

  _desks() {
    // 3 rows × 4 columns of student desks
    const cols = [-6, -2, 2, 6];
    const rows = [-4.5, -1.5, 1.5];
    rows.forEach((z) => {
      cols.forEach((x) => {
        // Face toward teacher (negative z)
        this._deskUnit(x, z, 0);
      });
    });
  }

  _teacherArea() {
    // Teacher desk at front
    const td = box(2.8, 0.9, 1.1, 0x4a3828, 0, 0.45, -6.5);
    this._addSolid(td);
    // Desktop items
    this.scene.add(box(0.4, 0.05, 0.3, 0xd8d0c0, -0.6, 0.95, -6.5));
    this.scene.add(box(0.25, 0.35, 0.05, 0x224488, 0.7, 1.08, -6.6)); // book
    this.scene.add(box(0.12, 0.2, 0.12, 0x886644, 0.3, 1.0, -6.3)); // mug

    // Teacher chair
    this._addSolid(box(0.55, 0.9, 0.55, 0x2a3038, 0, 0.45, -7.4));

    // Blackboard
    const board = box(6, 1.8, 0.08, 0x1a2a1a, 0, 2.2, -7.85);
    this.scene.add(board);
    this.scene.add(box(6.3, 2.1, 0.06, 0x3a3020, 0, 2.2, -7.9)); // frame

    // Hide behind teacher desk
    this.hideSpots.push({
      type: 'desk',
      position: new THREE.Vector3(0, 0, -6.5),
      radius: 1.4,
      crouchOnly: true,
      cover: 0.8,
    });
  }

  _makeLocker(x, z, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    const body = box(0.7, 2.2, 0.55, 0x4a5560, 0, 1.1, 0);
    group.add(body);
    // Door seam
    group.add(box(0.68, 2.1, 0.04, 0x3a4550, 0, 1.1, 0.28));
    // Handle
    group.add(box(0.04, 0.12, 0.06, 0x888880, 0.22, 1.1, 0.32));
    // Vent slits
    for (let i = 0; i < 3; i++) {
      group.add(box(0.35, 0.03, 0.02, 0x2a3038, 0, 1.7 + i * 0.1, 0.3));
    }

    this.scene.add(group);

    // Collision
    const col = box(0.7, 2.2, 0.55, 0x4a5560, x, 1.1, z, rotY);
    col.visible = false;
    this.scene.add(col);
    this._addCollider(col);

    // Forward direction for exit
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      rotY
    );

    const spot = {
      type: 'locker',
      position: new THREE.Vector3(x, 0, z),
      radius: 1.1,
      crouchOnly: false,
      cover: 1.0, // fully hidden when inside
      enterable: true,
      inside: false,
      enterPos: new THREE.Vector3(x, 0, z).add(forward.clone().multiplyScalar(-0.05)),
      exitPos: new THREE.Vector3(x, 0, z).add(forward.clone().multiplyScalar(0.9)),
      lookDir: forward.clone(),
      mesh: group,
    };
    this.hideSpots.push(spot);
    this.interactables.push(spot);
    return spot;
  }

  _makeCabinet(x, z, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    group.add(box(1.1, 1.6, 0.55, 0x5a4838, 0, 0.8, 0));
    group.add(box(0.5, 1.5, 0.04, 0x4a3828, -0.25, 0.8, 0.28));
    group.add(box(0.5, 1.5, 0.04, 0x4a3828, 0.25, 0.8, 0.28));
    group.add(box(0.04, 0.1, 0.05, 0xaaa898, -0.1, 0.85, 0.32));
    group.add(box(0.04, 0.1, 0.05, 0xaaa898, 0.1, 0.85, 0.32));

    this.scene.add(group);

    const col = box(1.1, 1.6, 0.55, 0x5a4838, x, 0.8, z, rotY);
    col.visible = false;
    this.scene.add(col);
    this._addCollider(col);

    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      rotY
    );

    const spot = {
      type: 'cabinet',
      position: new THREE.Vector3(x, 0, z),
      radius: 1.2,
      crouchOnly: false,
      cover: 0.95,
      enterable: true,
      inside: false,
      enterPos: new THREE.Vector3(x, 0, z),
      exitPos: new THREE.Vector3(x, 0, z).add(forward.clone().multiplyScalar(1.0)),
      lookDir: forward.clone(),
      mesh: group,
    };
    this.hideSpots.push(spot);
    this.interactables.push(spot);
    return spot;
  }

  _lockersAndCabinets() {
    // Lockers along left wall of classroom
    const lockerZs = [-5, -3.5, -2, -0.5, 1, 2.5, 4];
    lockerZs.forEach((z) => this._makeLocker(-9.3, z, Math.PI / 2));

    // Cabinets right wall
    this._makeCabinet(9.2, -5, -Math.PI / 2);
    this._makeCabinet(9.2, -3.2, -Math.PI / 2);
    this._makeCabinet(9.2, 4, -Math.PI / 2);

    // Long hallway lined with lockers (both walls)
    const start = 9.5;
    const end = (this.hallEndZ ?? 40) - 1.5;
    for (let z = start; z <= end; z += 1.45) {
      this._makeLocker(-2.55, z, Math.PI / 2);
      this._makeLocker(2.55, z, -Math.PI / 2);
    }
  }

  _bookshelves() {
    // Back-left shelves
    const shelf = (x, z, w = 1.8) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.add(box(w, 2.0, 0.4, 0x4a3828, 0, 1.0, 0));
      // Shelves
      for (let i = 0; i < 4; i++) {
        g.add(box(w - 0.1, 0.04, 0.38, 0x3a2a1a, 0, 0.35 + i * 0.45, 0));
      }
      // Book blocks
      const colors = [0x224466, 0x662222, 0x226633, 0x554422, 0x333355];
      for (let i = 0; i < 8; i++) {
        const bh = 0.2 + Math.random() * 0.15;
        g.add(
          box(
            0.12,
            bh,
            0.28,
            colors[i % colors.length],
            -w / 2 + 0.25 + i * 0.2,
            0.55 + (i % 3) * 0.45 + bh / 2,
            0
          )
        );
      }
      this.scene.add(g);
      const col = box(w, 2.0, 0.4, 0x4a3828, x, 1.0, z);
      col.visible = false;
      this.scene.add(col);
      this._addCollider(col);

      this.hideSpots.push({
        type: 'shelf',
        position: new THREE.Vector3(x, 0, z + 0.5),
        radius: 0.9,
        crouchOnly: true,
        cover: 0.55,
      });
    };

    shelf(-7, -7.4, 2.2);
    shelf(7, -7.4, 2.2);
    shelf(-8.5, 6.5, 1.5); // near front corner
  }

  _doorsAndDecor() {
    // Door frames (visual)
    const doorFrameL = box(0.15, 2.7, 0.4, 0x3a3020, -1.55, 1.35, 8);
    const doorFrameR = box(0.15, 2.7, 0.4, 0x3a3020, 1.55, 1.35, 8);
    this.scene.add(doorFrameL, doorFrameR);

    // Slightly open door at far hall end
    const endZ = this.hallEndZ ?? 40;
    const endDoor = box(1.4, 2.5, 0.08, 0x4a3a28, 1.2, 1.25, endZ - 0.2);
    endDoor.rotation.y = 0.3;
    this.scene.add(endDoor);

    // Trash can
    this._addSolid(box(0.4, 0.55, 0.4, 0x3a3a3a, 8.5, 0.28, -7));

    // Clock
    const clock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.06, 12),
      mat(0xd8d0c0)
    );
    clock.rotation.x = Math.PI / 2;
    clock.position.set(4, 2.8, -7.85);
    this.scene.add(clock);

    // Windows (dark, night) along right wall
    for (let i = 0; i < 3; i++) {
      const win = box(0.08, 1.4, 1.6, 0x0a1020, 9.85, 2.2, -4 + i * 3.5);
      this.scene.add(win);
      // Faint blue glow
      const wLight = new THREE.PointLight(0x223355, 0.15, 5);
      wLight.position.set(9.2, 2.2, -4 + i * 3.5);
      this.scene.add(wLight);
    }

    // Poster boards
    this.scene.add(box(1.8, 1.2, 0.04, 0x8a3020, -9.85, 2.2, 5));
    this.scene.add(box(1.5, 1.0, 0.04, 0x305080, 9.85, 2.0, 0));
  }

  _patrolRoute() {
    const end = this.hallEndZ ?? 40;
    // Waypoints: classroom loop + full long hallway
    this.patrolPoints = [
      new THREE.Vector3(0, 0, -5),
      new THREE.Vector3(-6, 0, -3),
      new THREE.Vector3(-6, 0, 4),
      new THREE.Vector3(0, 0, 6),
      new THREE.Vector3(0, 0, 12),
      new THREE.Vector3(0, 0, 22),
      new THREE.Vector3(0, 0, end - 3),
      new THREE.Vector3(0, 0, 28),
      new THREE.Vector3(0, 0, 14),
      new THREE.Vector3(0, 0, 10),
      new THREE.Vector3(6, 0, 4),
      new THREE.Vector3(6, 0, -3),
      new THREE.Vector3(3, 0, -6),
    ];
  }

  /** Resolve horizontal collision for a capsule-like player */
  resolveCollision(pos, radius = 0.32, height = 1.6) {
    const result = pos.clone();
    const feetY = result.y;
    const headY = feetY + height;

    for (const c of this.colliders) {
      // Skip if vertically separated
      if (headY < c.min.y || feetY > c.max.y) continue;

      // Expand AABB by radius
      const minX = c.min.x - radius;
      const maxX = c.max.x + radius;
      const minZ = c.min.z - radius;
      const maxZ = c.max.z + radius;

      if (
        result.x > minX &&
        result.x < maxX &&
        result.z > minZ &&
        result.z < maxZ
      ) {
        // Push out along smallest overlap
        const overlapX = Math.min(result.x - minX, maxX - result.x);
        const overlapZ = Math.min(result.z - minZ, maxZ - result.z);
        if (overlapX < overlapZ) {
          result.x = result.x - minX < maxX - result.x ? minX : maxX;
        } else {
          result.z = result.z - minZ < maxZ - result.z ? minZ : maxZ;
        }
      }
    }

    // Keep in bounds (soft walls)
    const hallEnd = this.hallEndZ ?? 40;
    const hallHalf = this.hallHalfW ?? 2.6;
    result.x = THREE.MathUtils.clamp(result.x, -9.5, 9.5);
    // Classroom + long hallway Z bounds depend on X
    if (Math.abs(result.x) < hallHalf + 0.1 && result.z > 7.5) {
      result.z = THREE.MathUtils.clamp(result.z, -7.5, hallEnd - 0.5);
      result.x = THREE.MathUtils.clamp(result.x, -hallHalf, hallHalf);
    } else {
      result.z = THREE.MathUtils.clamp(result.z, -7.5, 7.6);
    }

    return result;
  }

  /** Random enterable locker/cabinet near a world position (for AI checks) */
  randomLockerNear(pos, maxDist = 10) {
    const candidates = this.interactables.filter(
      (s) => s.enterable && pos.distanceTo(s.position) <= maxDist
    );
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  getHideCover(playerPos, isCrouching, insideSpot) {
    if (insideSpot) return insideSpot.cover;

    let best = 0;
    for (const spot of this.hideSpots) {
      if (spot.enterable && spot.inside) continue;
      if (spot.crouchOnly && !isCrouching) continue;
      const d = playerPos.distanceTo(spot.position);
      if (d < spot.radius) {
        best = Math.max(best, spot.cover * (1 - d / spot.radius * 0.3));
      }
    }
    // Base crouch cover in open
    if (isCrouching) best = Math.max(best, 0.25);
    return best;
  }

  nearestInteractable(playerPos, maxDist = 1.4) {
    let best = null;
    let bestD = maxDist;
    for (const spot of this.interactables) {
      const d = playerPos.distanceTo(spot.position);
      if (d < bestD) {
        bestD = d;
        best = spot;
      }
    }
    return best;
  }

  update(dt, time) {
    // Flicker fluorescent lights
    for (const f of this.flickerLights) {
      f.phase += dt * f.rate;
      let intensity = f.base + Math.sin(f.phase) * 0.1;
      if (f.glitch && Math.random() < 0.005) {
        intensity *= 0.35 + Math.random() * 0.35;
      } else if (Math.random() < 0.002) {
        intensity *= 0.55;
      }
      f.light.intensity = Math.max(0.45, intensity);
    }
  }
}
