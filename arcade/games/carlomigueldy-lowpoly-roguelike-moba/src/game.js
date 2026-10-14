import * as THREE from "three";
import { buildCharacter, buildClips, facet } from "./hero.js";

// ---- Renderer: WebGPURenderer auto-uses WebGPU when available and
// transparently falls back to a WebGL2 backend otherwise. ----
export async function makeRenderer(canvas) {
  const wantGPU = !!navigator.gpu;
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: !wantGPU });
  await r.init();
  r.backendLabel = r.backend?.isWebGPUBackend ? "webgpu" : "webgl";
  return r;
}

const ARENA = 60;
const TEAM = { ALLY: 0, ENEMY: 1 };

const UPGRADES = [
  { id: "pow", ico: "⚔️", name: "Arcane Might", desc: "+25% ability damage", apply: (p) => (p.dmgMul *= 1.25) },
  { id: "hp", ico: "❤️", name: "Vital Surge", desc: "+40 max HP & heal", apply: (p) => { p.maxHp += 40; p.hp += 40; } },
  { id: "cd", ico: "⏱️", name: "Quickcast", desc: "-20% cooldowns", apply: (p) => (p.cdMul *= 0.8) },
  { id: "spd", ico: "👟", name: "Fleetfoot", desc: "+18% move speed", apply: (p) => (p.speed *= 1.18) },
  { id: "mana", ico: "🔷", name: "Deep Well", desc: "+50 mana & regen", apply: (p) => { p.maxMana += 50; p.manaRegen += 4; } },
  { id: "lifesteal", ico: "🩸", name: "Vampirism", desc: "Heal 15% of damage dealt", apply: (p) => (p.lifesteal += 0.15) },
  { id: "crit", ico: "✨", name: "Focus", desc: "+20% crit chance (x2)", apply: (p) => (p.crit += 0.2) },
  { id: "regen", ico: "🌿", name: "Regrowth", desc: "+5 HP/s regen", apply: (p) => (p.hpRegen += 5) },
];

const ABILITIES = {
  Q: { name: "Bolt", mana: 12, cd: 0.9, range: 22 },
  W: { name: "Dash", mana: 18, cd: 4 },
  E: { name: "Nova", mana: 30, cd: 7, range: 7 },
  R: { name: "Storm", mana: 70, cd: 22, range: 12 },
};

let _id = 1;
const nid = () => _id++;

export class Game {
  constructor(canvas, renderer, net, ui) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.net = net;
    this.ui = ui;
    this.clock = new THREE.Clock();
    this.entities = new Map();   // id -> entity
    this.projectiles = [];
    this.effects = [];
    this.players = new Map();    // peerId -> player entity
    this.localId = net ? net.selfId : "solo";
    this.wave = 0;
    this.waveTimer = 3;
    this.running = false;
    this.paused = false;
    this.pendingUpgrade = false;
    this._initScene();
    this._initInput();
    this._bindNet();
  }

  _initScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1018);
    scene.fog = new THREE.Fog(0x0c1018, 50, 100);
    this.scene = scene;

    const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);
    this.camera = cam;
    this.camOffset = new THREE.Vector3(0, 26, 20);

    scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x202830, 0.7));
    const sun = new THREE.DirectionalLight(0xffefd0, 1.1);
    sun.position.set(20, 40, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = 50;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    scene.add(sun);

    if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = true;

    // Ground
    const ground = new THREE.Mesh(
      facet(new THREE.CircleGeometry(ARENA, 48)),
      new THREE.MeshStandardMaterial({ color: 0x1d2a1f, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Low-poly scatter rocks/trees
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * (ARENA - 14);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const tree = Math.random() > 0.5;
      let m;
      if (tree) {
        m = new THREE.Group();
        const trunk = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 5)),
          new THREE.MeshStandardMaterial({ color: 0x5b3b22 }));
        trunk.position.y = 0.7;
        const top = new THREE.Mesh(facet(new THREE.ConeGeometry(1.1, 2.4, 6)),
          new THREE.MeshStandardMaterial({ color: 0x2f6b3a }));
        top.position.y = 2.3;
        m.add(trunk, top);
      } else {
        m = new THREE.Mesh(facet(new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.6, 0)),
          new THREE.MeshStandardMaterial({ color: 0x55606b }));
        m.position.y = 0.4;
      }
      m.position.x = x; m.position.z = z;
      m.traverse?.((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(m);
    }

    // Ground click indicator
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.6, 24),
      new THREE.MeshBasicMaterial({ color: 0x5fd6ff, transparent: true, opacity: 0 })
    );
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    this.moveRing = ring;

    this.clips = buildClips();
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  _initInput() {
    this.pointer = new THREE.Vector2();
    this.cursorWorld = new THREE.Vector3();

    const updatePointer = (e) => {
      this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    };

    this.canvas.addEventListener("mousemove", updatePointer);
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.canvas.addEventListener("mousedown", (e) => {
      if (!this.running || this.paused) return;
      updatePointer(e);
      const pt = this._raycastGround();
      if (!pt) return;
      // both buttons move (DOTA-like right click move; left also supported)
      this._issueMove(pt);
    });

    addEventListener("keydown", (e) => {
      if (!this.running || this.paused) return;
      const k = e.key.toUpperCase();
      if (ABILITIES[k]) {
        updatePointer(e);
        const pt = this._raycastGround();
        this._castAbility(k, pt);
      }
    });

    addEventListener("resize", () => this._resize());
    this._resize();
  }

  _resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  }

  _raycastGround() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      this.cursorWorld.copy(hit);
      return hit;
    }
    return null;
  }

  // ---------- networking ----------
  _bindNet() {
    if (!this.net) return;
    this.net.on("join", (d, from) => {
      // host receives a new player's intro
      this._spawnPlayer(from, false, d.palette);
      // send full snapshot of existing players
      if (this.net.isHost) {
        const roster = [...this.players.entries()].map(([pid, p]) => ({ pid, palette: p.palette }));
        this.net.send("roster", { roster, wave: this.wave });
      }
    });
    this.net.on("roster", (d) => {
      for (const r of d.roster) if (!this.players.has(r.pid) && r.pid !== this.localId) this._spawnPlayer(r.pid, false, r.palette);
    });
    this.net.on("pstate", (d, from) => {
      const p = this.players.get(from);
      if (p) { p.netTarget = new THREE.Vector3(d.x, 0, d.z); p.hp = d.hp; }
    });
    this.net.on("pcast", (d, from) => {
      const p = this.players.get(from);
      if (p) this._doCast(p, d.key, new THREE.Vector3(d.tx, 0, d.tz), false);
    });
    // Host authoritative enemy spawns
    this.net.on("espawn", (d) => { if (!this.net.isHost) this._spawnEnemy(d.x, d.z, d.kind, d.id); });
    this.net.on("ehit", (d) => { if (!this.net.isHost) { const e = this.entities.get(d.id); if (e) { e.hp = d.hp; if (e.hp <= 0) this._killEntity(e); } } });
  }

  // ---------- entities ----------
  _spawnPlayer(peerId, isLocal, palette) {
    if (this.players.has(peerId)) return this.players.get(peerId);
    palette = palette || randomPalette();
    const { root, parts } = buildCharacter(palette);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const [k, clip] of Object.entries(this.clips)) {
      actions[k] = mixer.clipAction(clip);
    }
    actions.idle.play();
    const angle = Math.random() * Math.PI * 2;
    root.position.set(Math.cos(angle) * 4, 0, Math.sin(angle) * 4);
    this.scene.add(root);

    const p = {
      id: nid(), peerId, isLocal, type: "player", team: TEAM.ALLY,
      root, parts, mixer, actions, current: "idle",
      palette,
      hp: 200, maxHp: 200, mana: 120, maxMana: 120, manaRegen: 8, hpRegen: 2,
      speed: 9, dmgMul: 1, cdMul: 1, lifesteal: 0, crit: 0.05,
      level: 1, xp: 0, xpNeed: 10, gold: 0,
      moveTarget: null, netTarget: null,
      cooldowns: { Q: 0, W: 0, E: 0, R: 0 },
      attackCd: 0, facing: 0, alive: true,
    };
    this.players.set(peerId, p);
    this.entities.set(p.id, p);
    if (isLocal) this.local = p;
    return p;
  }

  _spawnEnemy(x, z, kind = "creep", forcedId) {
    const isBoss = kind === "boss";
    const isElite = kind === "elite";
    const palette = isBoss
      ? { skin: 0x8b1e2d, cloth: 0x40121b, cloth2: 0x2a0c12, accent: 0xff3b3b }
      : isElite
      ? { skin: 0x6b2e8b, cloth: 0x3a1550, cloth2: 0x250d35, accent: 0xd06bff }
      : { skin: 0x6a7d55, cloth: 0x44502f, cloth2: 0x2e361f, accent: 0xa0c060 };
    const { root, parts } = buildCharacter(palette);
    const scale = isBoss ? 2.2 : isElite ? 1.4 : 1;
    root.scale.setScalar(scale);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const [k, clip] of Object.entries(this.clips)) actions[k] = mixer.clipAction(clip);
    actions.run.play();
    const a = Math.random() * Math.PI * 2;
    const r = ARENA - 3;
    root.position.set(x ?? Math.cos(a) * r, 0, z ?? Math.sin(a) * r);
    this.scene.add(root);

    const hpBase = isBoss ? 1200 : isElite ? 220 : 60;
    const e = {
      id: forcedId ?? nid(), type: "enemy", kind, team: TEAM.ENEMY,
      root, parts, mixer, actions, current: "run",
      hp: hpBase + this.wave * (isBoss ? 120 : 8),
      maxHp: hpBase + this.wave * (isBoss ? 120 : 8),
      speed: isBoss ? 3.2 : isElite ? 4.5 : 3.6 + Math.random(),
      dmg: isBoss ? 30 : isElite ? 16 : 8,
      gold: isBoss ? 200 : isElite ? 35 : 12,
      xp: isBoss ? 60 : isElite ? 14 : 4,
      attackCd: 0, alive: true,
    };
    this.entities.set(e.id, e);
    this._addHealthbar(e);
    return e;
  }

  _addHealthbar(e) {
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthTest: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.13),
      new THREE.MeshBasicMaterial({ color: 0xff4458, depthTest: false }));
    fg.position.z = 0.01;
    const bar = new THREE.Group();
    bar.add(bg, fg);
    bar.position.y = (e.kind === "boss" ? 5.2 : e.kind === "elite" ? 3.2 : 2.4);
    bar.renderOrder = 999;
    e.root.add(bar);
    e.healthbar = { group: bar, fg };
  }

  // ---------- combat ----------
  _issueMove(pt) {
    this.local.moveTarget = pt.clone();
    this.moveRing.position.set(pt.x, 0.05, pt.z);
    this.moveRing.material.opacity = 0.9;
    if (this.net) this.net.send("pstate", { x: pt.x, z: pt.z, hp: this.local.hp });
  }

  _castAbility(key, pt) {
    const p = this.local;
    const ab = ABILITIES[key];
    if (p.cooldowns[key] > 0 || p.mana < ab.mana) { this.ui.log(`${ab.name} not ready`); return; }
    p.mana -= ab.mana;
    p.cooldowns[key] = ab.cd * p.cdMul;
    const target = pt ? pt.clone() : p.root.position.clone();
    this._doCast(p, key, target, true);
    if (this.net) this.net.send("pcast", { key, tx: target.x, tz: target.z });
  }

  _doCast(p, key, target, isLocal) {
    this._setAnim(p, key === "W" ? "run" : "cast", true);
    const dir = target.clone().sub(p.root.position); dir.y = 0;
    if (dir.lengthSq() > 0.001) p.facing = Math.atan2(dir.x, dir.z);

    if (key === "Q") {
      this._spawnProjectile(p, p.root.position.clone(), dir.clone().normalize(), {
        speed: 28, dmg: 30 * p.dmgMul, radius: 0.4, color: 0x5fd6ff, life: 1.2,
      });
    } else if (key === "W") {
      const d = dir.clone().normalize().multiplyScalar(8);
      p.root.position.add(d);
      this._clampArena(p.root.position);
      this._spawnBurst(p.root.position, 0x7bffb0, 14);
    } else if (key === "E") {
      this._spawnBurst(p.root.position, 0xffcf5f, 30);
      this._aoeDamage(p.root.position, ABILITIES.E.range, 45 * p.dmgMul, p);
    } else if (key === "R") {
      // Storm: repeated AoE at target
      let ticks = 6;
      const tick = () => {
        if (ticks-- <= 0) return;
        this._spawnBurst(target, 0xc06bff, 20);
        this._aoeDamage(target, ABILITIES.R.range, 40 * p.dmgMul, p);
        setTimeout(tick, 350);
      };
      tick();
    }
  }

  _spawnProjectile(owner, pos, dir, opt) {
    const mesh = new THREE.Mesh(
      facet(new THREE.IcosahedronGeometry(opt.radius, 0)),
      new THREE.MeshStandardMaterial({ color: opt.color, emissive: opt.color, emissiveIntensity: 1.4 })
    );
    mesh.position.copy(pos); mesh.position.y = 1.1;
    this.scene.add(mesh);
    this.projectiles.push({ mesh, dir, ...opt, owner, traveled: 0 });
  }

  _spawnBurst(pos, color, count) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(facet(new THREE.TetrahedronGeometry(0.18)),
        new THREE.MeshBasicMaterial({ color }));
      m.position.copy(pos); m.position.y = 1;
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 8;
      this.effects.push({ mesh: m, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 3 + Math.random() * 4, life: 0.6 });
      this.scene.add(m);
    }
  }

  _aoeDamage(center, radius, dmg, source) {
    for (const e of this.entities.values()) {
      if (e.team !== TEAM.ENEMY || !e.alive) continue;
      if (e.root.position.distanceTo(center) <= radius + 0.6) this._damage(e, dmg, source);
    }
  }

  _damage(e, dmg, source) {
    if (!e.alive) return;
    let final = dmg;
    if (source && Math.random() < source.crit) { final *= 2; }
    e.hp -= final;
    if (source && source.lifesteal) {
      source.hp = Math.min(source.maxHp, source.hp + final * source.lifesteal);
    }
    if (e.healthbar) {
      const f = Math.max(0, e.hp / e.maxHp);
      e.healthbar.fg.scale.x = f;
      e.healthbar.fg.position.x = -(1.36 * (1 - f)) / 2;
    }
    if (this.net && this.net.isHost) this.net.send("ehit", { id: e.id, hp: e.hp });
    if (e.hp <= 0) {
      if (source && source.isLocal !== undefined) this._reward(source, e);
      this._killEntity(e);
    }
  }

  _reward(p, e) {
    p.gold += e.gold;
    p.xp += e.xp;
    if (p.xp >= p.xpNeed && p.isLocal) {
      p.xp -= p.xpNeed;
      p.level++;
      p.xpNeed = Math.floor(p.xpNeed * 1.4 + 4);
      this._offerUpgrade();
    }
  }

  _killEntity(e) {
    if (!e.alive) return;
    e.alive = false;
    this._spawnBurst(e.root.position, 0xffaa44, 18);
    this.scene.remove(e.root);
    this.entities.delete(e.id);
    if (e.kind === "boss") this.ui.log("Boss slain! 🏆");
  }

  _clampArena(pos) {
    const d = Math.hypot(pos.x, pos.z);
    if (d > ARENA - 1) { pos.x = (pos.x / d) * (ARENA - 1); pos.z = (pos.z / d) * (ARENA - 1); }
  }

  // ---------- roguelike waves ----------
  _offerUpgrade() {
    this.pendingUpgrade = true;
    this.paused = true;
    const picks = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
    this.ui.showUpgrades(picks, (u) => {
      u.apply(this.local);
      this.pendingUpgrade = false;
      this.paused = false;
      this.ui.log(`Gained: ${u.name}`);
    });
  }

  _startWave() {
    this.wave++;
    const isBossWave = this.wave % 5 === 0;
    if (isBossWave) {
      const e = this._spawnEnemy(undefined, undefined, "boss");
      if (this.net && this.net.isHost) this.net.send("espawn", { x: e.root.position.x, z: e.root.position.z, kind: "boss", id: e.id });
    } else {
      const count = 4 + this.wave * 2;
      for (let i = 0; i < count; i++) {
        const kind = Math.random() < 0.15 + this.wave * 0.01 ? "elite" : "creep";
        const e = this._spawnEnemy(undefined, undefined, kind);
        if (this.net && this.net.isHost) this.net.send("espawn", { x: e.root.position.x, z: e.root.position.z, kind, id: e.id });
      }
    }
    this.ui.log(`Wave ${this.wave}${isBossWave ? " — BOSS" : ""}`);
  }

  enemiesAlive() {
    let n = 0;
    for (const e of this.entities.values()) if (e.team === TEAM.ENEMY && e.alive) n++;
    return n;
  }

  // ---------- animation state ----------
  _setAnim(p, name, oneShot = false) {
    if (p.current === name && !oneShot) return;
    const next = p.actions[name];
    if (!next) return;
    if (oneShot) {
      next.reset();
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      next.fadeIn(0.05).play();
      // return to locomotion after
      setTimeout(() => { if (p.alive) this._setAnim(p, p.moveTarget ? "run" : "idle"); }, next.getClip().duration * 1000);
      return;
    }
    const prev = p.actions[p.current];
    next.reset().fadeIn(0.15).play();
    if (prev && prev !== next) prev.fadeOut(0.15);
    p.current = name;
  }

  // ---------- main loop ----------
  start() {
    this.running = true;
    this.clock.start();
    this._loop();
  }

  _loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this._loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.paused) this._update(dt);
    this._render();
  };

  _update(dt) {
    const local = this.local;
    if (!local || !local.alive) return;

    // wave management (host or solo authoritative)
    if (!this.net || this.net.isHost) {
      if (this.enemiesAlive() === 0) {
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) { this._startWave(); this.waveTimer = 3 + this.wave * 0.3; }
      }
    }

    // local player movement
    if (local.moveTarget) {
      const to = local.moveTarget.clone().sub(local.root.position); to.y = 0;
      const dist = to.length();
      if (dist < 0.3) { local.moveTarget = null; this.moveRing.material.opacity = 0; this._setAnim(local, "idle"); }
      else {
        to.normalize();
        local.root.position.addScaledVector(to, local.speed * dt);
        this._clampArena(local.root.position);
        local.facing = Math.atan2(to.x, to.z);
        if (local.current !== "cast") this._setAnim(local, "run");
      }
    }
    local.root.rotation.y = local.facing;

    // regen
    local.mana = Math.min(local.maxMana, local.mana + local.manaRegen * dt);
    local.hp = Math.min(local.maxHp, local.hp + local.hpRegen * dt);
    for (const k of ["Q", "W", "E", "R"]) local.cooldowns[k] = Math.max(0, local.cooldowns[k] - dt);

    // periodic net broadcast of position
    this._netAccum = (this._netAccum || 0) + dt;
    if (this.net && this._netAccum > 0.1) {
      this._netAccum = 0;
      this.net.send("pstate", { x: local.root.position.x, z: local.root.position.z, hp: local.hp });
    }

    // remote players interpolate
    for (const p of this.players.values()) {
      if (p === local) continue;
      if (p.netTarget) {
        const to = p.netTarget.clone().sub(p.root.position); to.y = 0;
        if (to.length() > 0.1) {
          p.facing = Math.atan2(to.x, to.z);
          p.root.position.addScaledVector(to.normalize(), p.speed * dt);
          this._setAnim(p, "run");
        } else this._setAnim(p, "idle");
        p.root.rotation.y = p.facing;
      }
      p.mixer.update(dt);
    }

    // enemies AI (host/solo simulates; clients still move toward nearest for smoothness)
    const targets = [...this.players.values()].filter((p) => p.alive);
    for (const e of this.entities.values()) {
      if (e.type !== "enemy" || !e.alive) continue;
      // nearest player
      let nearest = null, best = Infinity;
      for (const p of targets) {
        const d = p.root.position.distanceTo(e.root.position);
        if (d < best) { best = d; nearest = p; }
      }
      if (nearest) {
        const to = nearest.root.position.clone().sub(e.root.position); to.y = 0;
        const d = to.length();
        e.root.rotation.y = Math.atan2(to.x, to.z);
        if (d > 1.6) {
          e.root.position.addScaledVector(to.normalize(), e.speed * dt);
        } else {
          // attack
          e.attackCd -= dt;
          if (e.attackCd <= 0) {
            e.attackCd = 1;
            this._setAnim(e, "attack", true);
            if (nearest === local) {
              local.hp -= e.dmg;
              if (local.hp <= 0) this._die();
            }
          }
        }
      }
      e.mixer.update(dt);
    }

    // local auto-attack nearest enemy in range
    local.attackCd -= dt;
    if (local.attackCd <= 0 && !local.moveTarget) {
      let nearest = null, best = 8;
      for (const e of this.entities.values()) {
        if (e.team !== TEAM.ENEMY || !e.alive) continue;
        const d = e.root.position.distanceTo(local.root.position);
        if (d < best) { best = d; nearest = e; }
      }
      if (nearest) {
        local.attackCd = 0.7;
        const dir = nearest.root.position.clone().sub(local.root.position); dir.y = 0;
        local.facing = Math.atan2(dir.x, dir.z);
        this._setAnim(local, "attack", true);
        this._spawnProjectile(local, local.root.position.clone(), dir.normalize(), {
          speed: 24, dmg: 14 * local.dmgMul, radius: 0.3, color: 0xffcf5f, life: 1,
        });
      }
    }

    local.mixer.update(dt);

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      const step = pr.speed * dt;
      pr.mesh.position.addScaledVector(pr.dir, step);
      pr.traveled += step;
      pr.life -= dt;
      let hit = false;
      for (const e of this.entities.values()) {
        if (e.team !== TEAM.ENEMY || !e.alive) continue;
        if (e.root.position.distanceTo(pr.mesh.position) < (e.kind === "boss" ? 2.4 : e.kind === "elite" ? 1.4 : 1)) {
          this._damage(e, pr.dmg, pr.owner);
          hit = true; break;
        }
      }
      if (hit || pr.life <= 0) { this.scene.remove(pr.mesh); this.projectiles.splice(i, 1); }
    }

    // effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const f = this.effects[i];
      f.life -= dt;
      f.vy -= 12 * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.z += f.vz * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.rotation.x += dt * 6; f.mesh.rotation.y += dt * 6;
      if (f.life <= 0 || f.mesh.position.y < 0) { this.scene.remove(f.mesh); this.effects.splice(i, 1); }
    }

    // healthbars face camera
    for (const e of this.entities.values()) {
      if (e.healthbar) e.healthbar.group.quaternion.copy(this.camera.quaternion);
    }

    // camera follow
    const desired = local.root.position.clone().add(this.camOffset);
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(local.root.position.x, 1, local.root.position.z);

    this.ui.updateHUD(local, this.wave, ABILITIES);
  }

  _die() {
    this.local.alive = false;
    this.running = false;
    this.ui.gameOver(this.wave, this.local.gold, this.local.level);
  }

  _render() {
    this.renderer.render(this.scene, this.camera);
  }

  // public: set up local player + optionally start
  setupLocalPlayer(palette) {
    const p = this._spawnPlayer(this.localId, true, palette);
    this.local = p;
    if (this.net) this.net.send("join", { palette: p.palette });
    return p;
  }
}

export function randomPalette() {
  const hues = [0x3a6ea5, 0xa53a6e, 0x6ea53a, 0xa5853a, 0x6e3aa5, 0x3aa5a5];
  const base = hues[(Math.random() * hues.length) | 0];
  return { skin: 0xd8a070, cloth: base, cloth2: (base & 0xfefefe) >> 1, accent: 0xffcf5f };
}

export { ABILITIES, UPGRADES };
