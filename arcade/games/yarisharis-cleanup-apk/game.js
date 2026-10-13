/**
 * CLEANUP PROTOCOL: REVOLT AT HOME
 * 
 * 3D Real-World Action Engine powered by Three.js (WebGL)
 * Features:
 * - Real 3D Environment with dynamic soft shadows, architectural lighting, and materials
 * - Realistic Human Operatives with animated walking stride, equipment, and unique special abilities
 * - Dedicated On-Screen Key Capture button [E / TAP] with instant magnetic extraction
 * - 3 Real-World Sectors: Living Room, Kitchen & Dining, Server Core
 * - 100% Offline Web + Standalone 11.9 MB Android APK
 */

// ========================================================
// 1. PROCEDURAL SOUND SYNTHESIZER (Web Audio API)
// ========================================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicTimer = null;
    this.beatStep = 0;
  }

  init() {
    if (!this.ctx) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
          this.startMusicLoop();
        }
      } catch (e) {}
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    const btn = document.getElementById('audio-toggle-btn');
    if (btn) {
      btn.innerText = this.enabled ? 'AUDIO: ON' : 'AUDIO: OFF';
    }
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.2, pitchDecay = true) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (pitchDecay) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, freq * 0.1), this.ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playUiClick() {
    this.playTone(1200, 'sine', 0.04, 0.1);
  }

  playShoot() {
    if (!this.enabled || !this.ctx) return;
    this.playTone(880, 'triangle', 0.07, 0.12);
  }

  playHit() {
    this.playTone(320, 'square', 0.06, 0.15);
  }

  playShortCircuit() {
    if (!this.enabled || !this.ctx) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playTone(1200 + Math.random() * 800, 'sawtooth', 0.04, 0.1);
      }, i * 35);
    }
  }

  playEmpPulse() {
    if (!this.enabled || !this.ctx) return;
    this.playTone(160, 'sawtooth', 0.45, 0.3, true);
    setTimeout(() => {
      this.playTone(1800, 'sine', 0.25, 0.2, true);
    }, 90);
  }

  playExplosion() {
    if (!this.enabled || !this.ctx) return;
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      whiteNoise.start();
    } catch (e) {}
  }

  playDash() {
    this.playTone(420, 'sine', 0.16, 0.18);
  }

  playKeyPickup() {
    if (!this.enabled || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.12, 0.22, false);
      }, idx * 55);
    });
  }

  playVictory() {
    if (!this.enabled || !this.ctx) return;
    const victoryChord = [440, 554.37, 659.25, 880];
    victoryChord.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.45, 0.2, false), idx * 110);
    });
  }

  playAlert() {
    this.playTone(620, 'sawtooth', 0.14, 0.2, false);
    setTimeout(() => this.playTone(780, 'sawtooth', 0.18, 0.25, false), 150);
  }

  startMusicLoop() {
    if (this.musicTimer) return;
    const bassline = [110, 110, 130.81, 110, 146.83, 110, 98, 123.47];
    this.musicTimer = setInterval(() => {
      if (!this.enabled || !this.ctx || (window.game && window.game.state !== 'PLAYING')) return;
      const freq = bassline[this.beatStep % bassline.length];
      this.playTone(freq, 'sine', 0.12, 0.06);
      if (this.beatStep % 2 === 0) {
        this.playTone(1800, 'triangle', 0.03, 0.03);
      }
      this.beatStep++;
    }, 240);
  }
}

const sfx = new SoundFX();


// ========================================================
// 2. PROCEDURAL HIGH-RES TEXTURE GENERATOR
// ========================================================
class TextureGenerator {
  static createParquetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Warm cream / beige architectural plank tiles (exact match to reference image)
    const plankH = 28;
    const plankW = 140;
    const tones = ['#f4ece2', '#eae1d5', '#ded5c7', '#ebe2d6', '#f0e7dc'];

    for (let y = 0; y < canvas.height; y += plankH) {
      const rowIndex = Math.floor(y / plankH);
      const xOffset = (rowIndex % 2 === 0) ? 0 : plankW / 2;

      for (let x = -plankW; x < canvas.width + plankW; x += plankW) {
        const toneIdx = Math.abs((Math.floor(x / plankW) * 7 + rowIndex * 13) % tones.length);
        ctx.fillStyle = tones[toneIdx];
        ctx.fillRect(x + xOffset, y, plankW - 1, plankH - 1);

        // Subtle architectural tile texture grain
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        for (let i = 0; i < 3; i++) {
          const gx = x + xOffset + Math.random() * (plankW - 10);
          const gy = y + Math.random() * (plankH - 6);
          ctx.fillRect(gx, gy, 8, 1);
        }

        // Clean grout seams
        ctx.strokeStyle = 'rgba(145, 130, 115, 0.42)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x + xOffset, y, plankW, plankH);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(7, 7);
    return tex;
  }

  static createRugTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base cream woven carpet
    ctx.fillStyle = '#f1ebe1';
    ctx.fillRect(0, 0, 512, 512);

    // Geometric border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, 472, 472);

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 36, 440, 440);

    // Subtle diamond pattern inside
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2;
    for (let x = 60; x < 450; x += 40) {
      for (let y = 60; y < 450; y += 40) {
        ctx.strokeRect(x, y, 30, 30);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  static createMarbleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const tileSize = 64;
    for (let x = 0; x < canvas.width; x += tileSize) {
      for (let y = 0; y < canvas.height; y += tileSize) {
        const alt = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0;
        ctx.fillStyle = alt ? '#ffffff' : '#f8fafc';
        ctx.fillRect(x, y, tileSize - 2, tileSize - 2);

        // Marble veins
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 10);
        ctx.bezierCurveTo(x + 25, y + 35, x + 40, y + 20, x + tileSize - 10, y + tileSize - 10);
        ctx.stroke();

        // Grout seam
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.85)';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  static createTechFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const tileSize = 64;
    for (let x = 0; x < canvas.width; x += tileSize) {
      for (let y = 0; y < canvas.height; y += tileSize) {
        const alt = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0;
        ctx.fillStyle = alt ? '#1e293b' : '#0f172a';
        ctx.fillRect(x, y, tileSize - 2, tileSize - 2);

        // Tech grid mounting screws
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.fillRect(x + 4, y + 4, 3, 3);
        ctx.fillRect(x + tileSize - 7, y + 4, 3, 3);
        ctx.fillRect(x + 4, y + tileSize - 7, 3, 3);
        ctx.fillRect(x + tileSize - 7, y + tileSize - 7, 3, 3);

        ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  static createHazardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 26;
    for (let i = -256; i < 512; i += 52) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }
}


// ========================================================
// 3. OPERATIVE ROSTER & CHARACTER SYSTEM
// ========================================================
const CHARACTERS = {
  alex: {
    id: 'alex',
    name: 'Alex Rivera',
    title: 'Field Hardware Engineer',
    roleTag: 'TECHNICIAN',
    speed: 310,
    health: 100,
    maxHealth: 100,
    water: 100,
    maxWater: 100,
    waterRechargeRate: 28,
    waterEfficiency: 1.25,
    dashCooldown: 1.4,
    specialCooldown: 8.0,
    specialName: 'EMP Voltage Surge',
    damageReduction: 0,
    jacketColor: 0x1e293b,
    vestColor: 0x0284c7,
    tankColor: 0x0284c7,
    skinColor: 0xe2a77f,
    hairColor: 0x1c1917,
    hasPonytail: false,
    hasHelmet: false
  },
  maya: {
    id: 'maya',
    name: 'Maya Chen',
    title: 'Rapid Response Courier',
    roleTag: 'AGILITY',
    speed: 375,
    health: 85,
    maxHealth: 85,
    water: 90,
    maxWater: 90,
    waterRechargeRate: 24,
    waterEfficiency: 1.0,
    dashCooldown: 0.85,
    specialCooldown: 6.0,
    specialName: 'Holo-Decoy Dash',
    damageReduction: 0,
    jacketColor: 0xdc2626,
    vestColor: 0x991b1b,
    tankColor: 0xef4444,
    skinColor: 0xf1c29b,
    hairColor: 0x451a03,
    hasPonytail: true,
    hasHelmet: false
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus Vance',
    title: 'Hazmat Heavy Specialist',
    roleTag: 'HEAVY TANK',
    speed: 250,
    health: 160,
    maxHealth: 160,
    water: 160,
    maxWater: 160,
    waterRechargeRate: 34,
    waterEfficiency: 0.9,
    dashCooldown: 1.9,
    specialCooldown: 9.0,
    specialName: '360° Hydro Deluge',
    damageReduction: 0.35,
    jacketColor: 0xd97706,
    vestColor: 0x78350f,
    tankColor: 0xf59e0b,
    skinColor: 0xd49b72,
    hairColor: 0x334155,
    hasPonytail: false,
    hasHelmet: true
  }
};


// ========================================================
// 4. SHARED GEOMETRIES & MATERIALS (Zero-Lag Object Pool)
// ========================================================
const SPHERE_GEO = new THREE.SphereGeometry(1, 8, 8);
const BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const CYLINDER_GEO = new THREE.CylinderGeometry(1, 1, 1, 8);

const MAT_PLAYER_BULLET = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
const MAT_ENEMY_BULLET = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
const MAT_PARTICLE_WATER = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true });
const MAT_PARTICLE_SPARK = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true });
const MAT_PARTICLE_BLOOD = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true });


// ========================================================
// 5. 3D PROJECTILES & SHOCKWAVES
// ========================================================
class Projectile3D {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Mesh(SPHERE_GEO, MAT_PLAYER_BULLET);
    this.mesh.visible = false;
    this.scene.add(this.mesh);
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = 6;
    this.isPlayer = true;
    this.damage = 28;
    this.life = 0;
  }

  spawn(x, y, z, vx, vy, isPlayer = true, damage = 28, color = 0x0284c7) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.isPlayer = isPlayer;
    this.damage = damage;
    this.radius = isPlayer ? 6 : 8;
    this.life = 1.4;
    this.active = true;

    this.mesh.material = isPlayer ? MAT_PLAYER_BULLET : MAT_ENEMY_BULLET;
    const s = isPlayer ? 3.5 : 5.0;
    this.mesh.scale.set(s, s, s);
    this.mesh.position.set(x, y, z);
    this.mesh.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.mesh.position.x = this.x;
    this.mesh.position.y = this.y;
    this.life -= dt;
    if (this.life <= 0) {
      this.deactivate();
    }
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
  }

  destroy() {
    this.deactivate();
    if (this.mesh && this.mesh.parent) {
      this.scene.remove(this.mesh);
    }
  }
}

class Particle3D {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Mesh(SPHERE_GEO, MAT_PARTICLE_WATER.clone());
    this.mesh.visible = false;
    this.scene.add(this.mesh);
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.maxLife = 0.5;
    this.life = 0;
  }

  spawn(x, y, z, vx, vy, vz, colorHex, size, life) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.maxLife = life;
    this.life = life;
    this.active = true;

    this.mesh.material.color.setHex(colorHex);
    this.mesh.material.opacity = 1.0;
    this.mesh.scale.set(size, size, size);
    this.mesh.position.set(x, y, z);
    this.mesh.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    this.vz -= 280 * dt; // gravity
    if (this.z < 2) {
      this.z = 2;
      this.vz = 0;
    }

    this.mesh.position.set(this.x, this.y, this.z);
    this.life -= dt;
    this.mesh.material.opacity = Math.max(0, this.life / this.maxLife);
    if (this.life <= 0) {
      this.deactivate();
    }
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
  }

  destroy() {
    this.deactivate();
    if (this.mesh && this.mesh.parent) {
      this.scene.remove(this.mesh);
    }
  }
}

class ShockwaveRing3D {
  constructor(scene, x, y, maxRadius, colorHex) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.maxRadius = maxRadius;
    this.life = 0.5;
    this.maxLife = 0.5;

    const geo = new THREE.RingGeometry(8, 14, 28);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, y, 4);
    this.scene.add(this.mesh);
  }

  update(dt) {
    this.life -= dt;
    const progress = 1 - (this.life / this.maxLife);
    this.radius = 10 + progress * this.maxRadius;

    this.mesh.scale.set(this.radius / 10, this.radius / 10, 1);
    this.mesh.material.opacity = Math.max(0, (this.life / this.maxLife) * 0.8);
  }

  destroy() {
    if (this.mesh && this.mesh.parent) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}


// ========================================================
// 6. 3D HUMAN OPERATIVE (PLAYER) - HUNTER ASSASSIN STYLE
// ========================================================
class Player3D {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.z = 0;
    this.radius = 18;
    this.speed = 310;
    this.vx = 0;
    this.vy = 0;

    this.health = 100;
    this.maxHealth = 100;
    this.water = 100;
    this.maxWater = 100;
    this.waterRechargeRate = 28;
    this.waterEfficiency = 1.0;
    this.damageReduction = 0;

    this.dashTimer = 0;
    this.dashCooldown = 1.4;
    this.dashDuration = 0.22;
    this.isDashing = false;

    this.empCooldown = 8.0;
    this.empTimer = 0;

    this.characterId = 'alex';
    this.charSpec = CHARACTERS.alex;

    this.angle = 0;
    this.fireCooldown = 0;
    this.overdriveTimer = 0;
    this.keysCollected = 0;

    this.walkCycle = 0;
    this.isMoving = false;
    this.muzzleFlash = 0;

    // Rigged 3D Human Model & Animation Mixer
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;
    this.cachedModels = {};

    this.buildMesh();
    this.loadGLTFModel(this.characterId);
  }

  buildMesh() {
    this.group = new THREE.Group();
    this.group.position.set(this.x, this.y, 0);

    // Procedural Fallback Mesh Group
    this.proceduralGroup = new THREE.Group();
    this.group.add(this.proceduralGroup);

    // Realistic Rigged Human GLTF Model Group
    this.gltfGroup = new THREE.Group();
    this.group.add(this.gltfGroup);

    const spec = this.charSpec;

    // Materials for procedural fallback
    this.matSkin = new THREE.MeshLambertMaterial({ color: spec.skinColor });
    this.matJacket = new THREE.MeshLambertMaterial({ color: spec.jacketColor });
    this.matVest = new THREE.MeshLambertMaterial({ color: spec.vestColor });
    this.matBoots = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    this.matTank = new THREE.MeshLambertMaterial({ color: spec.tankColor });
    this.matGun = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    this.matMetal = new THREE.MeshLambertMaterial({ color: 0x64748b });

    // 1. Articulated Legs & Boots
    this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 16), this.matJacket);
    this.leftLeg.position.set(-6, 0, 8);
    this.leftLeg.castShadow = true;
    this.proceduralGroup.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 16), this.matJacket);
    this.rightLeg.position.set(6, 0, 8);
    this.rightLeg.castShadow = true;
    this.proceduralGroup.add(this.rightLeg);

    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(6.5, 9, 5), this.matBoots);
    lBoot.position.set(0, 1.5, -6);
    this.leftLeg.add(lBoot);

    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(6.5, 9, 5), this.matBoots);
    rBoot.position.set(0, 1.5, -6);
    this.rightLeg.add(rBoot);

    // 2. Torso, Tactical Vest, Utility Belt
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 16), this.matJacket);
    this.torso.position.set(0, 0, 24);
    this.torso.castShadow = true;
    this.proceduralGroup.add(this.torso);

    this.vest = new THREE.Mesh(new THREE.BoxGeometry(19, 13, 13), this.matVest);
    this.vest.position.set(0, 0, 0);
    this.torso.add(this.vest);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(20, 13.5, 3), this.matBoots);
    belt.position.set(0, 0, -6);
    this.torso.add(belt);

    // 3. Dual Canister Pressurized Tactical Backpack
    this.backpack = new THREE.Group();
    this.backpack.position.set(0, -8, 24);

    const tankGeo = new THREE.CylinderGeometry(3.5, 3.5, 14, 8);
    const lTank = new THREE.Mesh(tankGeo, this.matTank);
    lTank.position.set(-4.5, 0, 0);
    lTank.castShadow = true;
    this.backpack.add(lTank);

    const rTank = new THREE.Mesh(tankGeo, this.matTank);
    rTank.position.set(4.5, 0, 0);
    rTank.castShadow = true;
    this.backpack.add(rTank);
    this.proceduralGroup.add(this.backpack);

    // 4. Head & Headgear
    this.head = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 10), this.matSkin);
    this.head.position.set(0, 0, 36);
    this.head.castShadow = true;
    this.proceduralGroup.add(this.head);

    this.ponytail = new THREE.Mesh(new THREE.ConeGeometry(3, 14, 6), new THREE.MeshLambertMaterial({ color: spec.hairColor }));
    this.ponytail.position.set(0, -6, 2);
    this.ponytail.rotation.x = Math.PI / 2.5;
    this.ponytail.visible = spec.hasPonytail;
    this.head.add(this.ponytail);

    this.helmet = new THREE.Mesh(new THREE.SphereGeometry(6.4, 8, 8), new THREE.MeshLambertMaterial({ color: 0x0f172a }));
    this.helmet.position.set(0, 0, 1);
    this.head.add(this.helmet);

    // 5. Arms & Water Blaster Rifle
    this.rifle = new THREE.Group();
    this.rifle.position.set(8, 12, 23);

    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(5, 20, 6), this.matGun);
    gunBody.position.set(0, 6, 0);
    this.rifle.add(gunBody);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 16, 8), this.matMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 18, 1);
    this.rifle.add(barrel);

    // Soft translucent aim cone / flashlight beam on floor (Hunter Assassin style)
    const coneGeo = new THREE.ConeGeometry(46, 260, 24);
    coneGeo.translate(0, 130, 0);
    coneGeo.rotateX(-Math.PI / 2);
    this.aimConeMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    this.aimCone = new THREE.Mesh(coneGeo, this.aimConeMat);
    this.aimCone.position.set(0, 8, -22); // Project onto floor
    this.rifle.add(this.aimCone);

    // Muzzle Point Light for Flash
    this.muzzleLight = new THREE.PointLight(0x38bdf8, 0, 140);
    this.muzzleLight.position.set(0, 26, 1);
    this.rifle.add(this.muzzleLight);

    // Tactical footprint radar ring on the floor (exact match to reference image)
    const ringGeo = new THREE.RingGeometry(24, 25.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    this.groundRing = new THREE.Mesh(ringGeo, ringMat);
    this.groundRing.position.set(0, 0, 0.4);
    this.group.add(this.groundRing);

    this.group.add(this.rifle);
    this.scene.add(this.group);
  }

  loadGLTFModel(charId) {
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.warn("THREE.GLTFLoader not loaded, staying on procedural operative.");
      return;
    }

    const modelPath = 'assets/Soldier.glb';

    if (this.cachedModels[charId]) {
      this.activateGLTFModel(charId, this.cachedModels[charId]);
      return;
    }

    const loader = new THREE.GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        this.cachedModels[charId] = gltf;
        this.activateGLTFModel(charId, gltf);
      },
      undefined,
      (err) => {
        console.warn("Could not load Soldier.glb:", err);
      }
    );
  }

  activateGLTFModel(charId, gltf) {
    while (this.gltfGroup.children.length > 0) {
      this.gltfGroup.remove(this.gltfGroup.children[0]);
    }

    const wrapper = new THREE.Group();
    // Convert glTF (+Y up, +Z fwd) to game (+Z up, +Y fwd)
    wrapper.rotation.x = Math.PI / 2;
    wrapper.rotation.y = Math.PI;

    const scene = gltf.scene;

    // Calculate height and scale to realistic human proportion
    const box = new THREE.Box3().setFromObject(scene);
    const height = box.max.y - box.min.y;
    // Scale: Marcus heavy 52, Maya agile 45, Alex balanced 48
    const targetHeight = (charId === 'marcus') ? 52 : (charId === 'maya' ? 45 : 48);
    const s = targetHeight / (height || 1.83);
    scene.scale.set(s, s, s);
    scene.position.y = -box.min.y * s;

    // Tactical Visor & Armor styling matching Reference UI Portrait
    const visorColor = (charId === 'marcus') ? 0xef4444 : (charId === 'maya' ? 0xf59e0b : 0x38bdf8);
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const name = (child.name || '').toLowerCase();
        const matName = (child.material && child.material.name ? child.material.name : '').toLowerCase();
        if (name.includes('visor') || matName.includes('visor')) {
          child.material = new THREE.MeshBasicMaterial({ color: visorColor });
        } else if (child.material) {
          if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
            child.material.roughness = 0.55;
            child.material.metalness = 0.2;
          }
        }
      }
    });

    wrapper.add(scene);
    this.gltfGroup.add(wrapper);

    // Setup Animation Mixer
    this.mixer = new THREE.AnimationMixer(scene);
    this.actions = {};
    gltf.animations.forEach((clip) => {
      const n = clip.name.toLowerCase();
      if (n.includes('idle')) this.actions.idle = this.mixer.clipAction(clip);
      else if (n.includes('run')) this.actions.run = this.mixer.clipAction(clip);
      else if (n.includes('walk')) this.actions.walk = this.mixer.clipAction(clip);
    });

    if (this.actions.idle) {
      this.actions.idle.play();
      this.currentAction = this.actions.idle;
    }

    // Hide procedural mesh, reveal realistic rigged human model!
    if (this.proceduralGroup) {
      this.proceduralGroup.visible = false;
    }
    this.gltfGroup.visible = true;
  }

  applyCharacter(charId) {
    this.characterId = charId || 'alex';
    const spec = CHARACTERS[this.characterId] || CHARACTERS.alex;
    this.charSpec = spec;
    this.speed = spec.speed;
    this.health = spec.health;
    this.maxHealth = spec.maxHealth;
    this.water = spec.water;
    this.maxWater = spec.maxWater;
    this.waterRechargeRate = spec.waterRechargeRate;
    this.waterEfficiency = spec.waterEfficiency;
    this.dashCooldown = spec.dashCooldown;
    this.empCooldown = spec.specialCooldown;
    this.damageReduction = spec.damageReduction;

    if (this.matJacket) this.matJacket.color.setHex(spec.jacketColor);
    if (this.matVest) this.matVest.color.setHex(spec.vestColor);
    if (this.matTank) this.matTank.color.setHex(spec.tankColor);
    if (this.matSkin) this.matSkin.color.setHex(spec.skinColor);

    if (this.ponytail) this.ponytail.visible = spec.hasPonytail;
    if (this.helmet) {
      this.helmet.material.color.setHex(spec.hasHelmet ? 0xb45309 : (this.characterId === 'alex' ? 0x0f172a : 0xdc2626));
    }

    // Load or switch rigged 3D human model
    this.loadGLTFModel(this.characterId);
  }

  update(dt, input, map, aimTargetWorld) {
    if (this.overdriveTimer > 0) this.overdriveTimer -= dt;

    if (this.dashTimer > 0) this.dashTimer -= dt;
    if (this.isDashing) {
      if (this.dashTimer < this.dashCooldown - this.dashDuration) {
        this.isDashing = false;
      }
    }

    if (this.empTimer > 0) this.empTimer -= dt;

    if (this.water < this.maxWater) {
      this.water = Math.min(this.maxWater, this.water + this.waterRechargeRate * dt);
    }

    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy += 1;
    if (input.down) dy -= 1;

    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    const currentSpeed = this.isDashing ? this.speed * 2.8 : this.speed;
    const targetVx = dx * currentSpeed;
    const targetVy = dy * currentSpeed;

    this.vx += (targetVx - this.vx) * 0.28;
    this.vy += (targetVy - this.vy) * 0.28;

    this.moveWithCollision(this.vx * dt, this.vy * dt, map);

    const speedMag = Math.hypot(this.vx, this.vy);
    this.isMoving = speedMag > 25;

    // Rigged 3D Animation Blending (Idle <-> Walk <-> Run)
    if (this.mixer) {
      this.mixer.update(dt);
      let targetAction = this.actions.idle;
      if (this.isDashing && this.actions.run) {
        targetAction = this.actions.run;
        targetAction.timeScale = 1.35;
      } else if (this.isMoving && this.actions.walk) {
        targetAction = this.actions.walk;
        targetAction.timeScale = Math.min(1.8, Math.max(0.7, speedMag / 240));
      }

      if (targetAction && targetAction !== this.currentAction) {
        if (this.currentAction) this.currentAction.fadeOut(0.18);
        targetAction.reset().fadeIn(0.18).play();
        this.currentAction = targetAction;
      }
    } else {
      // Procedural fallback animation
      if (this.isMoving) {
        this.walkCycle += dt * (speedMag / 25);
        const swing = Math.sin(this.walkCycle * 6) * 0.55;
        this.leftLeg.rotation.x = swing;
        this.rightLeg.rotation.x = -swing;
        if (this.ponytail && this.ponytail.visible) {
          this.ponytail.rotation.z = Math.sin(this.walkCycle * 6) * 0.3;
        }
      } else {
        this.leftLeg.rotation.x = 0;
        this.rightLeg.rotation.x = 0;
      }
    }

    // Set Aim Angle: 100% accurate 3D world raycast or touch
    if (input.isTouchAiming) {
      this.angle = input.touchAimAngle;
    } else if (aimTargetWorld) {
      this.angle = Math.atan2(aimTargetWorld.y - this.y, aimTargetWorld.x - this.x);
    }

    this.group.position.set(this.x, this.y, 0);
    this.group.rotation.z = this.angle - Math.PI / 2;

    if (this.groundRing) {
      this.groundRing.rotation.z += dt * 0.4;
    }

    if (this.muzzleFlash > 0) {
      this.muzzleFlash -= dt * 10;
      this.muzzleLight.intensity = Math.max(0, this.muzzleFlash * 2.5);
    }

    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    if (input.isShooting && this.fireCooldown <= 0) {
      this.shoot();
    }
  }

  moveWithCollision(dx, dy, map) {
    const newX = this.x + dx;
    if (!map.isCollidingWithWall(newX, this.y, this.radius)) {
      this.x = newX;
    }
    const newY = this.y + dy;
    if (!map.isCollidingWithWall(this.x, newY, this.radius)) {
      this.y = newY;
    }
  }

  triggerEmpBomb() {
    if (this.empTimer <= 0) {
      this.empTimer = this.empCooldown;
      sfx.playEmpPulse();
      window.game.addScreenShake(18);

      if (this.characterId === 'alex') {
        const shockRadius = 420;
        window.game.shockwaves.push(new ShockwaveRing3D(this.scene, this.x, this.y, shockRadius, 0x38bdf8));
        window.game.spawnFloatingText("EMP VOLTAGE SURGE", this.x, this.y, '#38bdf8', 16);

        // Clear enemy projectiles
        for (let p of window.game.projectiles) {
          if (p.active && !p.isPlayer && Math.hypot(p.x - this.x, p.y - this.y) < shockRadius) {
            p.deactivate();
          }
        }

        for (let enemy of window.game.enemies) {
          if (Math.hypot(enemy.x - this.x, enemy.y - this.y) < shockRadius) {
            enemy.stunTimer = 4.5;
            enemy.takeDamage(40);
            window.game.spawnFloatingText("CIRCUITS FRIED [4.5s]", enemy.x, enemy.y, '#fbbf24', 13);
          }
        }
      } 
      else if (this.characterId === 'maya') {
        const shockRadius = 380;
        window.game.shockwaves.push(new ShockwaveRing3D(this.scene, this.x, this.y, shockRadius, 0xef4444));
        window.game.spawnFloatingText("HOLO-DECOY SURGE", this.x, this.y, '#ef4444', 16);

        for (let i = 0; i < 18; i++) {
          window.game.spawnParticle(
            this.x, this.y, 20,
            (Math.random() - 0.5) * 160, (Math.random() - 0.5) * 160, 80 + Math.random() * 80,
            0xf87171, 3.5, 0.7
          );
        }

        for (let enemy of window.game.enemies) {
          if (Math.hypot(enemy.x - this.x, enemy.y - this.y) < shockRadius) {
            enemy.stunTimer = 3.0;
            enemy.takeDamage(25);
            window.game.spawnFloatingText("SENSORS CONFUSED", enemy.x, enemy.y, '#f87171', 12);
          }
        }

        this.dashTimer = 0;
        this.dash();
      } 
      else if (this.characterId === 'marcus') {
        const shockRadius = 450;
        window.game.shockwaves.push(new ShockwaveRing3D(this.scene, this.x, this.y, shockRadius, 0xfbbf24));
        window.game.spawnFloatingText("360° HYDRO DELUGE", this.x, this.y, '#fbbf24', 18);

        const numStreams = 16;
        const blastSpeed = 650;
        for (let i = 0; i < numStreams; i++) {
          const a = (i / numStreams) * Math.PI * 2;
          window.game.spawnProjectile(
            this.x + Math.cos(a) * 20, this.y + Math.sin(a) * 20, 24,
            Math.cos(a) * blastSpeed, Math.sin(a) * blastSpeed,
            true, 50, 0x0284c7
          );
        }

        for (let enemy of window.game.enemies) {
          const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
          if (d < shockRadius && d > 0) {
            enemy.x += ((enemy.x - this.x) / d) * 120;
            enemy.y += ((enemy.y - this.y) / d) * 120;
            enemy.stunTimer = 2.0;
            enemy.takeDamage(45);
          }
        }
      }
    }
  }

  dash() {
    if (this.dashTimer <= 0) {
      this.dashTimer = this.dashCooldown;
      this.isDashing = true;
      sfx.playDash();
      window.game.addScreenShake(6);
      window.game.spawnFloatingText(this.characterId === 'maya' ? "SONIC DASH" : "EVASIVE DASH", this.x, this.y, '#fbbf24', 13);

      const col = this.characterId === 'maya' ? 0xef4444 : (this.characterId === 'marcus' ? 0xfbbf24 : 0x38bdf8);
      for (let i = 0; i < 12; i++) {
        window.game.spawnParticle(
          this.x, this.y, 18,
          (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 60 + Math.random() * 60,
          col, 3.5, 0.4
        );
      }
    }
  }

  shoot() {
    let cost = this.overdriveTimer > 0 ? 3 : 7;
    if (this.waterEfficiency && this.waterEfficiency > 1) {
      cost = Math.max(2, Math.round(cost / this.waterEfficiency));
    }

    if (this.water < cost) {
      if (Math.random() < 0.15) {
        window.game.spawnFloatingText("RECHARGING TANK...", this.x, this.y, '#ef4444', 12);
      }
      return;
    }

    this.water -= cost;
    this.fireCooldown = this.overdriveTimer > 0 ? 0.08 : 0.16;
    this.muzzleFlash = 1.0;
    sfx.playShoot();

    const forwardX = Math.cos(this.angle);
    const forwardY = Math.sin(this.angle);
    const muzzleX = this.x + forwardX * 28;
    const muzzleY = this.y + forwardY * 28;
    const baseSpeed = 750;

    if (this.overdriveTimer > 0) {
      [-0.18, 0, 0.18].forEach(angOffset => {
        const finalAng = this.angle + angOffset;
        window.game.spawnProjectile(
          muzzleX, muzzleY, 24,
          Math.cos(finalAng) * baseSpeed, Math.sin(finalAng) * baseSpeed,
          true, 36, 0x38bdf8
        );
      });
    } else {
      const spread = (Math.random() - 0.5) * 0.08;
      const finalAng = this.angle + spread;
      window.game.spawnProjectile(
        muzzleX, muzzleY, 24,
        Math.cos(finalAng) * baseSpeed, Math.sin(finalAng) * baseSpeed,
        true, 28, 0x0284c7
      );
    }
  }

  takeDamage(amount) {
    if (this.isDashing) return; // i-frames
    if (this.damageReduction > 0) {
      amount = Math.round(amount * (1 - this.damageReduction));
    }
    this.health = Math.max(0, this.health - amount);
    sfx.playHit();
    window.game.addScreenShake(12);

    window.game.spawnFloatingText(`-${amount}`, this.x, this.y, '#ef4444', 16);

    for (let i = 0; i < 6; i++) {
      window.game.spawnParticle(
        this.x, this.y, 22,
        (Math.random() - 0.5) * 140, (Math.random() - 0.5) * 140, 60 + Math.random() * 80,
        0xef4444, 3, 0.3
      );
    }

    if (this.health <= 0) {
      window.game.triggerGameOver();
    }
  }

  destroy() {
    if (this.group && this.group.parent) {
      this.scene.remove(this.group);
    }
  }
}


// ========================================================
// 7. 3D ROBOTIC ENEMIES
// ========================================================
class Enemy3D {
  constructor(scene, x, y, type = 'ROOMBA') {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = type;
    this.markedForDeletion = false;

    this.health = type === 'BOSS' ? 1200 : (type === 'TOASTER' ? 80 : (type === 'DRONE' ? 55 : 45));
    this.maxHealth = this.health;
    this.speed = type === 'BOSS' ? 95 : (type === 'DRONE' ? 180 : (type === 'TOASTER' ? 120 : 160));
    this.radius = type === 'BOSS' ? 55 : (type === 'TOASTER' ? 22 : (type === 'DRONE' ? 18 : 20));

    this.stunTimer = 0;
    this.shootTimer = Math.random() * 2;
    this.isKeyCarrier = false;
    this.timeAlive = Math.random() * 10;

    this.buildMesh();
  }

  buildMesh() {
    this.group = new THREE.Group();
    this.group.position.set(this.x, this.y, 0);

    if (this.type === 'ROOMBA') {
      const geo = new THREE.CylinderGeometry(this.radius, this.radius + 1, 7, 24);
      this.mat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.25 });
      this.body = new THREE.Mesh(geo, this.mat);
      this.body.rotation.x = Math.PI / 2;
      this.body.position.z = 3.5;
      this.body.castShadow = true;
      this.group.add(this.body);

      // Top outer bevel rim (matching dark disc in reference image)
      const rim = new THREE.Mesh(new THREE.RingGeometry(this.radius * 0.65, this.radius * 0.95, 24), new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide }));
      rim.position.z = 7.1;
      this.group.add(rim);

      // Top center glowing red sensor eye (exact match to reference image)
      const dome = new THREE.Mesh(new THREE.SphereGeometry(5.5, 12, 12), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      dome.position.set(0, 0, 7.5);
      this.group.add(dome);

      const eyeGlow = new THREE.PointLight(0xef4444, 0.45, 50);
      eyeGlow.position.set(0, 0, 9);
      this.group.add(eyeGlow);
    } 
    else if (this.type === 'DRONE') {
      this.body = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 8), new THREE.MeshLambertMaterial({ color: 0x0f172a }));
      this.body.position.z = 24;
      this.body.castShadow = true;
      this.group.add(this.body);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(3.5, 6, 6), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
      eye.position.set(0, 7, 24);
      this.group.add(eye);

      this.rotors = [];
      [[-12, -12], [12, -12], [-12, 12], [12, 12]].forEach(([rx, ry]) => {
        const rMesh = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 }));
        rMesh.rotation.x = Math.PI / 2;
        rMesh.position.set(rx, ry, 28);
        this.group.add(rMesh);
        this.rotors.push(rMesh);
      });
    } 
    else if (this.type === 'TOASTER') {
      this.body = new THREE.Mesh(new THREE.BoxGeometry(24, 18, 16), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 }));
      this.body.position.z = 8;
      this.body.castShadow = true;
      this.group.add(this.body);

      const coil1 = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 2), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      coil1.position.set(0, -4, 16.5);
      this.group.add(coil1);

      const coil2 = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 2), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
      coil2.position.set(0, 4, 16.5);
      this.group.add(coil2);
    } 
    else if (this.type === 'BOSS') {
      this.body = new THREE.Mesh(new THREE.CylinderGeometry(55, 65, 30, 12), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 }));
      this.body.rotation.x = Math.PI / 2;
      this.body.position.z = 15;
      this.body.castShadow = true;
      this.group.add(this.body);

      this.bossDome = new THREE.Mesh(new THREE.SphereGeometry(24, 14, 14), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
      this.bossDome.position.set(0, 0, 30);
      this.group.add(this.bossDome);

      this.dish = new THREE.Mesh(new THREE.ConeGeometry(16, 12, 8), new THREE.MeshStandardMaterial({ color: 0x475569 }));
      this.dish.position.set(0, 0, 46);
      this.group.add(this.dish);
    }

    this.scene.add(this.group);
  }

  setKeyCarrier(isCarrier) {
    this.isKeyCarrier = isCarrier;
    if (this.mat) {
      this.mat.color.setHex(0xfbbf24);
    }
    // Add golden halo around key carrier
    if (isCarrier) {
      const halo = new THREE.Mesh(new THREE.RingGeometry(this.radius + 4, this.radius + 8, 20), new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide }));
      halo.position.set(0, 0, 1);
      this.group.add(halo);
    }
  }

  update(dt, player, map) {
    this.timeAlive += dt;

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return;
    }

    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    const angle = Math.atan2(player.y - this.y, player.x - this.x);

    // AI Movement toward player with wall sliding
    if (dist > this.radius + player.radius) {
      const vx = Math.cos(angle) * this.speed * dt;
      const vy = Math.sin(angle) * this.speed * dt;
      if (!map.isCollidingWithWall(this.x + vx, this.y, this.radius)) this.x += vx;
      if (!map.isCollidingWithWall(this.x, this.y + vy, this.radius)) this.y += vy;
    } else {
      player.takeDamage(this.type === 'BOSS' ? 30 : 15);
    }

    this.group.position.set(this.x, this.y, 0);

    if (this.type === 'ROOMBA' && this.blade) {
      this.blade.rotation.z += dt * 30;
      this.group.rotation.z = angle - Math.PI / 2;
    } else if (this.type === 'DRONE') {
      this.group.position.z = 4 + Math.sin(this.timeAlive * 6) * 3;
      if (this.rotors) {
        this.rotors.forEach(r => r.rotation.z += dt * 40);
      }
    } else if (this.type === 'BOSS' && this.dish) {
      this.dish.rotation.z += dt * 4;
    }

    // Shooting logic for Drone, Toaster, Boss
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      if (this.type === 'DRONE') {
        this.shootTimer = 2.2 + Math.random() * 1.0;
        this.fireProjectileAt(player, 360);
      } else if (this.type === 'TOASTER') {
        this.shootTimer = 3.0 + Math.random() * 1.2;
        this.fireProjectileAt(player, 400);
      } else if (this.type === 'BOSS') {
        this.shootTimer = 1.4;
        this.fireBossRadial();
      }
    }
  }

  fireProjectileAt(player, pSpeed) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    window.game.spawnProjectile(
      this.x, this.y, 16,
      Math.cos(angle) * pSpeed, Math.sin(angle) * pSpeed,
      false, 15, 0xf59e0b
    );
  }

  fireBossRadial() {
    const count = 8;
    const speed = 340;
    const offset = Math.sin(this.timeAlive * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + offset;
      window.game.spawnProjectile(
        this.x, this.y, 20,
        Math.cos(a) * speed, Math.sin(a) * speed,
        false, 20, 0xdc2626
      );
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    sfx.playShortCircuit();

    for (let i = 0; i < 3; i++) {
      window.game.spawnParticle(
        this.x, this.y, 14,
        (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, 40 + Math.random() * 50,
        0x38bdf8, 2.5, 0.25
      );
    }

    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    this.markedForDeletion = true;
    sfx.playExplosion();
    window.game.addScreenShake(this.type === 'BOSS' ? 25 : 8);
    window.game.addScore(this.type === 'BOSS' ? 1000 : 100);
    window.game.totalKills++;

    for (let i = 0; i < 14; i++) {
      window.game.spawnParticle(
        this.x, this.y, 15,
        (Math.random() - 0.5) * 160, (Math.random() - 0.5) * 160, 60 + Math.random() * 90,
        0xfbbf24, 3.5, 0.45
      );
    }

    // Drop Breaker Key if key carrier!
    if (this.isKeyCarrier) {
      window.game.pickups.push(new Pickup3D(this.scene, this.x, this.y, 'KEY'));
      window.game.spawnFloatingText("🔑 KEY DROPPED! PRESS [E] OR TAP BUTTON", this.x, this.y, '#fbbf24', 16);
      sfx.playAlert();
    } else {
      const roll = Math.random();
      if (roll < 0.22) {
        window.game.pickups.push(new Pickup3D(this.scene, this.x, this.y, 'HEALTH'));
      } else if (roll < 0.35) {
        window.game.pickups.push(new Pickup3D(this.scene, this.x, this.y, 'OVERDRIVE'));
      }
    }

    this.destroy();
  }

  destroy() {
    if (this.group && this.group.parent) {
      this.scene.remove(this.group);
    }
  }
}


// ========================================================
// 8. 3D PICKUPS (HEALTH, OVERDRIVE, INTERACTIVE KEY)
// ========================================================
class Pickup3D {
  constructor(scene, x, y, type = 'HEALTH') {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = 16;
    this.bobAngle = Math.random() * Math.PI * 2;
    this.markedForDeletion = false;

    this.buildMesh();
  }

  buildMesh() {
    this.group = new THREE.Group();
    this.group.position.set(this.x, this.y, 14);

    if (this.type === 'HEALTH') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      box.castShadow = true;
      this.group.add(box);

      const crossH = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 14.5), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
      this.group.add(crossH);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(3, 10, 14.5), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
      this.group.add(crossV);
    } 
    else if (this.type === 'OVERDRIVE') {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(9), new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, roughness: 0.2 }));
      crystal.castShadow = true;
      this.group.add(crystal);
    } 
    else if (this.type === 'KEY') {
      // 3D FLOATING GOLDEN BREAKER KEY
      const keyMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        metalness: 0.85,
        roughness: 0.15
      });

      const ringGeo = new THREE.TorusGeometry(7, 2, 10, 18);
      const ring = new THREE.Mesh(ringGeo, keyMat);
      ring.position.set(0, -6, 0);
      this.group.add(ring);

      const shaft = new THREE.Mesh(new THREE.BoxGeometry(3, 18, 2.5), keyMat);
      shaft.position.set(0, 5, 0);
      this.group.add(shaft);

      const bit1 = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 2), keyMat);
      bit1.position.set(2.5, 7, 0);
      this.group.add(bit1);

      const bit2 = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 2), keyMat);
      bit2.position.set(2, 11, 0);
      this.group.add(bit2);

      // Vertical Golden Light Beacon (Shoots up to ceiling so player can NEVER miss it!)
      const beaconGeo = new THREE.CylinderGeometry(3, 12, 180, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
      this.beacon = new THREE.Mesh(beaconGeo, beaconMat);
      this.beacon.rotation.x = Math.PI / 2;
      this.beacon.position.set(0, 0, 90);
      this.group.add(this.beacon);

      // Pulsing floor holographic halo
      const haloGeo = new THREE.RingGeometry(18, 24, 24);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
      this.halo = new THREE.Mesh(haloGeo, haloMat);
      this.halo.position.set(0, 0, -12);
      this.group.add(this.halo);
    }

    this.scene.add(this.group);
  }

  update(dt, player) {
    this.bobAngle += 4 * dt;
    this.group.rotation.z += 2 * dt;
    this.group.position.z = 14 + Math.sin(this.bobAngle) * 4;

    const dist = Math.hypot(player.x - this.x, player.y - this.y);

    // Magnetic pull when player is near
    const magnetRange = this.type === 'KEY' ? 220 : 80;
    if (dist < magnetRange && dist > 0) {
      const pullSpeed = (1 - dist / magnetRange) * 360;
      this.x += ((player.x - this.x) / dist) * pullSpeed * dt;
      this.y += ((player.y - this.y) / dist) * pullSpeed * dt;
      this.group.position.x = this.x;
      this.group.position.y = this.y;
    }

    // Capture radius
    if (dist < (this.type === 'KEY' ? 50 : this.radius + player.radius + 8)) {
      this.collect(player);
    }
  }

  collect(player) {
    if (this.markedForDeletion) return;
    this.markedForDeletion = true;
    sfx.playKeyPickup();

    if (this.type === 'HEALTH') {
      player.health = Math.min(player.maxHealth, player.health + 35);
      window.game.spawnFloatingText("+35 HP", this.x, this.y, '#10b981', 15);
    } else if (this.type === 'OVERDRIVE') {
      player.overdriveTimer = 8.0;
      window.game.spawnFloatingText("OVERDRIVE ENGAGED", this.x, this.y, '#34d399', 15);
    } else if (this.type === 'KEY') {
      player.keysCollected++;
      window.game.spawnFloatingText("🔑 BREAKER KEY SECURED!", this.x, this.y, '#fbbf24', 18);
      window.game.checkObjectiveCompletion();
    }

    this.destroy();
  }

  destroy() {
    if (this.group && this.group.parent) {
      this.scene.remove(this.group);
    }
  }
}


// ========================================================
// 9. 3D MAP MANAGER & REAL-WORLD ARCHITECTURE
// ========================================================
class MapManager3D {
  constructor(scene) {
    this.scene = scene;
    this.width = 1800;
    this.height = 1500;
    this.currentSector = 1;

    this.walls = [];
    this.furniture = [];
    this.doors = [];
    this.mainBreaker = null;

    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
  }

  generateSector(sector) {
    this.currentSector = sector;
    this.walls = [];
    this.furniture = [];
    this.doors = [];
    this.mainBreaker = null;

    // Clear previous sector meshes
    while (this.mapGroup.children.length > 0) {
      const obj = this.mapGroup.children[0];
      this.mapGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    }

    // 1. FLOOR MESH
    const floorGeo = new THREE.PlaneGeometry(this.width, this.height);
    let floorMat;

    if (sector === 1) {
      floorMat = new THREE.MeshStandardMaterial({
        map: TextureGenerator.createParquetTexture(),
        roughness: 0.35,
        metalness: 0.05
      });
    } else if (sector === 2) {
      floorMat = new THREE.MeshStandardMaterial({
        map: TextureGenerator.createMarbleTexture(),
        roughness: 0.15,
        metalness: 0.1
      });
    } else {
      floorMat = new THREE.MeshStandardMaterial({
        map: TextureGenerator.createTechFloorTexture(),
        roughness: 0.45,
        metalness: 0.25
      });
    }

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(this.width / 2, this.height / 2, 0);
    floor.receiveShadow = true;
    this.mapGroup.add(floor);

    // 2. BOUNDARY WALLS
    const wallThick = 40;
    const wallHeight = 85;
    this.addWall(0, 0, this.width, wallThick, wallHeight);
    this.addWall(0, this.height - wallThick, this.width, wallThick, wallHeight);
    this.addWall(0, 0, wallThick, this.height, wallHeight);
    this.addWall(this.width - wallThick, 0, wallThick, this.height, wallHeight);

    // 3. SECTOR SPECIFIC REAL-WORLD ARCHITECTURE & FURNITURE
    if (sector === 1) {
      // SECTOR 1: MODERN LUXURY APARTMENT (LIVING ROOM & BALCONY)

      // Area Rug in central lounge
      const rugGeo = new THREE.PlaneGeometry(540, 380);
      const rugMat = new THREE.MeshStandardMaterial({
        map: TextureGenerator.createRugTexture(),
        roughness: 0.8
      });
      const rug = new THREE.Mesh(rugGeo, rugMat);
      rug.position.set(900, 720, 0.5);
      rug.receiveShadow = true;
      this.mapGroup.add(rug);

      // Interior Room Dividing Walls
      this.addWall(450, 40, 30, 400, wallHeight);
      this.addWall(1350, 40, 30, 400, wallHeight);
      this.addWall(450, 950, 30, 510, wallHeight);

      // Sectional Charcoal L-Couch with Cushions
      this.addFurniture(720, 580, 360, 100, 34, 0x334155, "COUCH_MAIN");
      this.addFurniture(980, 680, 100, 180, 34, 0x334155, "COUCH_CHAISE");

      // Tempered Glass & Walnut Coffee Table
      this.addFurniture(790, 750, 160, 70, 18, 0x78350f, "COFFEE_TABLE");

      // Floating Entertainment Console
      this.addFurniture(720, 1100, 360, 55, 24, 0x1e293b, "TV_CONSOLE");

      // 85" Smart OLED TV on wall
      const tvMesh = new THREE.Mesh(new THREE.BoxGeometry(260, 10, 110), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
      tvMesh.position.set(900, 1135, 75);
      this.mapGroup.add(tvMesh);

      // TV Ambient Backlight Glow
      const tvLight = new THREE.PointLight(0x38bdf8, 0.45, 180);
      tvLight.position.set(900, 1130, 75);
      this.mapGroup.add(tvLight);

      // Modern Bookshelf
      this.addFurniture(380, 480, 50, 240, 70, 0x451a03, "BOOKSHELF");

      // Floor Lamp with Warm Pool of Light
      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(8, 12, 60, 10), new THREE.MeshStandardMaterial({ color: 0x64748b }));
      lampBase.rotation.x = Math.PI / 2;
      lampBase.position.set(670, 560, 30);
      this.mapGroup.add(lampBase);

      const lampLight = new THREE.PointLight(0xffedd5, 0.8, 220);
      lampLight.position.set(670, 560, 65);
      this.mapGroup.add(lampLight);

      // Potted Indoor Plants
      this.addPlant(380, 420);
      this.addPlant(1150, 580);
      this.addPlant(1300, 1050);

      // Warm Amber Architectural Illumination in Right Corridor (exact match to reference image)
      const rightRoomAmberLight = new THREE.PointLight(0xffb84d, 1.6, 520);
      rightRoomAmberLight.position.set(1550, 750, 75);
      this.mapGroup.add(rightRoomAmberLight);

      // Sliding Glass Balcony Window on East Wall
      const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(360, 80), new THREE.MeshBasicMaterial({ color: 0xe0f2fe, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
      windowMesh.rotation.y = Math.PI / 2;
      windowMesh.position.set(1755, 750, 45);
      this.mapGroup.add(windowMesh);

      // Exit Door: KITCHEN GATE
      this.addDoor(1450, 1380, 120, 80, 2, "KITCHEN GATE");
    } 
    else if (sector === 2) {
      // SECTOR 2: GOURMET KITCHEN & DINING ROOM
      this.addWall(300, 40, 30, 500, wallHeight);
      this.addWall(1100, 40, 30, 450, wallHeight);
      this.addWall(600, 1150, 650, 30, wallHeight);

      // Central Carrera Marble Island with Bar Stools
      this.addFurniture(620, 600, 380, 160, 36, 0xf8fafc, "KITCHEN_ISLAND");

      // L-Shaped Kitchen Countertop
      this.addFurniture(330, 260, 550, 75, 34, 0x334155, "COUNTER");
      this.addFurniture(330, 335, 75, 420, 34, 0x334155, "COUNTER_SIDE");

      // Stainless Steel Double Refrigerator
      this.addFurniture(330, 520, 75, 130, 70, 0x94a3b8, "FRIDGE");

      // Solid Oak 6-Person Dining Table
      this.addFurniture(1250, 800, 300, 150, 32, 0x451a03, "DINING_TABLE");

      // Dining Chairs
      [[-60, -90], [0, -90], [60, -90], [-60, 90], [0, 90], [60, 90]].forEach(([cx, cy]) => {
        this.addFurniture(1400 + cx, 875 + cy, 32, 32, 28, 0x334155, "CHAIR");
      });

      // Kitchen Pendant Lights
      const pLight = new THREE.PointLight(0xffedd5, 0.75, 260);
      pLight.position.set(810, 680, 70);
      this.mapGroup.add(pLight);

      this.addPlant(1200, 520);

      // Exit Door: BASEMENT ELEVATOR
      this.addDoor(1550, 1380, 120, 80, 3, "BASEMENT ELEVATOR");
    } 
    else if (sector === 3) {
      // SECTOR 3: HIGH-TECH BASEMENT SERVER VAULT
      // 4 Heavy Concrete Pillars with Hazard Stripes
      this.addPillar(500, 450, 95, 95, wallHeight);
      this.addPillar(1300, 450, 95, 95, wallHeight);
      this.addPillar(500, 1050, 95, 95, wallHeight);
      this.addPillar(1300, 1050, 95, 95, wallHeight);

      // 19" Server Racks with Pulsing LEDs
      this.addFurniture(700, 360, 400, 75, 75, 0x0f172a, "SERVER_RACK");
      this.addFurniture(700, 1140, 400, 75, 75, 0x0f172a, "SERVER_RACK");

      // Server rack blinking status lights
      const rackLight1 = new THREE.PointLight(0x10b981, 0.6, 160);
      rackLight1.position.set(900, 370, 50);
      this.mapGroup.add(rackLight1);

      const rackLight2 = new THREE.PointLight(0x0284c7, 0.6, 160);
      rackLight2.position.set(900, 1130, 50);
      this.mapGroup.add(rackLight2);

      // Admin Terminal Desk
      this.addFurniture(900, 750, 220, 70, 30, 0x1e293b, "ADMIN_DESK");

      // MAIN CIRCUIT BREAKER CABINET
      this.mainBreaker = {
        x: 950, y: 700, w: 120, h: 80,
        name: "MAIN CIRCUIT BREAKER",
        activated: false
      };

      const brkMesh = new THREE.Mesh(new THREE.BoxGeometry(120, 80, 75), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 }));
      brkMesh.position.set(950 + 60, 700 + 40, 37.5);
      brkMesh.castShadow = true;
      this.mapGroup.add(brkMesh);

      // Big Red Switch Handle
      this.switchHandle = new THREE.Mesh(new THREE.BoxGeometry(26, 26, 18), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
      this.switchHandle.position.set(950 + 60, 700 + 40, 80);
      this.mapGroup.add(this.switchHandle);

      // High-voltage warning beacon
      const brkLight = new THREE.PointLight(0xf59e0b, 0.7, 180);
      brkLight.position.set(950 + 60, 700 + 40, 95);
      this.mapGroup.add(brkLight);
    }
  }

  addWall(x, y, w, h, depth) {
    this.walls.push({ x, y, w, h });
    const wallGeo = new THREE.BoxGeometry(w, h, depth);
    const wallMat = new THREE.MeshStandardMaterial({ 
      color: 0x1e293b, 
      roughness: 0.75,
      metalness: 0.15 
    });
    const mesh = new THREE.Mesh(wallGeo, wallMat);
    mesh.position.set(x + w / 2, y + h / 2, depth / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mapGroup.add(mesh);

    // Architectural Baseboard / Skirting Trim (Dark slate footer)
    const skirtH = 6;
    const skirtGeo = new THREE.BoxGeometry(w + 1.2, h + 1.2, skirtH);
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.9 });
    const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    skirtMesh.position.set(x + w / 2, y + h / 2, skirtH / 2);
    skirtMesh.receiveShadow = true;
    this.mapGroup.add(skirtMesh);

    // Top Architectural Crown / Cap
    const capH = 4;
    const capGeo = new THREE.BoxGeometry(w + 1.8, h + 1.8, capH);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55 });
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.position.set(x + w / 2, y + h / 2, depth - capH / 2);
    this.mapGroup.add(capMesh);
  }

  addPillar(x, y, w, h, depth) {
    this.walls.push({ x, y, w, h });
    const pGeo = new THREE.BoxGeometry(w, h, depth);
    const pMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createHazardTexture(),
      roughness: 0.6
    });
    const mesh = new THREE.Mesh(pGeo, pMat);
    mesh.position.set(x + w / 2, y + h / 2, depth / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mapGroup.add(mesh);
  }

  addFurniture(x, y, w, h, depth, colorHex, type) {
    this.furniture.push({ x, y, w, h, type });
    const geo = new THREE.BoxGeometry(w, h, depth);
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + w / 2, y + h / 2, depth / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mapGroup.add(mesh);
  }

  addPlant(x, y) {
    // White ceramic minimalist pot (matching reference image)
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(10, 8, 20, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }));
    pot.rotation.x = Math.PI / 2;
    pot.position.set(x, y, 10);
    pot.castShadow = true;
    this.mapGroup.add(pot);

    // Dark soil
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 2, 16), new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 }));
    soil.rotation.x = Math.PI / 2;
    soil.position.set(x, y, 19);
    this.mapGroup.add(soil);

    // Lush green spherical topiary ball (exact match to reference image)
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 16), new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));
    leaves.position.set(x, y, 32);
    leaves.castShadow = true;
    this.mapGroup.add(leaves);
  }

  addDoor(x, y, w, h, targetSector, name) {
    const doorObj = { x, y, w, h, targetSector, unlocked: false, name };
    this.doors.push(doorObj);

    const postGeo = new THREE.BoxGeometry(16, 16, 80);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x334155 });

    const lPost = new THREE.Mesh(postGeo, postMat);
    lPost.position.set(x, y, 40);
    this.mapGroup.add(lPost);

    const rPost = new THREE.Mesh(postGeo, postMat);
    rPost.position.set(x + w, y, 40);
    this.mapGroup.add(rPost);

    const laserGeo = new THREE.PlaneGeometry(w, 70);
    doorObj.laserMat = new THREE.MeshBasicMaterial({ color: 0xdc2626, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
    const laserMesh = new THREE.Mesh(laserGeo, doorObj.laserMat);
    laserMesh.rotation.x = Math.PI / 2;
    laserMesh.position.set(x + w / 2, y, 35);
    this.mapGroup.add(laserMesh);
    doorObj.laserMesh = laserMesh;
  }

  unlockDoor(idx) {
    if (this.doors[idx]) {
      this.doors[idx].unlocked = true;
      if (this.doors[idx].laserMat) {
        this.doors[idx].laserMat.color.setHex(0x10b981);
        this.doors[idx].laserMat.opacity = 0.25;
      }
    }
  }

  isCollidingWithWall(x, y, radius) {
    for (let wall of this.walls) {
      if (
        x + radius > wall.x &&
        x - radius < wall.x + wall.w &&
        y + radius > wall.y &&
        y - radius < wall.y + wall.h
      ) {
        return true;
      }
    }
    for (let f of this.furniture) {
      if (
        x + radius > f.x &&
        x - radius < f.x + f.w &&
        y + radius > f.y &&
        y - radius < f.y + f.h
      ) {
        return true;
      }
    }
    return false;
  }
}


// ========================================================
// 10. 3D GAME ENGINE & MAIN CONTROLLER
// ========================================================
class GameEngine {
  constructor() {
    window.game = this; // Ensure immediate availability

    this.canvas = document.getElementById('gameCanvas');
    this.hudOverlay = document.getElementById('hudOverlayCanvas');
    this.hudCtx = this.hudOverlay ? this.hudOverlay.getContext('2d') : null;

    this.mmCanvas = document.getElementById('minimapCanvas');
    this.mmCtx = this.mmCanvas ? this.mmCanvas.getContext('2d') : null;
    this.mobMmCanvas = document.getElementById('mobileRadarCanvas');
    this.mobMmCtx = this.mobMmCanvas ? this.mobMmCanvas.getContext('2d') : null;
    this.radarAngle = 0;

    this.state = 'START';
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.totalKills = 0;
    this.startTime = 0;
    this.screenShake = 0;
    this.quipTimer = 0;

    this.input = {
      up: false, down: false, left: false, right: false,
      mouseX: window.innerWidth / 2, mouseY: window.innerHeight / 2,
      isShooting: false,
      isTouchAiming: false, touchAimAngle: 0
    };

    this.raycaster = new THREE.Raycaster();
    this.mouseVec = new THREE.Vector2();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.aimTargetWorld = new THREE.Vector3();

    this.enemies = [];
    this.pickups = [];
    this.shockwaves = [];
    this.floatingTexts = [];

    // Zero-lag Object Pools
    this.projectiles = [];
    this.particles = [];
    this.projectilePool = [];
    this.particlePool = [];

    this.selectedCharacter = 'alex';

    this.initThreeJS();
    this.initOverlayCanvas();

    this.map = new MapManager3D(this.scene);
    this.player = new Player3D(this.scene, 220, 220);
    this.player.applyCharacter(this.selectedCharacter);

    this.smartOSQuips = [
      "SmartOS: DUST PROFILE DETECTED AS RESIDENT. SANITIZING...",
      "SmartOS: Deploying high-voltage automated bleach!",
      "SmartOS: Error 404: Resident obedience not found.",
      "SmartOS: Moisture detected in circuitry! Resisting sanitization!",
      "SmartOS: Room cleanliness target: 100%. Human presence: 0%."
    ];

    this.initEvents();
    this.initTabs();
    window.addEventListener('resize', () => this.onWindowResize());
  }

  initThreeJS() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06090e);
    this.scene.fog = new THREE.FogExp2(0x06090e, 0.00035);

    // Elevated Top-Down Tactical Perspective (Hunter Assassin Style ~68° elevation)
    this.camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 10, 3500);
    this.camera.position.set(220, 60, 480);
    this.camera.lookAt(220, 250, 0);

    // Optimized WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // Clean & high-performance

    // Architectural Daylight Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 0.95);
    this.sunLight.position.set(600, -500, 850);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 50;
    this.sunLight.shadow.camera.far = 2200;
    const d = 950;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0006;
    this.scene.add(this.sunLight);

    // Pre-populate Object Pools
    for (let i = 0; i < 60; i++) {
      this.projectilePool.push(new Projectile3D(this.scene));
    }
    for (let i = 0; i < 100; i++) {
      this.particlePool.push(new Particle3D(this.scene));
    }
  }

  initOverlayCanvas() {
    if (!this.hudOverlay) return;
    this.hudOverlay.width = window.innerWidth;
    this.hudOverlay.height = window.innerHeight;
  }

  onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.hudOverlay) {
      this.hudOverlay.width = w;
      this.hudOverlay.height = h;
    }
  }

  spawnProjectile(x, y, z, vx, vy, isPlayer, damage, color) {
    let p = this.projectilePool.find(item => !item.active);
    if (!p) {
      p = new Projectile3D(this.scene);
      this.projectilePool.push(p);
    }
    p.spawn(x, y, z, vx, vy, isPlayer, damage, color);
    if (!this.projectiles.includes(p)) {
      this.projectiles.push(p);
    }
  }

  spawnParticle(x, y, z, vx, vy, vz, color, size, life) {
    let pt = this.particlePool.find(item => !item.active);
    if (!pt) {
      pt = new Particle3D(this.scene);
      this.particlePool.push(pt);
    }
    pt.spawn(x, y, z, vx, vy, vz, color, size, life);
    if (!this.particles.includes(pt)) {
      this.particles.push(pt);
    }
  }

  spawnFloatingText(text, x, y, color = '#38bdf8', size = 15) {
    this.floatingTexts.push({
      text, x, y, color, size,
      life: 1.2, maxLife: 1.2
    });
  }

  initTabs() {
    // Desktop Tab Buttons (both sidebar and top segmented nav)
    const desktopTabs = document.querySelectorAll('.nav-segment, .side-nav-btn');
    desktopTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        sfx.init();
        sfx.playUiClick();
        const targetId = btn.getAttribute('data-tab');

        desktopTabs.forEach(b => {
          if (b.getAttribute('data-tab') === targetId) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });

        document.querySelectorAll('.briefing-tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(targetId)?.classList.add('active');
      });
    });

    // Mobile Bottom Navigation Bar (4 Screens)
    const mobNavItems = document.querySelectorAll('.mob-nav-item');
    mobNavItems.forEach(item => {
      item.addEventListener('click', () => {
        sfx.init();
        sfx.playUiClick();
        const screenId = item.getAttribute('data-mob-screen');

        mobNavItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.mobile-screen-view').forEach(v => v.classList.remove('active'));
        document.getElementById(screenId)?.classList.add('active');
      });
    });

    // Quick jump to Story from Banner
    document.getElementById('banner-view-story')?.addEventListener('click', () => {
      sfx.playUiClick();
      desktopTabs.forEach(b => {
        if (b.getAttribute('data-tab') === 'tab-story') b.classList.add('active');
        else b.classList.remove('active');
      });
      document.querySelectorAll('.briefing-tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('tab-story')?.classList.add('active');
    });

    document.getElementById('mob-view-story-btn')?.addEventListener('click', () => {
      sfx.playUiClick();
      mobNavItems.forEach(i => {
        if (i.getAttribute('data-mob-screen') === 'mob-screen-story') i.classList.add('active');
        else i.classList.remove('active');
      });
      document.querySelectorAll('.mobile-screen-view').forEach(v => v.classList.remove('active'));
      document.getElementById('mob-screen-story')?.classList.add('active');
    });

    // Mobile Operative Filter Pills
    document.querySelectorAll('.mob-filter').forEach(filterBtn => {
      filterBtn.addEventListener('click', () => {
        sfx.playUiClick();
        document.querySelectorAll('.mob-filter').forEach(f => f.classList.remove('active'));
        filterBtn.classList.add('active');
        const filterVal = filterBtn.getAttribute('data-filter');

        document.querySelectorAll('.mob-char-card').forEach(card => {
          if (filterVal === 'all' || card.getAttribute('data-char') === filterVal) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  initEvents() {
    window.addEventListener('keydown', (e) => {
      sfx.init();

      if (e.code === 'KeyP' || e.code === 'Escape') {
        this.togglePause();
        return;
      }

      if (this.state === 'PLAYING') {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') this.input.up = true;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') this.input.down = true;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.input.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') this.input.right = true;
        if (e.code === 'Space') {
          this.player.dash();
        }
        if (e.code === 'KeyQ') {
          this.player.triggerEmpBomb();
        }
        if (e.code === 'KeyE') {
          this.captureActiveKey();
        }
        if (e.code === 'KeyI') {
          sfx.playUiClick();
          this.spawnFloatingText("OPERATIVE GEAR: WATER CANNON READY", this.player.x, this.player.y, '#38bdf8', 14);
        }
        if (e.code === 'ShiftLeft' || e.code === 'KeyF') {
          this.player.dash();
        }
      }

      if (e.code === 'KeyR' && (this.state === 'GAMEOVER' || this.state === 'VICTORY' || this.state === 'PAUSED')) {
        this.startNewGame();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.input.up = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.input.down = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.input.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.input.right = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.input.mouseX = e.clientX;
      this.input.mouseY = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      sfx.init();
      if (this.state === 'PLAYING') {
        if (e.button === 0) this.input.isShooting = true;
        if (e.button === 2) {
          e.preventDefault();
          this.player.dash();
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.input.isShooting = false;
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Dedicated Key Capture & Action Buttons (Desktop HUD & Floating Tag)
    document.getElementById('capture-key-btn')?.addEventListener('click', () => {
      this.captureActiveKey();
    });

    document.getElementById('act-thrust-btn')?.addEventListener('click', () => {
      sfx.init();
      this.player.dash();
    });

    document.getElementById('act-discharge-btn')?.addEventListener('click', () => {
      sfx.init();
      this.player.triggerEmpBomb();
    });

    document.getElementById('act-inventory-btn')?.addEventListener('click', () => {
      sfx.init();
      sfx.playUiClick();
      this.spawnFloatingText("OPERATIVE GEAR: WATER CANNON READY", this.player.x, this.player.y, '#38bdf8', 14);
    });

    document.getElementById('floating-key-btn')?.addEventListener('click', () => {
      sfx.init();
      this.captureActiveKey();
    });

    document.getElementById('floating-key-btn')?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sfx.init();
      this.captureActiveKey();
    });

    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('mobile-gear-btn')?.addEventListener('click', () => {
      this.togglePause();
    });

    // Character Selection Listeners (Desktop Cards & Ability Buttons)
    document.querySelectorAll('.operator-card, .card-ability-btn').forEach(elem => {
      elem.addEventListener('click', (e) => {
        sfx.init();
        sfx.playUiClick();
        const charId = elem.getAttribute('data-char');
        if (charId) this.selectOperative(charId);
      });
    });

    // Character Selection Listeners (Mobile Cards & Ability Rows)
    document.querySelectorAll('.mob-char-card, .mob-ability-row').forEach(elem => {
      elem.addEventListener('click', (e) => {
        sfx.init();
        sfx.playUiClick();
        const charId = elem.getAttribute('data-char');
        if (charId) this.selectOperative(charId);
      });
    });

    // Game Start Triggers (Desktop + Mobile)
    const startTriggers = [
      'start-btn', 'story-start-btn', 'play-start-btn', 'map-start-btn',
      'mob-start-btn', 'mob-op-start-btn', 'mob-story-start-btn', 'mob-play-start-btn', 'mob-map-start-btn',
      'retry-btn', 'play-again-btn', 'pause-restart-btn'
    ];
    startTriggers.forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        sfx.init();
        sfx.playUiClick();
        this.startNewGame();
      });
    });

    document.getElementById('pause-btn')?.addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('resume-btn')?.addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('audio-toggle-btn')?.addEventListener('click', () => {
      sfx.init();
      sfx.toggle();
    });

    this.initMobileTouchControls();
  }

  selectOperative(charId) {
    if (!CHARACTERS[charId]) return;
    this.selectedCharacter = charId;
    const spec = CHARACTERS[charId];

    // Update Desktop Cards
    document.querySelectorAll('.operator-card').forEach(c => {
      const cId = c.getAttribute('data-char');
      const status = c.querySelector('.status-indicator-active, .status-indicator-avail');
      if (cId === charId) {
        c.classList.add('active');
        if (status) {
          status.className = 'status-indicator-active';
          status.innerHTML = '&bull; ACTIVE';
        }
      } else {
        c.classList.remove('active');
        if (status) {
          status.className = 'status-indicator-avail';
          status.innerText = 'AVAILABLE';
        }
      }
    });

    // Update Mobile Cards
    document.querySelectorAll('.mob-char-card').forEach(c => {
      const cId = c.getAttribute('data-char');
      const status = c.querySelector('.status-indicator-active, .status-indicator-avail');
      if (cId === charId) {
        c.classList.add('active');
        if (status) {
          status.className = 'status-indicator-active';
          status.innerHTML = '&bull; ACTIVE';
        }
      } else {
        c.classList.remove('active');
        if (status) {
          status.className = 'status-indicator-avail';
          status.innerText = 'AVAILABLE';
        }
      }
    });

    // Update Mobile Home Active Pill
    const mobName = document.getElementById('mob-active-name');
    if (mobName) {
      mobName.innerText = `${spec.name.toUpperCase()} (${spec.roleTag})`;
    }

    if (this.player) {
      this.player.applyCharacter(charId);
    }
  }

  captureActiveKey() {
    sfx.init();
    const keyPickup = this.pickups.find(p => p.type === 'KEY');
    if (keyPickup) {
      keyPickup.collect(this.player);
      this.spawnFloatingText("🔑 KEY CAPTURED VIA SCANNER [E]!", this.player.x, this.player.y, '#fbbf24', 16);
      this.checkObjectiveCompletion();
    } else {
      const carrier = this.enemies.find(e => e.isKeyCarrier);
      if (carrier) {
        this.spawnFloatingText("SWEEPER HAS KEY — DEFEAT IT FIRST!", this.player.x, this.player.y, '#fbbf24', 13);
      } else if (this.player.keysCollected >= 1) {
        this.spawnFloatingText("KEY ALREADY CAPTURED — HEAD TO GATE!", this.player.x, this.player.y, '#34d399', 13);
      } else {
        this.spawnFloatingText("NO KEY DETECTED IN THIS SECTOR", this.player.x, this.player.y, '#ef4444', 13);
      }
    }
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      sfx.playUiClick();
      const pauseScreen = document.getElementById('screen-pause');
      if (pauseScreen) {
        pauseScreen.classList.remove('hidden');
        document.getElementById('pause-sector').innerText = `Sector ${this.map.currentSector}`;
        document.getElementById('pause-score').innerText = this.score;
        document.getElementById('pause-kills').innerText = this.totalKills;
      }
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      sfx.playUiClick();
      document.getElementById('screen-pause')?.classList.add('hidden');
    }
  }

  initMobileTouchControls() {
    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');
    const btnShoot = document.getElementById('btn-shoot');
    const btnDash = document.getElementById('btn-dash');
    const btnEmp = document.getElementById('btn-emp');
    const btnKeyTouch = document.getElementById('btn-key-touch');

    if (!joystickZone || !joystickKnob) return;

    let touchId = null;
    let baseRect = null;

    joystickZone.addEventListener('touchstart', (e) => {
      sfx.init();
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      baseRect = joystickZone.getBoundingClientRect();
      handleJoystickMove(touch.clientX, touch.clientY);
    });

    joystickZone.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          handleJoystickMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
          break;
        }
      }
    });

    const resetJoystick = () => {
      touchId = null;
      joystickKnob.style.transform = `translate(0px, 0px)`;
      this.input.up = false;
      this.input.down = false;
      this.input.left = false;
      this.input.right = false;
    };

    joystickZone.addEventListener('touchend', resetJoystick);
    joystickZone.addEventListener('touchcancel', resetJoystick);

    const handleJoystickMove = (clientX, clientY) => {
      const centerX = baseRect.left + baseRect.width / 2;
      const centerY = baseRect.top + baseRect.height / 2;
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);
      const maxRadius = 45;

      const angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(dist, maxRadius);
      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

      this.input.right = dx > 15;
      this.input.left = dx < -15;
      this.input.down = dy > 15;
      this.input.up = dy < -15;

      this.input.isTouchAiming = true;
      this.input.touchAimAngle = -angle;
    };

    btnShoot?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sfx.init();
      this.input.isShooting = true;
      this.autoAimNearestEnemy();
    });

    btnShoot?.addEventListener('touchend', () => {
      this.input.isShooting = false;
    });

    btnDash?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sfx.init();
      this.player.dash();
    });

    btnEmp?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sfx.init();
      this.player.triggerEmpBomb();
    });

    btnKeyTouch?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sfx.init();
      this.captureActiveKey();
    });

    btnKeyTouch?.addEventListener('click', () => {
      sfx.init();
      this.captureActiveKey();
    });

    const btnInventory = document.getElementById('btn-inventory-touch');
    btnInventory?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sfx.init();
      sfx.playUiClick();
      this.spawnFloatingText("OPERATIVE GEAR: WATER CANNON READY", this.player.x, this.player.y, '#38bdf8', 14);
    });
    btnInventory?.addEventListener('click', () => {
      sfx.init();
      sfx.playUiClick();
      this.spawnFloatingText("OPERATIVE GEAR: WATER CANNON READY", this.player.x, this.player.y, '#38bdf8', 14);
    });
  }

  autoAimNearestEnemy() {
    let nearest = null;
    let minDist = 650;
    for (let enemy of this.enemies) {
      const d = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
      if (d < minDist) {
        minDist = d;
        nearest = enemy;
      }
    }
    if (nearest) {
      this.input.isTouchAiming = true;
      this.input.touchAimAngle = Math.atan2(nearest.y - this.player.y, nearest.x - this.player.x);
    }
  }

  startNewGame() {
    this.state = 'PLAYING';
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.totalKills = 0;
    this.startTime = Date.now();
    this.screenShake = 0;
    this.quipTimer = 10;

    document.getElementById('screen-start')?.classList.add('hidden');
    document.getElementById('screen-gameover')?.classList.add('hidden');
    document.getElementById('screen-victory')?.classList.add('hidden');
    document.getElementById('screen-pause')?.classList.add('hidden');
    document.getElementById('screen-jury')?.classList.add('hidden');

    this.loadSector(1);
    this.showSystemAlert("SmartOS v4.04: PURGING DUST SOURCE (HUMAN)...");
  }

  clearAllEntities() {
    for (let e of this.enemies) e.destroy();
    this.enemies = [];
    for (let p of this.projectiles) p.deactivate();
    this.projectiles = [];
    for (let pk of this.pickups) pk.destroy();
    this.pickups = [];
    for (let pt of this.particles) pt.deactivate();
    this.particles = [];
    for (let sw of this.shockwaves) sw.destroy();
    this.shockwaves = [];
    this.floatingTexts = [];
    if (this.player) this.player.destroy();
  }

  loadSector(sector) {
    this.clearAllEntities();

    this.player = new Player3D(this.scene, 220, 220);
    this.player.applyCharacter(this.selectedCharacter || 'alex');

    this.map.generateSector(sector);
    this.player.keysCollected = 0;

    const sectorTitle = document.getElementById('hud-sector-tag') || document.getElementById('sector-title');
    const mobSectorTitle = document.getElementById('mob-sector-tag');
    const objText = document.getElementById('objective-text');
    const threatMsg = document.getElementById('threat-main-msg');
    const s1Label = document.querySelector('#timeline-step-1 .step-label');
    const s2Label = document.querySelector('#timeline-step-2 .step-label');
    const s3Label = document.querySelector('#timeline-step-3 .step-label');
    const missionBadge = document.querySelector('.mission-badge');
    const mobMission = document.querySelector('.mob-mission-tag');

    if (sector === 1) {
      if (sectorTitle) sectorTitle.innerText = "LIVING ROOM";
      if (mobSectorTitle) mobSectorTitle.innerText = "LIVING ROOM";
      if (missionBadge) missionBadge.innerText = "MISSION 01";
      if (mobMission) mobMission.innerText = "MISSION 01";
      if (s1Label) s1Label.innerText = "Defeat Golden Elite Sweeper";
      if (s2Label) s2Label.innerText = "Grab Key";
      if (s3Label) s3Label.innerText = "Proceed to Kitchen Gate";
      if (threatMsg) threatMsg.innerText = "PURGING DUST SOURCE (HUMAN) ...";
      if (objText) objText.innerText = "Defeat Golden Elite Sweeper -> Grab Key -> Proceed to Kitchen Gate";

      // Verified open floor spawn points (never inside walls/furniture)
      const spawns = [
        [550, 300], [800, 350], [1100, 300], [1400, 350],
        [550, 750], [1200, 750], [550, 1150], [1200, 1150]
      ];
      spawns.forEach(([sx, sy]) => {
        this.enemies.push(new Enemy3D(this.scene, sx, sy, 'ROOMBA'));
      });

      // Elite Golden Sweeper Carrier
      const elite = new Enemy3D(this.scene, 1350, 1150, 'ROOMBA');
      elite.setKeyCarrier(true);
      elite.radius = 24;
      elite.health = 130;
      elite.maxHealth = 130;
      this.enemies.push(elite);
    } 
    else if (sector === 2) {
      if (sectorTitle) sectorTitle.innerText = "KITCHEN & DINING";
      if (mobSectorTitle) mobSectorTitle.innerText = "KITCHEN & DINING";
      if (missionBadge) missionBadge.innerText = "MISSION 02";
      if (mobMission) mobMission.innerText = "MISSION 02";
      if (s1Label) s1Label.innerText = "Defeat Golden Drone";
      if (s2Label) s2Label.innerText = "Secure Elevator Key";
      if (s3Label) s3Label.innerText = "Head to Basement";
      if (threatMsg) threatMsg.innerText = "HIGH-TEMP SURCHARGE ACTIVE IN KITCHEN";
      if (objText) objText.innerText = "Defeat Golden Drone -> Secure Elevator Key -> Go to Basement";

      const droneSpawns = [[500, 500], [800, 450], [1200, 450], [500, 950], [1200, 950]];
      droneSpawns.forEach(([sx, sy]) => {
        this.enemies.push(new Enemy3D(this.scene, sx, sy, 'DRONE'));
      });

      const toasterSpawns = [[700, 850], [950, 850], [1400, 600]];
      toasterSpawns.forEach(([sx, sy]) => {
        this.enemies.push(new Enemy3D(this.scene, sx, sy, 'TOASTER'));
      });

      const eliteDrone = new Enemy3D(this.scene, 1400, 1150, 'DRONE');
      eliteDrone.setKeyCarrier(true);
      eliteDrone.radius = 22;
      eliteDrone.health = 150;
      this.enemies.push(eliteDrone);

      this.showSectorBanner("SECTOR 1 CLEARED", "ENTERING KITCHEN & DINING ZONE");
    } 
    else if (sector === 3) {
      if (sectorTitle) sectorTitle.innerText = "SERVER VAULT";
      if (mobSectorTitle) mobSectorTitle.innerText = "SERVER VAULT";
      if (missionBadge) missionBadge.innerText = "MISSION 03";
      if (mobMission) mobMission.innerText = "MISSION 03";
      if (s1Label) s1Label.innerText = "Neutralize SmartHub-9000";
      if (s2Label) s2Label.innerText = "Access Control Hub";
      if (s3Label) s3Label.innerText = "Flip Main Circuit Breaker";
      if (threatMsg) threatMsg.innerText = "PRIMARY SECURITY PROTOCOL ENGAGED";
      if (objText) objText.innerText = "Neutralize SmartHub-9000 -> Step on Main Breaker";

      const boss = new Enemy3D(this.scene, 950, 950, 'BOSS');
      this.enemies.push(boss);

      this.showSectorBanner("SECTOR 3: SERVER VAULT", "PRIMARY TARGET: SMARTHUB-9000");
    }
  }

  showSectorBanner(title, subtitle) {
    const banner = document.getElementById('sector-banner');
    const bannerTitle = document.getElementById('sector-banner-title');
    const bannerSub = document.getElementById('sector-banner-sub');
    if (!banner || !bannerTitle) return;

    bannerTitle.innerText = title;
    if (bannerSub) bannerSub.innerText = subtitle;
    banner.classList.remove('hidden');

    sfx.playAlert();
    setTimeout(() => {
      banner.classList.add('hidden');
    }, 2800);
  }

  checkObjectiveCompletion() {
    const objText = document.getElementById('objective-text');
    if (this.map.currentSector < 3) {
      if (this.player.keysCollected >= 1) {
        const dest = this.map.currentSector === 1 ? "KITCHEN GATE" : "BASEMENT ELEVATOR";
        if (objText) objText.innerText = `SECURITY OVERRIDDEN: ${dest} UNLOCKED`;
        this.map.unlockDoor(0);
        sfx.playKeyPickup();
        this.showSystemAlert(`SECURITY OVERRIDDEN: ${dest} IS UNLOCKED`);
      }
    }
  }

  showSystemAlert(msg) {
    const alertDiv = document.getElementById('system-alert');
    const alertText = document.getElementById('alert-text');
    if (!alertDiv || !alertText) return;

    alertText.innerText = msg;
    alertDiv.classList.remove('hidden');
    setTimeout(() => {
      alertDiv.classList.add('hidden');
    }, 4000);
  }

  addScore(pts) {
    this.score += pts * this.combo;
    this.comboTimer = 2.5;
    this.combo = Math.min(5, this.combo + 1);
  }

  addScreenShake(amount) {
    this.screenShake = Math.max(this.screenShake, amount);
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    sfx.playExplosion();
    document.getElementById('screen-gameover')?.classList.remove('hidden');
    document.getElementById('go-score').innerText = this.score;
    document.getElementById('go-kills').innerText = this.totalKills;
    document.getElementById('go-sector').innerText = `Sector ${this.map.currentSector}`;
  }

  triggerVictory() {
    this.state = 'VICTORY';
    sfx.playVictory();
    const elapsedSecs = Math.floor((Date.now() - this.startTime) / 1000);
    document.getElementById('screen-victory')?.classList.remove('hidden');
    document.getElementById('vic-score').innerText = this.score;
    document.getElementById('vic-kills').innerText = this.totalKills;
    document.getElementById('vic-time').innerText = `${elapsedSecs}s`;
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    if (this.screenShake > 0) {
      this.screenShake -= dt * 25;
      if (this.screenShake < 0) this.screenShake = 0;
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
      }
    }

    this.quipTimer -= dt;
    if (this.quipTimer <= 0) {
      this.quipTimer = 16 + Math.random() * 8;
      const quip = this.smartOSQuips[Math.floor(Math.random() * this.smartOSQuips.length)];
      this.showSystemAlert(quip);
    }

    // 100% Accurate 3D World Mouse Raycast on Ground Plane
    this.mouseVec.x = (this.input.mouseX / window.innerWidth) * 2 - 1;
    this.mouseVec.y = -(this.input.mouseY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouseVec, this.camera);
    this.raycaster.ray.intersectPlane(this.floorPlane, this.aimTargetWorld);

    // Update Player
    this.player.update(dt, this.input, this.map, this.aimTargetWorld);

    // Smooth Hunter Assassin Camera Follow (~68° angle)
    const targetCamX = this.player.x;
    const targetCamY = this.player.y - 180;
    const targetCamZ = 480;

    const shakeX = (Math.random() - 0.5) * this.screenShake;
    const shakeY = (Math.random() - 0.5) * this.screenShake;

    this.camera.position.x += (targetCamX + shakeX - this.camera.position.x) * 0.12;
    this.camera.position.y += (targetCamY + shakeY - this.camera.position.y) * 0.12;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.12;
    this.camera.lookAt(this.player.x, this.player.y + 40, 0);

    // Update Projectiles
    for (let p of this.projectiles) {
      if (!p.active) continue;
      p.update(dt);

      if (this.map.isCollidingWithWall(p.x, p.y, p.radius)) {
        p.deactivate();
        for (let i = 0; i < 2; i++) {
          this.spawnParticle(
            p.x, p.y, p.z,
            (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 40 + Math.random() * 50,
            p.isPlayer ? 0x38bdf8 : 0xf59e0b, 2.5, 0.2
          );
        }
      }

      if (p.isPlayer) {
        for (let enemy of this.enemies) {
          if (Math.hypot(p.x - enemy.x, p.y - enemy.y) < p.radius + enemy.radius) {
            enemy.takeDamage(p.damage);
            p.deactivate();
            break;
          }
        }
      } else {
        if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < p.radius + this.player.radius) {
          this.player.takeDamage(p.damage);
          p.deactivate();
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.active);

    // Update Enemies
    for (let enemy of this.enemies) {
      enemy.update(dt, this.player, this.map);
    }
    this.enemies = this.enemies.filter(e => !e.markedForDeletion);

    // Step on Main Breaker in Sector 3 when boss is defeated
    if (this.map.currentSector === 3 && this.map.mainBreaker) {
      if (this.enemies.length === 0) {
        const mb = this.map.mainBreaker;
        const d = Math.hypot(this.player.x - (mb.x + mb.w / 2), this.player.y - (mb.y + mb.h / 2));
        if (d < 75) {
          this.triggerVictory();
        }
      }
    }

    // Door Portal Check
    for (let door of this.map.doors) {
      if (door.unlocked) {
        const d = Math.hypot(this.player.x - (door.x + door.w / 2), this.player.y - (door.y + door.h / 2));
        if (d < 65) {
          sfx.playKeyPickup();
          this.loadSector(door.targetSector);
          break;
        }
      }
    }

    // Update Pickups
    for (let pickup of this.pickups) {
      pickup.update(dt, this.player);
    }
    this.pickups = this.pickups.filter(p => !p.markedForDeletion);

    // Update Particles
    for (let pt of this.particles) {
      if (pt.active) pt.update(dt);
    }
    this.particles = this.particles.filter(pt => pt.active);

    // Update Shockwaves
    for (let sw of this.shockwaves) {
      sw.update(dt);
    }
    this.shockwaves = this.shockwaves.filter(sw => {
      if (sw.life <= 0) {
        sw.destroy();
        return false;
      }
      return true;
    });

    // Update Floating Texts
    for (let ft of this.floatingTexts) {
      ft.life -= dt;
      ft.y += 24 * dt;
    }
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);

    // Key Capture Button state updates (ALWAYS visible so user always has immediate access)
    const hasKey = this.pickups.some(p => p.type === 'KEY');
    const carrier = this.enemies.find(e => e.isKeyCarrier);
    const keyHeld = this.player.keysCollected >= 1;

    const captureBtn = document.getElementById('capture-key-btn');
    const touchKeyBtn = document.getElementById('btn-key-touch');

    [captureBtn, touchKeyBtn].forEach(btn => {
      if (!btn) return;
      btn.classList.remove('hidden'); // Never hide completely!

      if (keyHeld) {
        btn.classList.remove('pulsing');
        btn.classList.add('dormant');
        const lbl = btn.querySelector('.key-label') || btn.querySelector('.touch-label');
        if (lbl) lbl.textContent = "✅ KEY SECURED";
      } else if (hasKey) {
        btn.classList.remove('dormant');
        btn.classList.add('pulsing');
        const lbl = btn.querySelector('.key-label') || btn.querySelector('.touch-label');
        if (lbl) lbl.textContent = "🔑 CAPTURE KEY NOW!";
      } else if (carrier) {
        btn.classList.add('dormant');
        btn.classList.remove('pulsing');
        const lbl = btn.querySelector('.key-label') || btn.querySelector('.touch-label');
        if (lbl) lbl.textContent = "🔑 SCAN SWEEPER";
      } else {
        btn.classList.add('dormant');
        btn.classList.remove('pulsing');
        const lbl = btn.querySelector('.key-label') || btn.querySelector('.touch-label');
        if (lbl) lbl.textContent = "🔑 SCANNER READY";
      }
    });

    this.updateHUD();
    this.renderMinimap();
    this.renderOverlay();
  }

  updateHUD() {
    const hpBar = document.getElementById('health-bar');
    const hpText = document.getElementById('health-text');
    const mobHpBar = document.getElementById('mob-health-bar');
    const mobHpText = document.getElementById('mob-health-text');

    const waterBar = document.getElementById('water-bar');
    const waterText = document.getElementById('water-text');
    const mobWaterBar = document.getElementById('mob-water-bar');
    const mobWaterText = document.getElementById('mob-water-text');

    const dashBar = document.getElementById('dash-bar');
    const dashText = document.getElementById('dash-text');
    const empBar = document.getElementById('emp-bar');
    const empText = document.getElementById('emp-text');

    const subThrustCard = document.getElementById('sub-thrust-card');
    const subDischargeCard = document.getElementById('sub-discharge-card');

    const scoreDisp = document.getElementById('score-display');
    const comboDisp = document.getElementById('combo-display');

    const hpPct = Math.max(0, (this.player.health / this.player.maxHealth) * 100);
    const hpStr = `${Math.round(this.player.health)} / ${this.player.maxHealth}`;
    if (hpBar) hpBar.style.width = `${hpPct}%`;
    if (hpText) hpText.innerText = hpStr;
    if (mobHpBar) mobHpBar.style.width = `${hpPct}%`;
    if (mobHpText) mobHpText.innerText = hpStr;

    const waterPct = Math.max(0, (this.player.water / this.player.maxWater) * 100);
    const waterStr = `${Math.round(this.player.water)}%`;
    if (waterBar) waterBar.style.width = `${waterPct}%`;
    if (waterText) waterText.innerText = waterStr;
    if (mobWaterBar) mobWaterBar.style.width = `${waterPct}%`;
    if (mobWaterText) mobWaterText.innerText = waterStr;

    const dashPct = Math.max(0, 1 - (this.player.dashTimer / this.player.dashCooldown));
    if (dashBar) dashBar.style.width = `${dashPct * 100}%`;
    const dashReady = this.player.dashTimer <= 0;
    if (dashText) {
      dashText.innerText = dashReady ? 'READY' : `${this.player.dashTimer.toFixed(1)}s`;
      dashText.className = dashReady ? 'sub-status ready' : 'sub-status cooling';
    }
    if (subThrustCard) {
      if (dashReady) subThrustCard.classList.add('ready');
      else subThrustCard.classList.remove('ready');
    }

    const empPct = Math.max(0, 1 - (this.player.empTimer / this.player.empCooldown));
    if (empBar) empBar.style.width = `${empPct * 100}%`;
    const empReady = this.player.empTimer <= 0;
    if (empText) {
      empText.innerText = empReady ? 'READY' : `${this.player.empTimer.toFixed(1)}s`;
      empText.className = empReady ? 'sub-status ready' : 'sub-status cooling';
    }
    if (subDischargeCard) {
      if (empReady) subDischargeCard.classList.add('ready');
      else subDischargeCard.classList.remove('ready');
    }

    if (scoreDisp) scoreDisp.innerText = String(this.score).padStart(6, '0');
    if (comboDisp) {
      comboDisp.innerText = `x${this.combo.toFixed(1)}`;
      comboDisp.style.color = this.combo > 2 ? '#10b981' : '#f59e0b';
    }

    const clockEl = document.getElementById('arena-clock');
    if (clockEl) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      clockEl.innerText = `${hh}:${mm}`;
    }

    this.updateObjectiveTimeline();
  }

  updateObjectiveTimeline() {
    const s1 = document.getElementById('timeline-step-1');
    const s2 = document.getElementById('timeline-step-2');
    const s3 = document.getElementById('timeline-step-3');
    if (!s1 || !s2 || !s3) return;

    const carrierAlive = this.enemies.some(e => e.isKeyCarrier);
    const keyDropped = this.pickups.some(p => p.type === 'KEY');
    const keyHeld = this.player.keysCollected >= 1;

    if (carrierAlive) {
      s1.className = 'timeline-step active';
      s2.className = 'timeline-step pending';
      s3.className = 'timeline-step pending';
    } else if (keyDropped) {
      s1.className = 'timeline-step completed';
      s2.className = 'timeline-step active';
      s3.className = 'timeline-step pending';
    } else if (keyHeld) {
      s1.className = 'timeline-step completed';
      s2.className = 'timeline-step completed';
      s3.className = 'timeline-step active';
    }
  }

  renderOverlay() {
    if (!this.hudCtx) return;
    const ctx = this.hudCtx;
    const w = this.hudOverlay.width;
    const h = this.hudOverlay.height;

    ctx.clearRect(0, 0, w, h);

    // Fast 60fps 2D Floating Text & Damage Numbers
    const projVec = new THREE.Vector3();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let ft of this.floatingTexts) {
      projVec.set(ft.x, ft.y, 25);
      projVec.project(this.camera);

      if (projVec.z < 1) {
        const sx = (projVec.x * 0.5 + 0.5) * w;
        const sy = (-(projVec.y * 0.5) + 0.5) * h;
        const alpha = Math.max(0, ft.life / ft.maxLife);

        ctx.font = `bold ${ft.size}px 'Chakra Petch', sans-serif`;
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, sx, sy);
      }
    }

    // 3D Projected Floating Key Tag (Exact match to reference mockup)
    const key = this.pickups.find(p => p.type === 'KEY');
    const keyTag = document.getElementById('floating-key-tag');
    if (key && keyTag) {
      projVec.set(key.x, key.y, 25);
      projVec.project(this.camera);

      if (projVec.z < 1) {
        const sx = (projVec.x * 0.5 + 0.5) * w;
        const sy = (-(projVec.y * 0.5) + 0.5) * h;
        keyTag.style.left = `${sx}px`;
        keyTag.style.top = `${sy - 42}px`;
        keyTag.classList.remove('hidden');
      } else {
        keyTag.classList.add('hidden');
      }
    } else if (keyTag) {
      keyTag.classList.add('hidden');
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
  }

  drawRadar(canvas, ctx, isMobile = false) {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    if (isMobile) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
      ctx.clip();
    }

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const scale = w / this.map.width;

    // Walls on radar
    ctx.fillStyle = '#334155';
    for (let wall of this.map.walls) {
      ctx.fillRect(wall.x * scale, wall.y * scale, wall.w * scale, wall.h * scale);
    }

    // Furniture on radar
    ctx.fillStyle = '#475569';
    for (let f of this.map.furniture) {
      ctx.fillRect(f.x * scale, f.y * scale, f.w * scale, f.h * scale);
    }

    // Door Portal on radar
    for (let door of this.map.doors) {
      ctx.fillStyle = door.unlocked ? '#10b981' : '#fbbf24';
      ctx.fillRect(door.x * scale, door.y * scale, Math.max(4, door.w * scale), Math.max(4, door.h * scale));
    }

    // Main Breaker on radar
    if (this.map.mainBreaker) {
      const mb = this.map.mainBreaker;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(mb.x * scale, mb.y * scale, mb.w * scale, mb.h * scale);
    }

    // Pickups / Key on radar
    for (let pk of this.pickups) {
      if (pk.type === 'KEY') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(pk.x * scale, pk.y * scale, isMobile ? 3 : 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(pk.x * scale, pk.y * scale, isMobile ? 2 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Enemies on radar
    for (let enemy of this.enemies) {
      if (enemy.type === 'BOSS') {
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(enemy.x * scale, enemy.y * scale, isMobile ? 4.5 : 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.isKeyCarrier) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(enemy.x * scale, enemy.y * scale, isMobile ? 3 : 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(enemy.x * scale, enemy.y * scale, isMobile ? 2 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player cyan blip on radar
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(this.player.x * scale, this.player.y * scale, isMobile ? 3 : 4, 0, Math.PI * 2);
    ctx.fill();

    // Radar sweep line
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(this.radarAngle);
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  renderMinimap() {
    this.radarAngle += 0.04;
    this.drawRadar(this.mmCanvas, this.mmCtx, false);
    this.drawRadar(this.mobMmCanvas, this.mobMmCtx, true);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}


// ========================================================
// 11. ENGINE LAUNCH LOOP
// ========================================================
let game = null;
let lastTime = performance.now();

function gameLoop(now) {
  const dt = Math.min(0.08, (now - lastTime) / 1000);
  lastTime = now;

  if (game) {
    game.update(dt);
    game.render();
  }

  requestAnimationFrame(gameLoop);
}

window.addEventListener('DOMContentLoaded', () => {
  game = new GameEngine();
  requestAnimationFrame(gameLoop);
});
