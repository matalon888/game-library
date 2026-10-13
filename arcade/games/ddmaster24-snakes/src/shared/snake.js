// Browser-free snake simulation. No canvas/DOM. Runs in Node and the browser.
(function (root) {
  const V = (typeof module !== 'undefined' && module.exports)
    ? require('./vector2.js') : root;
  const C = (typeof module !== 'undefined' && module.exports)
    ? require('./constants.js') : root;
  const R = (typeof module !== 'undefined' && module.exports)
    ? require('./random.js') : root;
  const Vector2 = V.Vector2;
  const CONSTANTS = C.CONSTANTS;
  const randomColor = R.randomColor;

  class Snake {
    constructor({ id, x, y, name = 'Snake', color = null, isBot = false }) {
      this.id = id;
      this.name = name;
      this.color = color || randomColor();
      this.isBot = isBot;
      this.isDead = false;
      this.mass = CONSTANTS.START_MASS;

      this.body = [];
      const spacing = 8;
      for (let i = 0; i < 10; i++) this.body.push(new Vector2(x - i * spacing, y));

      this.targetAngle = 0;
      this.currentAngle = 0;
      this.isBoosting = false;
      this.speed = CONSTANTS.BASE_SPEED;

      // Bot pacing (used by ai.js)
      this.aiChangeTargetTimer = 0;
      this.aiChangeTargetInterval = 2;
      this.targetPosition = null;
      this.respawnAt = 0;
    }

    get head() { return this.body[0]; }
    get length() { return this.body.length; }
    get radius() { return 5 + Math.sqrt(this.mass) * 0.5; }

    setAim(x, y) {
      const dx = x - this.head.x;
      const dy = y - this.head.y;
      if (dx === 0 && dy === 0) return;
      this.targetAngle = Math.atan2(dy, dx);
    }

    setBoost(boosting) {
      this.isBoosting = boosting;
      this.speed = boosting
        ? CONSTANTS.BASE_SPEED * CONSTANTS.BOOST_MULTIPLIER
        : CONSTANTS.BASE_SPEED;
    }

    step(dt) {
      if (this.isDead) return;

      let angleDiff = this.targetAngle - this.currentAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.currentAngle += angleDiff * CONSTANTS.TURN_SPEED * dt;

      const vx = Math.cos(this.currentAngle) * this.speed * dt;
      const vy = Math.sin(this.currentAngle) * this.speed * dt;
      const newHead = new Vector2(this.head.x + vx, this.head.y + vy);

      const pad = CONSTANTS.WALL_PADDING;
      newHead.x = Math.max(pad, Math.min(CONSTANTS.WORLD_SIZE - pad, newHead.x));
      newHead.y = Math.max(pad, Math.min(CONSTANTS.WORLD_SIZE - pad, newHead.y));

      this.body.unshift(newHead);

      const targetLength = Math.floor(10 + this.mass);
      while (this.body.length > targetLength) this.body.pop();

      const spacing = CONSTANTS.SEGMENT_SPACING;
      for (let i = 1; i < this.body.length; i++) {
        const seg = this.body[i];
        const prev = this.body[i - 1];
        const d = seg.distance(prev);
        if (d > spacing) {
          const dir = seg.subtract(prev).normalize();
          this.body[i] = prev.add(dir.multiply(spacing));
        }
      }
    }

    eatParticleValue(v) { this.mass += v; }
    eatSnakeMass(otherMass) { this.mass += otherMass * 0.9; }

    toState() {
      return {
        id: this.id,
        name: this.name,
        color: this.color,
        mass: this.mass,
        radius: this.radius,
        angle: this.currentAngle,
        boosting: this.isBoosting,
        dead: this.isDead,
        segments: this.body.map((s) => ({ x: s.x, y: s.y })),
      };
    }
  }

  const api = { Snake };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
