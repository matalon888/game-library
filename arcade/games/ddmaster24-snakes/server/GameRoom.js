const { Snake } = require('../src/shared/snake.js');
const { Particle } = require('../src/shared/particle.js');
const { eatParticles, resolveSnakeCollisions, hitsWorldEdge, hitsSelf } = require('../src/shared/collisions.js');
const { computeAiAim } = require('../src/shared/ai.js');
const { CONSTANTS } = require('../src/shared/constants.js');
const { randomRange, randomName } = require('../src/shared/random.js');

const BOT_MASS = [300, 200, 150, 150];
function botMass(i) { return BOT_MASS[i] !== undefined ? BOT_MASS[i] : 100; }

class GameRoom {
  constructor(code, { numBots = 6 } = {}) {
    this.code = code;
    this.numBots = numBots;
    this.tick = 0;
    this.clock = 0; // seconds accumulated, for respawn timing
    this.snakes = new Map(); // id -> Snake
    this.inputs = new Map();  // id -> { aimX, aimY, boost }
    this.particles = [];
    this._botSeq = 0;
    this._recentEvents = [];
    this.emptyTicks = 0;

    for (let i = 0; i < CONSTANTS.START_PARTICLES; i++) this._spawnParticle();
    for (let i = 0; i < numBots; i++) this._spawnBot(i);
  }

  _findSafeSpawn() {
    const pad = 300;
    const heads = [...this.snakes.values()].filter((s) => !s.isDead).map((s) => s.head);
    let best = null, bestDist = -1;
    for (let i = 0; i < 30; i++) {
      const x = randomRange(pad, CONSTANTS.WORLD_SIZE - pad);
      const y = randomRange(pad, CONSTANTS.WORLD_SIZE - pad);
      let nearest = Infinity;
      for (const h of heads) {
        const dx = h.x - x, dy = h.y - y;
        nearest = Math.min(nearest, Math.sqrt(dx * dx + dy * dy));
      }
      if (nearest > bestDist) { bestDist = nearest; best = { x, y }; }
      if (nearest >= 400) break; // good enough
    }
    return best || { x: CONSTANTS.WORLD_SIZE / 2, y: CONSTANTS.WORLD_SIZE / 2 };
  }

  _spawnParticle() {
    const x = randomRange(50, CONSTANTS.WORLD_SIZE - 50);
    const y = randomRange(50, CONSTANTS.WORLD_SIZE - 50);
    this.particles.push(new Particle(x, y));
  }

  _spawnBot(slot) {
    const id = `bot-${this._botSeq++}`;
    const { x, y } = this._findSafeSpawn();
    const s = new Snake({ id, x, y, name: randomName(), isBot: true });
    s.mass = botMass(slot);
    s._slot = slot;
    this.snakes.set(id, s);
    return s;
  }

  addPlayer(id, name, color) {
    const { x, y } = this._findSafeSpawn();
    const s = new Snake({ id, x, y, name: name || 'Player', color, isBot: false });
    this.snakes.set(id, s);
    return s;
  }

  removePlayer(id) {
    this.snakes.delete(id);
    this.inputs.delete(id);
  }

  setInput(id, aimX, aimY, boost) {
    this.inputs.set(id, { aimX, aimY, boost: !!boost });
  }

  humanCount() {
    let n = 0;
    for (const s of this.snakes.values()) if (!s.isBot) n++;
    return n;
  }

  liveHumanCount() {
    let n = 0;
    for (const s of this.snakes.values()) if (!s.isBot && !s.isDead) n++;
    return n;
  }

  step(dt) {
    this.tick++;
    this.clock += dt;
    const all = [...this.snakes.values()];

    // Apply inputs / AI, then integrate.
    for (const s of all) {
      if (s.isDead) continue;
      if (s.isBot) {
        const aim = computeAiAim(s, this.particles, all, dt);
        s.setAim(aim.x, aim.y);
        // Never boost toward/near a wall — the boost decision is only recomputed
        // on retarget, so without this a fleeing bot can boost straight into the edge.
        const W = CONSTANTS.WORLD_SIZE;
        const nearWall = s.head.x < 300 || s.head.x > W - 300 || s.head.y < 300 || s.head.y > W - 300;
        s.setBoost(!!aim.boost && !nearWall && s.mass > CONSTANTS.BOOST_MIN_MASS);
      } else {
        const inp = this.inputs.get(s.id);
        if (inp) { s.setAim(inp.aimX, inp.aimY); s.setBoost(inp.boost); }
      }
      // Boost economy: draining mass, or deny boost when too small.
      if (s.isBoosting) {
        if (s.mass > CONSTANTS.BOOST_MIN_MASS) {
          s.mass -= CONSTANTS.BOOST_DRAIN * dt;
          if ((this.tick % 3) === 0) {
            const tail = s.body[s.body.length - 1];
            this.particles.push(new Particle(tail.x, tail.y));
          }
        } else {
          s.setBoost(false);
        }
      }
      s.step(dt);
    }

    // Deaths from environment.
    const kills = [];
    for (const s of all) {
      if (s.isDead) continue;
      if (hitsWorldEdge(s) || hitsSelf(s)) {
        s.isDead = true;
        kills.push({ deadId: s.id, byName: 'wall' });
      }
    }

    // Snake-vs-snake.
    kills.push(...resolveSnakeCollisions(all));

    // Record kill events for the snapshot feed.
    for (const k of kills) {
      const dead = this.snakes.get(k.deadId);
      this._recentEvents.push({ type: 'kill', name: dead ? dead.name : 'A snake', by: k.byName });
    }

    // Scatter food from the dead, then handle bot respawn / player removal-on-death.
    for (const s of all) {
      if (!s.isDead) continue;
      if (!s._scattered) {
        s._scattered = true;
        this._scatter(s);
        if (s.isBot) s.respawnAt = this.clock + 3;
      }
    }
    for (const s of [...this.snakes.values()]) {
      if (s.isDead && s.isBot && this.clock >= s.respawnAt) {
        const slot = s._slot;
        this.snakes.delete(s.id);
        this._spawnBot(slot);
      }
    }

    // Particle eating + maintenance.
    eatParticles([...this.snakes.values()], this.particles);
    if (this.particles.length < CONSTANTS.MAX_PARTICLES) {
      for (let i = 0; i < 10; i++) this._spawnParticle();
    }
    // Hard cap total particles so death-scatter and boost trails can't grow the
    // world (and each snapshot) without bound. Trims oldest excess.
    if (this.particles.length > CONSTANTS.MAX_PARTICLES) {
      this.particles.splice(0, this.particles.length - CONSTANTS.MAX_PARTICLES);
    }

    this.emptyTicks = this.liveHumanCount() === 0 ? this.emptyTicks + 1 : 0;
    return { kills };
  }

  _scatter(snake) {
    const count = Math.min(Math.floor(snake.mass * 0.8), 200);
    const body = snake.body;
    for (let i = 0; i < count; i++) {
      const seg = body[Math.floor(Math.random() * body.length)];
      const p = new Particle(seg.x + randomRange(-30, 30), seg.y + randomRange(-30, 30));
      this.particles.push(p);
    }
  }

  snapshot() {
    const snakes = [];
    const living = [];
    for (const s of this.snakes.values()) {
      if (!s.isDead) { snakes.push(s.toState()); living.push(s); }
    }
    living.sort((a, b) => b.mass - a.mass);
    const leaderboard = living.slice(0, 10).map((s) => ({ name: s.name, mass: Math.floor(s.mass) }));
    const snap = { tick: this.tick, snakes, particles: this.particles.map((p) => p.toState()), leaderboard, events: this._recentEvents };
    this._recentEvents = [];
    return snap;
  }
}

module.exports = { GameRoom };
