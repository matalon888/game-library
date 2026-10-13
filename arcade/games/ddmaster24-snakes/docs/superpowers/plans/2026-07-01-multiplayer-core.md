# Snakes IO — Multiplayer Core (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-player, browser-only Snakes game into a server-authoritative real-time multiplayer game with room codes, playable on the same WiFi.

**Architecture:** Extract the game simulation out of the browser into shared, browser-free modules (`src/shared/`). A Node server runs one authoritative `GameRoom` per lobby at a fixed 30 Hz tick, owns all snakes/bots/particles/collisions, and broadcasts JSON snapshots over WebSockets. Browsers become thin clients: capture input, send intent, render the latest snapshot with interpolation.

**Tech Stack:** Node.js, Express (static hosting), `ws` (WebSockets), vanilla JS (no build step), `node:test` for unit tests.

## Global Constraints

- No build step / no framework. Vanilla JS only, matching the existing project.
- Shared modules in `src/shared/` MUST run in BOTH Node and the browser. Use the UMD guard pattern shown in Task 1 for every shared module.
- Tests use Node's built-in `node:test` + `node:assert/strict`. No new test framework.
- LAN only — no auth, no cloud, no persistence.
- Fixed simulation tick: 30 Hz (`DT = 1/30`). Snapshot broadcast: every tick.
- World size: 4000. Keep existing gameplay constants unless a task changes them.
- Preserve existing visual style (glow snakes, grid, particles, eyes, name tags).
- Frequent commits: every task ends with a commit.

---

## File Structure

**Created:**
- `src/shared/umd.md` — (reference only, not code) the UMD pattern. *(Skip; pattern is inlined per file.)*
- `src/shared/constants.js` — world/gameplay/network constants.
- `src/shared/vector2.js` — `Vector2` math (moved from `utils.js`).
- `src/shared/random.js` — `randomRange`, `randomInt`, `randomColor`, `randomName`, `makeRoomCode`.
- `src/shared/snake.js` — browser-free snake simulation + `toState()`.
- `src/shared/particle.js` — browser-free particle simulation + `toState()`.
- `src/shared/collisions.js` — authoritative collision functions.
- `src/shared/ai.js` — `computeAiAim()` bot decision logic.
- `server/GameRoom.js` — one authoritative game instance.
- `server/LobbyManager.js` — room create/join/cleanup by code.
- `src/client/net.js` — WebSocket client + snapshot buffer.
- `src/client/renderer.js` — draws snapshots with interpolation.
- `src/client/input.js` — input capture → aim + boost.
- `src/client/main.js` — lobby UI wiring + screen management (replaces old `src/main.js`).
- Test files under `test/` mirroring the modules.

**Modified:**
- `server.js` — becomes Express + `ws` + tick loop (or delegates to `server/index.js`).
- `index.html` — add lobby UI (create/join), load new client scripts.
- `package.json` — add `ws` dep, `test` script, keep `web` script.
- `README.md` / `QUICK_START.md` — document multiplayer/LAN play (final task).

**Removed from browser responsibility (logic ported, files retired):**
- `src/game.js`, `src/snake.js`, `src/particle.js`, `src/utils.js`, `src/main.js` — logic moves to `src/shared/` + `src/client/`. `src/camera.js` is ported into the renderer. These old files are deleted in Task 13 once the new path works.

---

## Task 1: Project setup — dependencies, test infra, shared Vector2

**Files:**
- Modify: `package.json`
- Create: `src/shared/vector2.js`
- Create: `test/vector2.test.js`

**Interfaces:**
- Produces: `Vector2` class with `add(v)`, `subtract(v)`, `multiply(s)`, `distance(v)`, `length()`, `normalize()`, `angle()`. In Node: `require('../src/shared/vector2.js')` → `{ Vector2 }`. In browser: `window.Vector2`.

- [ ] **Step 1: Add `ws` dependency and test script**

Edit `package.json` — add to `dependencies` and `scripts`:

```json
{
  "scripts": {
    "start": "electron .",
    "web": "node server.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.18.0"
  }
}
```

Then run:

```bash
npm install
```

Expected: `ws` appears in `node_modules`.

- [ ] **Step 2: Write the failing test**

Create `test/vector2.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { Vector2 } = require('../src/shared/vector2.js');

test('add returns component sum', () => {
  const r = new Vector2(1, 2).add(new Vector2(3, 4));
  assert.deepEqual({ x: r.x, y: r.y }, { x: 4, y: 6 });
});

test('distance is euclidean', () => {
  assert.equal(new Vector2(0, 0).distance(new Vector2(3, 4)), 5);
});

test('normalize of zero vector is zero', () => {
  const r = new Vector2(0, 0).normalize();
  assert.deepEqual({ x: r.x, y: r.y }, { x: 0, y: 0 });
});

test('normalize yields unit length', () => {
  const r = new Vector2(0, 5).normalize();
  assert.deepEqual({ x: r.x, y: r.y }, { x: 0, y: 1 });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/vector2.test.js`
Expected: FAIL — cannot find module `../src/shared/vector2.js`.

- [ ] **Step 4: Create `src/shared/vector2.js` with the UMD guard**

```js
// Shared 2D vector math. Runs in Node and the browser.
(function (root) {
  class Vector2 {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    subtract(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    multiply(s) { return new Vector2(this.x * s, this.y * s); }
    distance(v) {
      const dx = this.x - v.x, dy = this.y - v.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
      const len = this.length();
      if (len === 0) return new Vector2(0, 0);
      return new Vector2(this.x / len, this.y / len);
    }
    angle() { return Math.atan2(this.y, this.x); }
  }
  const api = { Vector2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/vector2.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/shared/vector2.js test/vector2.test.js
git commit -m "feat: add ws dep, test script, shared Vector2 module"
```

---

## Task 2: Shared constants and random helpers

**Files:**
- Create: `src/shared/constants.js`
- Create: `src/shared/random.js`
- Create: `test/random.test.js`

**Interfaces:**
- Produces `constants.js` → `{ CONSTANTS }` with: `WORLD_SIZE=4000`, `TICK_RATE=30`, `DT=1/30`, `BASE_SPEED=120`, `BOOST_MULTIPLIER=1.8`, `TURN_SPEED=3`, `SEGMENT_SPACING=7`, `START_MASS=100`, `MAX_PARTICLES=1000`, `START_PARTICLES=800`, `BOOST_DRAIN=0`, `WALL_PADDING=40`.
- Produces `random.js` → `{ randomRange, randomInt, randomColor, randomName, makeRoomCode }`. `makeRoomCode()` returns a 5-char uppercase A–Z code.

- [ ] **Step 1: Write the failing test**

Create `test/random.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRoomCode, randomInt, randomColor, randomName } = require('../src/shared/random.js');

test('makeRoomCode is 5 uppercase letters', () => {
  for (let i = 0; i < 50; i++) {
    assert.match(makeRoomCode(), /^[A-Z]{5}$/);
  }
});

test('randomInt stays within inclusive bounds', () => {
  for (let i = 0; i < 100; i++) {
    const n = randomInt(2, 5);
    assert.ok(n >= 2 && n <= 5, `got ${n}`);
  }
});

test('randomColor returns a hex string', () => {
  assert.match(randomColor(), /^#[0-9a-f]{6}$/i);
});

test('randomName has two words', () => {
  assert.equal(randomName().split(' ').length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/random.test.js`
Expected: FAIL — cannot find module `../src/shared/random.js`.

- [ ] **Step 3: Create `src/shared/constants.js`**

```js
// Shared gameplay + network constants.
(function (root) {
  const CONSTANTS = {
    WORLD_SIZE: 4000,
    TICK_RATE: 30,
    DT: 1 / 30,
    BASE_SPEED: 120,
    BOOST_MULTIPLIER: 1.8,
    TURN_SPEED: 3,
    SEGMENT_SPACING: 7,
    START_MASS: 100,
    MAX_PARTICLES: 1000,
    START_PARTICLES: 800,
    WALL_PADDING: 40,
  };
  const api = { CONSTANTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 4: Create `src/shared/random.js`**

```js
// Shared random helpers. Runs in Node and the browser.
(function (root) {
  function randomRange(min, max) { return Math.random() * (max - min) + min; }
  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  const COLORS = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24',
    '#6c5ce7', '#fd79a8', '#fdcb6e', '#00b894',
    '#ff7675', '#74b9ff', '#a29bfe', '#ffeaa7',
  ];
  function randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

  const ADJ = ['Speedy', 'Mighty', 'Sneaky', 'Giant', 'Tiny', 'Angry', 'Happy', 'Crazy'];
  const NOUN = ['Snake', 'Serpent', 'Viper', 'Python', 'Cobra', 'Rattler', 'Noodle', 'Worm'];
  function randomName() {
    return `${ADJ[randomInt(0, ADJ.length - 1)]} ${NOUN[randomInt(0, NOUN.length - 1)]}`;
  }

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function makeRoomCode() {
    let s = '';
    for (let i = 0; i < 5; i++) s += LETTERS[randomInt(0, 25)];
    return s;
  }

  const api = { randomRange, randomInt, randomColor, randomName, makeRoomCode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/random.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/shared/constants.js src/shared/random.js test/random.test.js
git commit -m "feat: add shared constants and random helpers"
```

---

## Task 3: Shared Snake simulation (browser-free)

**Files:**
- Create: `src/shared/snake.js`
- Create: `test/snake.test.js`

**Interfaces:**
- Consumes: `Vector2` (Task 1), `CONSTANTS` (Task 2), `randomColor` (Task 2).
- Produces: `Snake` class:
  - `new Snake({ id, x, y, name, color, isBot })`
  - props: `id, name, color, isBot, isDead, mass, body (Vector2[]), currentAngle, targetAngle, isBoosting`
  - getters: `head`, `length`, `radius`
  - `setAim(x, y)` — set `targetAngle` toward world point.
  - `setBoost(bool)` — set `isBoosting` and effective speed.
  - `step(dt)` — advance one tick (turn, move head, trim to mass, respace).
  - `eatParticleValue(v)` / `eatSnakeMass(otherMass)` — grow.
  - `toState()` — `{ id, name, color, mass, radius, angle: currentAngle, boosting, dead, segments: [{x,y}...] }`.

Radius formula unchanged: `5 + Math.sqrt(mass) * 0.5`. Target length: `Math.floor(10 + mass)`.

- [ ] **Step 1: Write the failing test**

Create `test/snake.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { Snake } = require('../src/shared/snake.js');

function make() {
  return new Snake({ id: 'p1', x: 2000, y: 2000, name: 'You', color: '#00ff88', isBot: false });
}

test('new snake starts with 10 segments and default mass', () => {
  const s = make();
  assert.equal(s.body.length, 10);
  assert.equal(s.mass, 100);
  assert.equal(s.isDead, false);
});

test('radius grows with mass', () => {
  const s = make();
  const r0 = s.radius;
  s.eatParticleValue(50);
  assert.ok(s.radius > r0);
});

test('step moves the head toward the aim', () => {
  const s = make();
  s.currentAngle = 0; // ensure no turn lag masks movement
  s.setAim(3000, 2000); // aim to the right (+x)
  const x0 = s.head.x;
  for (let i = 0; i < 5; i++) s.step(1 / 30);
  assert.ok(s.head.x > x0, `head.x ${s.head.x} should exceed ${x0}`);
});

test('eating grows target length', () => {
  const s = make();
  s.eatParticleValue(20);
  for (let i = 0; i < 40; i++) s.step(1 / 30);
  assert.ok(s.body.length > 10);
});

test('boost increases distance travelled per tick', () => {
  const a = make(); a.currentAngle = 0; a.setAim(4000, 2000);
  const b = make(); b.currentAngle = 0; b.setAim(4000, 2000); b.setBoost(true);
  a.step(1 / 30); b.step(1 / 30);
  const da = a.head.x - 2000, db = b.head.x - 2000;
  assert.ok(db > da, `boosted ${db} should exceed normal ${da}`);
});

test('toState returns serialisable snapshot', () => {
  const s = make();
  const st = s.toState();
  assert.equal(st.id, 'p1');
  assert.equal(typeof st.radius, 'number');
  assert.ok(Array.isArray(st.segments));
  assert.equal(typeof st.segments[0].x, 'number');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/snake.test.js`
Expected: FAIL — cannot find module `../src/shared/snake.js`.

- [ ] **Step 3: Create `src/shared/snake.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/snake.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/snake.js test/snake.test.js
git commit -m "feat: add browser-free shared Snake simulation"
```

---

## Task 4: Shared Particle simulation

**Files:**
- Create: `src/shared/particle.js`
- Create: `test/particle.test.js`

**Interfaces:**
- Consumes: `Vector2`, `randomColor`.
- Produces: `Particle` class: `new Particle(x, y)`, props `position (Vector2)`, `radius=5`, `color`, `value=1`; `toState()` → `{ x, y, r, color }`.
  Glow animation is a client-only concern and lives in the renderer, NOT here.

- [ ] **Step 1: Write the failing test**

Create `test/particle.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { Particle } = require('../src/shared/particle.js');

test('particle stores position and default value', () => {
  const p = new Particle(100, 200);
  assert.equal(p.position.x, 100);
  assert.equal(p.position.y, 200);
  assert.equal(p.value, 1);
});

test('toState is serialisable', () => {
  const st = new Particle(1, 2).toState();
  assert.deepEqual(
    { x: st.x, y: st.y, r: st.r, hasColor: typeof st.color === 'string' },
    { x: 1, y: 2, r: 5, hasColor: true }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/particle.test.js`
Expected: FAIL — cannot find module `../src/shared/particle.js`.

- [ ] **Step 3: Create `src/shared/particle.js`**

```js
// Browser-free food particle. No canvas/DOM.
(function (root) {
  const V = (typeof module !== 'undefined' && module.exports)
    ? require('./vector2.js') : root;
  const R = (typeof module !== 'undefined' && module.exports)
    ? require('./random.js') : root;
  const Vector2 = V.Vector2;
  const randomColor = R.randomColor;

  class Particle {
    constructor(x, y) {
      this.position = new Vector2(x, y);
      this.radius = 5;
      this.color = randomColor();
      this.value = 1;
    }
    toState() {
      return { x: this.position.x, y: this.position.y, r: this.radius, color: this.color };
    }
  }

  const api = { Particle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/particle.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/particle.js test/particle.test.js
git commit -m "feat: add browser-free shared Particle"
```

---

## Task 5: Shared collision rules (authoritative)

**Files:**
- Create: `src/shared/collisions.js`
- Create: `test/collisions.test.js`

**Interfaces:**
- Consumes: `Snake`, `Particle`, `CONSTANTS`.
- Produces `{ eatParticles, resolveSnakeCollisions, hitsWorldEdge, hitsSelf }`:
  - `eatParticles(snakes, particles)` — mutates: living snakes eat overlapping particles; returns array of removed particle indices handled internally (removes in place). Returns count eaten.
  - `hitsWorldEdge(snake)` — bool, head within `WALL_PADDING+radius` of any edge... (use existing tolerance: edge at 30, see below).
  - `hitsSelf(snake)` — bool, head hits own body (skip first 10 segments), only when `length > 20`.
  - `resolveSnakeCollisions(snakes)` — for each living pair: head-to-head (smaller dies, bigger eats), and head-to-body (head owner dies, body owner gains 30% mass). Marks losers `isDead = true` and returns array of `{ deadId, byName }` kill events.

Collision thresholds copy existing behavior:
- particle eat: `head.distance(p.position) < snake.radius + p.radius`
- head-head: `distance < r1 + r2` → smaller mass dies; ties: snake2 dies.
- head-body: `head.distance(segment) < headRadius + otherRadius*0.8`, skip first 5 segments of the other body.
- world edge: `headX - r <= 30 || headX + r >= WORLD-30 || headY - r <= 30 || headY + r >= WORLD-30`.

- [ ] **Step 1: Write the failing test**

Create `test/collisions.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { Snake } = require('../src/shared/snake.js');
const { Particle } = require('../src/shared/particle.js');
const { eatParticles, resolveSnakeCollisions, hitsWorldEdge, hitsSelf } = require('../src/shared/collisions.js');

function snakeAt(id, x, y, mass) {
  const s = new Snake({ id, x, y, name: id, isBot: false });
  s.mass = mass;
  return s;
}

test('snake eats an overlapping particle and grows', () => {
  const s = snakeAt('a', 100, 100, 100);
  const particles = [new Particle(100, 100)];
  const m0 = s.mass;
  const eaten = eatParticles([s], particles);
  assert.equal(eaten, 1);
  assert.equal(particles.length, 0);
  assert.ok(s.mass > m0);
});

test('distant particle is not eaten', () => {
  const s = snakeAt('a', 100, 100, 100);
  const particles = [new Particle(3000, 3000)];
  assert.equal(eatParticles([s], particles), 0);
  assert.equal(particles.length, 1);
});

test('head-to-head: bigger eats smaller', () => {
  const big = snakeAt('big', 500, 500, 300);
  const small = snakeAt('small', 500, 500, 100);
  const kills = resolveSnakeCollisions([big, small]);
  assert.equal(small.isDead, true);
  assert.equal(big.isDead, false);
  assert.ok(kills.some((k) => k.deadId === 'small'));
});

test('head into body kills the intruder', () => {
  const victimBody = snakeAt('body', 500, 500, 300);
  // Put intruder head onto a mid-body segment of victimBody
  const target = victimBody.body[8];
  const intruder = snakeAt('intruder', target.x, target.y, 100);
  const kills = resolveSnakeCollisions([victimBody, intruder]);
  assert.equal(intruder.isDead, true);
  assert.ok(kills.some((k) => k.deadId === 'intruder'));
});

test('hitsWorldEdge true near the wall', () => {
  const s = snakeAt('a', 5, 2000, 100);
  assert.equal(hitsWorldEdge(s), true);
});

test('hitsWorldEdge false in open space', () => {
  const s = snakeAt('a', 2000, 2000, 100);
  assert.equal(hitsWorldEdge(s), false);
});

test('hitsSelf false for short snake', () => {
  const s = snakeAt('a', 2000, 2000, 100);
  assert.equal(hitsSelf(s), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/collisions.test.js`
Expected: FAIL — cannot find module `../src/shared/collisions.js`.

- [ ] **Step 3: Create `src/shared/collisions.js`**

```js
// Authoritative collision rules. Pure functions over snakes/particles.
(function (root) {
  const C = (typeof module !== 'undefined' && module.exports)
    ? require('./constants.js') : root;
  const CONSTANTS = C.CONSTANTS;

  function eatParticles(snakes, particles) {
    let eaten = 0;
    const living = snakes.filter((s) => !s.isDead);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      for (const s of living) {
        if (s.head.distance(p.position) < s.radius + p.radius) {
          s.eatParticleValue(p.value);
          particles.splice(i, 1);
          eaten++;
          break;
        }
      }
    }
    return eaten;
  }

  function hitsWorldEdge(snake) {
    const r = snake.radius;
    const x = snake.head.x, y = snake.head.y;
    const W = CONSTANTS.WORLD_SIZE;
    return (x - r <= 30 || x + r >= W - 30 || y - r <= 30 || y + r >= W - 30);
  }

  function hitsSelf(snake) {
    if (snake.length <= 20) return false;
    const head = snake.head;
    const r = snake.radius;
    for (let i = 10; i < snake.body.length; i++) {
      if (head.distance(snake.body[i]) < r * 1.5) return true;
    }
    return false;
  }

  function headHitsBody(headSnake, bodySnake) {
    const head = headSnake.head;
    const r = headSnake.radius;
    for (let i = 5; i < bodySnake.body.length; i++) {
      if (head.distance(bodySnake.body[i]) < r + bodySnake.radius * 0.8) return true;
    }
    return false;
  }

  function resolveSnakeCollisions(snakes) {
    const kills = [];
    const living = snakes.filter((s) => !s.isDead);

    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i], b = living[j];
        if (a.isDead || b.isDead) continue;

        // Head-to-head
        if (a.head.distance(b.head) < a.radius + b.radius) {
          if (a.mass > b.mass) {
            a.eatSnakeMass(b.mass); b.isDead = true;
            kills.push({ deadId: b.id, byName: a.name });
          } else {
            b.eatSnakeMass(a.mass); a.isDead = true;
            kills.push({ deadId: a.id, byName: b.name });
          }
          continue;
        }

        // a head into b body
        if (!a.isDead && headHitsBody(a, b)) {
          a.isDead = true; b.mass += a.mass * 0.3;
          kills.push({ deadId: a.id, byName: b.name });
        }
        // b head into a body
        if (!b.isDead && headHitsBody(b, a)) {
          b.isDead = true; a.mass += b.mass * 0.3;
          kills.push({ deadId: b.id, byName: a.name });
        }
      }
    }
    return kills;
  }

  const api = { eatParticles, resolveSnakeCollisions, hitsWorldEdge, hitsSelf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/collisions.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/collisions.js test/collisions.test.js
git commit -m "feat: add authoritative shared collision rules"
```

---

## Task 6: Shared AI (bot aim decision)

**Files:**
- Create: `src/shared/ai.js`
- Create: `test/ai.test.js`

**Interfaces:**
- Consumes: `Vector2`, `Snake`, `Particle`, `CONSTANTS`, `randomRange`.
- Produces `{ computeAiAim }`: `computeAiAim(bot, particles, allSnakes, dt)` returns `{ x, y }` world point the bot should aim at. Internally updates `bot.aiChangeTargetTimer` / `bot.targetPosition` (throttled re-targeting), and applies self-avoidance. This is the *improved* version of the old `updateAI`/`findNewTarget`: it avoids own body, flees bigger snakes, hunts smaller snakes, else seeks nearest food, else wanders near center.

- [ ] **Step 1: Write the failing test**

Create `test/ai.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { Snake } = require('../src/shared/snake.js');
const { Particle } = require('../src/shared/particle.js');
const { computeAiAim } = require('../src/shared/ai.js');

function bot(x, y, mass) {
  const s = new Snake({ id: 'bot', x, y, name: 'Bot', isBot: true });
  s.mass = mass;
  return s;
}

test('returns a point with numeric coords', () => {
  const b = bot(2000, 2000, 100);
  const aim = computeAiAim(b, [new Particle(2100, 2000)], [b], 1 / 30);
  assert.equal(typeof aim.x, 'number');
  assert.equal(typeof aim.y, 'number');
});

test('seeks nearby food when no threats', () => {
  const b = bot(2000, 2000, 100);
  b.aiChangeTargetTimer = 999; // force retarget
  const food = new Particle(2200, 2000);
  const aim = computeAiAim(b, [food], [b], 1 / 30);
  // Should aim roughly toward the food (to the +x side)
  assert.ok(aim.x > 2000, `aim.x ${aim.x} should be toward food`);
});

test('flees a much bigger nearby snake', () => {
  const b = bot(2000, 2000, 100);
  b.aiChangeTargetTimer = 999;
  const threat = new Snake({ id: 'big', x: 2100, y: 2000, name: 'Big', isBot: true });
  threat.mass = 500;
  const aim = computeAiAim(b, [], [b, threat], 1 / 30);
  // Threat is to +x, so bot should aim to -x (away)
  assert.ok(aim.x < 2000, `aim.x ${aim.x} should flee to -x`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ai.test.js`
Expected: FAIL — cannot find module `../src/shared/ai.js`.

- [ ] **Step 3: Create `src/shared/ai.js`**

```js
// Bot decision logic. Produces an aim point for a bot snake each tick.
(function (root) {
  const V = (typeof module !== 'undefined' && module.exports)
    ? require('./vector2.js') : root;
  const R = (typeof module !== 'undefined' && module.exports)
    ? require('./random.js') : root;
  const C = (typeof module !== 'undefined' && module.exports)
    ? require('./constants.js') : root;
  const Vector2 = V.Vector2;
  const randomRange = R.randomRange;
  const CONSTANTS = C.CONSTANTS;

  function pickTarget(bot, particles, others) {
    const head = bot.head;

    // 1. Avoid own body: if a mid/far segment is too close, steer directly away.
    const safe = bot.radius * 4;
    for (let i = 15; i < bot.body.length; i++) {
      const seg = bot.body[i];
      if (head.distance(seg) < safe * 2) {
        const ang = Math.atan2(head.y - seg.y, head.x - seg.x);
        return new Vector2(head.x + Math.cos(ang) * 400, head.y + Math.sin(ang) * 400);
      }
    }

    // 2. Flee bigger snakes within 220.
    for (const s of others) {
      if (s === bot || s.isDead) continue;
      if (s.mass > bot.mass * 1.2 && head.distance(s.head) < 220) {
        const ang = Math.atan2(head.y - s.head.y, head.x - s.head.x);
        return new Vector2(head.x + Math.cos(ang) * 300, head.y + Math.sin(ang) * 300);
      }
    }

    // 3. Hunt smaller snakes within 450.
    let prey = null, preyDist = Infinity;
    for (const s of others) {
      if (s === bot || s.isDead) continue;
      if (s.mass < bot.mass * 0.7) {
        const d = head.distance(s.head);
        if (d < 450 && d < preyDist) { prey = s; preyDist = d; }
      }
    }
    if (prey) return new Vector2(prey.head.x, prey.head.y);

    // 4. Nearest food within 700.
    let food = null, foodDist = Infinity;
    for (const p of particles) {
      const d = head.distance(p.position);
      if (d < 700 && d < foodDist) { foodDist = d; food = p; }
    }
    if (food) return new Vector2(food.position.x, food.position.y);

    // 5. Wander near center.
    const c = CONSTANTS.WORLD_SIZE / 2;
    return new Vector2(randomRange(c - 500, c + 500), randomRange(c - 500, c + 500));
  }

  function computeAiAim(bot, particles, allSnakes, dt) {
    bot.aiChangeTargetTimer += dt;
    if (!bot.targetPosition || bot.aiChangeTargetTimer > bot.aiChangeTargetInterval) {
      bot.aiChangeTargetTimer = 0;
      bot.targetPosition = pickTarget(bot, particles, allSnakes);
    }
    return { x: bot.targetPosition.x, y: bot.targetPosition.y };
  }

  const api = { computeAiAim };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ai.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/ai.js test/ai.test.js
git commit -m "feat: add shared bot AI aim logic"
```

---

## Task 7: GameRoom (authoritative game instance)

**Files:**
- Create: `server/GameRoom.js`
- Create: `test/gameroom.test.js`

**Interfaces:**
- Consumes: `Snake`, `Particle`, `collisions.*`, `computeAiAim`, `CONSTANTS`, `randomRange`, `randomName`.
- Produces: `GameRoom` class:
  - `new GameRoom(code, { numBots = 6 })` — spawns particles + bots.
  - `addPlayer(id, name, color)` → creates a player snake at a random spawn, returns the snake.
  - `removePlayer(id)` — deletes that snake.
  - `setInput(id, aimX, aimY, boost)` — stores latest input for that snake.
  - `humanCount()` → number of non-bot snakes present.
  - `step(dt)` — apply inputs, run bot AI, `snake.step`, edge/self death, collisions, respawn dead bots after 3s (tracked via `respawnAt` using an internal clock accumulator), maintain particles. Returns `{ kills }` (array of `{ deadId, byName }`).
  - `snapshot()` → `{ tick, snakes: [snake.toState()...], particles: [p.toState()...], leaderboard: [{name,mass}...] }` (leaderboard top 10 by mass, living only).

Bot sizing (matches old game): bot[0] mass 300, bot[1] 200, bot[2..3] 150, rest 100.

- [ ] **Step 1: Write the failing test**

Create `test/gameroom.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { GameRoom } = require('../server/GameRoom.js');

test('room starts with bots and particles', () => {
  const room = new GameRoom('ABCDE', { numBots: 6 });
  const snap = room.snapshot();
  assert.equal(snap.snakes.length, 6);
  assert.ok(snap.particles.length > 100);
});

test('adding a player increases snake count and human count', () => {
  const room = new GameRoom('ABCDE', { numBots: 2 });
  room.addPlayer('p1', 'You', '#00ff88');
  assert.equal(room.humanCount(), 1);
  assert.equal(room.snapshot().snakes.length, 3);
});

test('step advances without throwing and returns kills array', () => {
  const room = new GameRoom('ABCDE', { numBots: 3 });
  room.addPlayer('p1', 'You', '#00ff88');
  room.setInput('p1', 3000, 2000, false);
  let res;
  for (let i = 0; i < 30; i++) res = room.step(1 / 30);
  assert.ok(Array.isArray(res.kills));
});

test('removing the player drops human count to zero', () => {
  const room = new GameRoom('ABCDE', { numBots: 1 });
  room.addPlayer('p1', 'You', '#00ff88');
  room.removePlayer('p1');
  assert.equal(room.humanCount(), 0);
});

test('snapshot leaderboard is sorted by mass desc, max 10', () => {
  const room = new GameRoom('ABCDE', { numBots: 6 });
  const lb = room.snapshot().leaderboard;
  assert.ok(lb.length <= 10);
  for (let i = 1; i < lb.length; i++) assert.ok(lb[i - 1].mass >= lb[i].mass);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/gameroom.test.js`
Expected: FAIL — cannot find module `../server/GameRoom.js`.

- [ ] **Step 3: Create `server/GameRoom.js`**

```js
const { Snake } = require('../src/shared/snake.js');
const { Particle } = require('../src/shared/particle.js');
const { eatParticles, resolveSnakeCollisions, hitsWorldEdge, hitsSelf } = require('../src/shared/collisions.js');
const { computeAiAim } = require('../src/shared/ai.js');
const { CONSTANTS } = require('../src/shared/constants.js');
const { randomRange, randomName } = require('../src/shared/random.js');

const BOT_MASS = [300, 200, 150, 150];
function botMass(i) { return BOT_MASS[i] !== undefined ? BOT_MASS[i] : 100; }

function spawnPoint() {
  return {
    x: randomRange(200, CONSTANTS.WORLD_SIZE - 200),
    y: randomRange(200, CONSTANTS.WORLD_SIZE - 200),
  };
}

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

    for (let i = 0; i < CONSTANTS.START_PARTICLES; i++) this._spawnParticle();
    for (let i = 0; i < numBots; i++) this._spawnBot(i);
  }

  _spawnParticle() {
    const x = randomRange(50, CONSTANTS.WORLD_SIZE - 50);
    const y = randomRange(50, CONSTANTS.WORLD_SIZE - 50);
    this.particles.push(new Particle(x, y));
  }

  _spawnBot(slot) {
    const id = `bot-${this._botSeq++}`;
    const { x, y } = spawnPoint();
    const s = new Snake({ id, x, y, name: randomName(), isBot: true });
    s.mass = botMass(slot);
    s._slot = slot;
    this.snakes.set(id, s);
    return s;
  }

  addPlayer(id, name, color) {
    const { x, y } = spawnPoint();
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
      } else {
        const inp = this.inputs.get(s.id);
        if (inp) { s.setAim(inp.aimX, inp.aimY); s.setBoost(inp.boost); }
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
    return { tick: this.tick, snakes, particles: this.particles.map((p) => p.toState()), leaderboard };
  }
}

module.exports = { GameRoom };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/gameroom.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/GameRoom.js test/gameroom.test.js
git commit -m "feat: add authoritative GameRoom simulation"
```

---

## Task 8: LobbyManager (rooms by code)

**Files:**
- Create: `server/LobbyManager.js`
- Create: `test/lobbymanager.test.js`

**Interfaces:**
- Consumes: `GameRoom`, `makeRoomCode`.
- Produces: `LobbyManager` class:
  - `createRoom({ numBots })` → `{ code, room }`, unique code.
  - `getRoom(code)` → `GameRoom | null` (case-insensitive; codes stored uppercase).
  - `removeRoom(code)`.
  - `rooms` → Map of code→room (for the tick loop to iterate).
  - `gcEmptyRooms()` — deletes rooms with `humanCount() === 0`.

- [ ] **Step 1: Write the failing test**

Create `test/lobbymanager.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { LobbyManager } = require('../server/LobbyManager.js');

test('createRoom returns a unique 5-letter code and a room', () => {
  const lm = new LobbyManager();
  const { code, room } = lm.createRoom({ numBots: 2 });
  assert.match(code, /^[A-Z]{5}$/);
  assert.equal(lm.getRoom(code), room);
});

test('getRoom is case-insensitive', () => {
  const lm = new LobbyManager();
  const { code, room } = lm.createRoom({ numBots: 1 });
  assert.equal(lm.getRoom(code.toLowerCase()), room);
});

test('getRoom returns null for unknown code', () => {
  const lm = new LobbyManager();
  assert.equal(lm.getRoom('ZZZZZ'), null);
});

test('gcEmptyRooms removes rooms with no humans', () => {
  const lm = new LobbyManager();
  const { code } = lm.createRoom({ numBots: 1 });
  lm.gcEmptyRooms();
  assert.equal(lm.getRoom(code), null);
});

test('gcEmptyRooms keeps rooms with a human', () => {
  const lm = new LobbyManager();
  const { code, room } = lm.createRoom({ numBots: 1 });
  room.addPlayer('p1', 'You', '#00ff88');
  lm.gcEmptyRooms();
  assert.equal(lm.getRoom(code), room);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/lobbymanager.test.js`
Expected: FAIL — cannot find module `../server/LobbyManager.js`.

- [ ] **Step 3: Create `server/LobbyManager.js`**

```js
const { GameRoom } = require('./GameRoom.js');
const { makeRoomCode } = require('../src/shared/random.js');

class LobbyManager {
  constructor() { this.rooms = new Map(); } // code -> GameRoom

  createRoom({ numBots = 6 } = {}) {
    let code = makeRoomCode();
    while (this.rooms.has(code)) code = makeRoomCode();
    const room = new GameRoom(code, { numBots });
    this.rooms.set(code, room);
    return { code, room };
  }

  getRoom(code) {
    if (!code) return null;
    return this.rooms.get(String(code).toUpperCase()) || null;
  }

  removeRoom(code) { this.rooms.delete(String(code).toUpperCase()); }

  gcEmptyRooms() {
    for (const [code, room] of this.rooms) {
      if (room.humanCount() === 0) this.rooms.delete(code);
    }
  }
}

module.exports = { LobbyManager };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/lobbymanager.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/LobbyManager.js test/lobbymanager.test.js
git commit -m "feat: add LobbyManager for room codes"
```

---

## Task 9: Server wiring — Express + WebSocket + tick loop

**Files:**
- Modify: `server.js` (full replacement)
- Create: `test/protocol.test.js` (integration over a real WS connection)

**Interfaces:**
- Consumes: `LobbyManager`, `CONSTANTS`.
- Produces: an HTTP+WS server. WS protocol (JSON):
  - C→S `{type:'create', name, color}` → S→C `{type:'created', code, playerId}`
  - C→S `{type:'join', code, name, color}` → S→C `{type:'joined', code, playerId}` or `{type:'error', message}`
  - C→S `{type:'input', aimX, aimY, boost}`
  - C→S `{type:'leave'}`
  - S→C `{type:'state', ...snapshot}` every tick to each client in that room
  - S→C `{type:'dead', by}` when that client's snake dies
- Exports `{ createServer }` returning `{ server, close }` so tests can start/stop on an ephemeral port. `server.js` run directly listens on `PORT` (env or 3000).

- [ ] **Step 1: Write the failing integration test**

Create `test/protocol.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { createServer } = require('../server.js');

function once(ws, predicate) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), 3000);
    ws.on('message', (buf) => {
      const msg = JSON.parse(buf.toString());
      if (predicate(msg)) { clearTimeout(t); resolve(msg); }
    });
  });
}

test('create then join with the code connects two players', async () => {
  const { server, close } = createServer(0);
  await new Promise((r) => server.on('listening', r));
  const port = server.address().port;

  const host = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((r) => host.on('open', r));
  host.send(JSON.stringify({ type: 'create', name: 'Host', color: '#00ff88' }));
  const created = await once(host, (m) => m.type === 'created');
  assert.match(created.code, /^[A-Z]{5}$/);

  const guest = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((r) => guest.on('open', r));
  guest.send(JSON.stringify({ type: 'join', code: created.code, name: 'Guest', color: '#ff6b6b' }));
  const joined = await once(guest, (m) => m.type === 'joined');
  assert.equal(joined.code, created.code);

  // Both should receive state broadcasts.
  const state = await once(host, (m) => m.type === 'state');
  assert.ok(state.snakes.length >= 2);

  host.close(); guest.close();
  await close();
});

test('joining an unknown code returns an error', async () => {
  const { server, close } = createServer(0);
  await new Promise((r) => server.on('listening', r));
  const port = server.address().port;
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ type: 'join', code: 'ZZZZZ', name: 'X', color: '#fff' }));
  const err = await once(ws, (m) => m.type === 'error');
  assert.match(err.message, /not found/i);
  ws.close();
  await close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/protocol.test.js`
Expected: FAIL — `createServer` is not exported / old `server.js` has no WS.

- [ ] **Step 3: Replace `server.js`**

```js
const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const { LobbyManager } = require('./server/LobbyManager.js');
const { CONSTANTS } = require('./src/shared/constants.js');

function createServer(port = process.env.PORT || 3000) {
  const app = express();
  app.use(express.static(__dirname));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const lobbies = new LobbyManager();

  // client metadata: ws -> { roomCode, playerId }
  const meta = new WeakMap();
  let playerSeq = 0;

  function send(ws, obj) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  }

  wss.on('connection', (ws) => {
    meta.set(ws, { roomCode: null, playerId: null });

    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString()); } catch { return; }
      const m = meta.get(ws);

      if (msg.type === 'create') {
        const { code, room } = lobbies.createRoom({ numBots: 6 });
        const id = `p${playerSeq++}`;
        room.addPlayer(id, msg.name, msg.color);
        meta.set(ws, { roomCode: code, playerId: id });
        send(ws, { type: 'created', code, playerId: id });
        return;
      }

      if (msg.type === 'join') {
        const room = lobbies.getRoom(msg.code);
        if (!room) { send(ws, { type: 'error', message: 'Lobby not found' }); return; }
        const id = `p${playerSeq++}`;
        room.addPlayer(id, msg.name, msg.color);
        meta.set(ws, { roomCode: room.code, playerId: id });
        send(ws, { type: 'joined', code: room.code, playerId: id });
        return;
      }

      if (msg.type === 'input' && m.roomCode) {
        const room = lobbies.getRoom(m.roomCode);
        if (room) room.setInput(m.playerId, msg.aimX, msg.aimY, msg.boost);
        return;
      }

      if (msg.type === 'leave' && m.roomCode) {
        const room = lobbies.getRoom(m.roomCode);
        if (room) room.removePlayer(m.playerId);
        meta.set(ws, { roomCode: null, playerId: null });
        return;
      }
    });

    ws.on('close', () => {
      const m = meta.get(ws);
      if (m && m.roomCode) {
        const room = lobbies.getRoom(m.roomCode);
        if (room) room.removePlayer(m.playerId);
      }
    });
  });

  // Fixed-rate simulation + broadcast.
  const interval = setInterval(() => {
    for (const [code, room] of lobbies.rooms) {
      const { kills } = room.step(CONSTANTS.DT);
      const snap = room.snapshot();
      const payload = JSON.stringify({ type: 'state', ...snap });
      for (const ws of wss.clients) {
        const m = meta.get(ws);
        if (!m || m.roomCode !== code || ws.readyState !== ws.OPEN) continue;
        ws.send(payload);
        const myKill = kills.find((k) => k.deadId === m.playerId);
        if (myKill) send(ws, { type: 'dead', by: myKill.byName });
      }
    }
    lobbies.gcEmptyRooms();
  }, 1000 / CONSTANTS.TICK_RATE);

  server.listen(port);

  function close() {
    clearInterval(interval);
    return new Promise((resolve) => { wss.close(() => server.close(resolve)); });
  }

  return { server, wss, lobbies, close };
}

if (require.main === module) {
  const { server } = createServer();
  server.on('listening', () => {
    const addr = server.address();
    console.log(`🎮 Snakes IO multiplayer server on http://localhost:${addr.port}`);
    console.log('Share your LAN IP with players on the same WiFi.');
  });
}

module.exports = { createServer };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/protocol.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests from Tasks 1–9 PASS.

- [ ] **Step 6: Commit**

```bash
git add server.js test/protocol.test.js
git commit -m "feat: server-authoritative WS server with tick loop"
```

---

## Task 10: Client networking module

**Files:**
- Create: `src/client/net.js`

**Interfaces:**
- Browser global `NetClient`. Usage:
  - `const net = new NetClient()`
  - `net.connect()` → Promise resolves on WS open.
  - `net.create(name, color)` / `net.join(code, name, color)`
  - `net.sendInput(aimX, aimY, boost)` (throttled internally to ~20/s)
  - callbacks: `net.onCreated`, `net.onJoined`, `net.onError`, `net.onState`, `net.onDead` (assignable functions)
  - `net.latestTwo()` → `[prevSnapshot, lastSnapshot]` buffered states for interpolation (each is the raw `state` message).

No test (browser-only WS glue; covered manually in Task 14).

- [ ] **Step 1: Create `src/client/net.js`**

```js
// Browser WebSocket client + snapshot buffer for interpolation.
class NetClient {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.code = null;
    this._buf = []; // last two state messages
    this._lastInputSent = 0;
    this.onCreated = () => {};
    this.onJoined = () => {};
    this.onError = () => {};
    this.onState = () => {};
    this.onDead = () => {};
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}`);
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (e) => reject(e));
      this.ws.addEventListener('message', (ev) => this._onMessage(ev));
    });
  }

  _onMessage(ev) {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    switch (msg.type) {
      case 'created': this.playerId = msg.playerId; this.code = msg.code; this.onCreated(msg); break;
      case 'joined': this.playerId = msg.playerId; this.code = msg.code; this.onJoined(msg); break;
      case 'error': this.onError(msg); break;
      case 'dead': this.onDead(msg); break;
      case 'state':
        this._buf.push(msg);
        if (this._buf.length > 2) this._buf.shift();
        this.onState(msg);
        break;
    }
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  create(name, color) { this._send({ type: 'create', name, color }); }
  join(code, name, color) { this._send({ type: 'join', code: String(code).toUpperCase(), name, color }); }
  leave() { this._send({ type: 'leave' }); }

  sendInput(aimX, aimY, boost) {
    const now = performance.now();
    if (now - this._lastInputSent < 50) return; // ~20/s
    this._lastInputSent = now;
    this._send({ type: 'input', aimX, aimY, boost });
  }

  latestTwo() {
    if (this._buf.length === 0) return [null, null];
    if (this._buf.length === 1) return [this._buf[0], this._buf[0]];
    return [this._buf[0], this._buf[1]];
  }
}
```

- [ ] **Step 2: Sanity check (syntax only)**

Run: `node --check src/client/net.js`
Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
git add src/client/net.js
git commit -m "feat: add client NetClient with snapshot buffer"
```

---

## Task 11: Client renderer with interpolation

**Files:**
- Create: `src/client/renderer.js`

**Interfaces:**
- Browser global `Renderer`. Usage:
  - `const r = new Renderer(canvas)`
  - `r.setFollowId(playerId)` — which snake the camera follows.
  - `r.render(prevSnapshot, lastSnapshot, alpha)` — draws interpolated frame; `alpha` in [0,1] between the two snapshots. Falls back to `lastSnapshot` when prev is null.
- Ports the old camera + drawing (grid, particles, glow snakes, eyes, name tags, borders, boost flash) to draw from plain state objects. Interpolates snake segment positions and particle positions by matching `id` (snakes) / index (particles) across the two snapshots.

Interpolation detail: build a map of prev snakes by `id`; for each snake in `last`, if a prev exists, lerp each segment `i` that exists in both (`prev.segments[i]`), else use last positions. Camera centers on the followed snake's head (interpolated), matching old smoothing-free centering (`position = head - screen/2`).

- [ ] **Step 1: Create `src/client/renderer.js`**

```js
// Renders authoritative snapshots with interpolation. Browser-only.
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.followId = null;
    this.cam = { x: 0, y: 0 };
    this.zoom = 1;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setFollowId(id) { this.followId = id; }

  _lerp(a, b, t) { return a + (b - a) * t; }

  _interpSnakes(prev, last, alpha) {
    const prevById = new Map();
    if (prev) for (const s of prev.snakes) prevById.set(s.id, s);
    return last.snakes.map((s) => {
      const p = prevById.get(s.id);
      if (!p) return s;
      const n = Math.min(s.segments.length, p.segments.length);
      const segments = s.segments.map((seg, i) => {
        if (i < n) {
          return { x: this._lerp(p.segments[i].x, seg.x, alpha),
                   y: this._lerp(p.segments[i].y, seg.y, alpha) };
        }
        return seg;
      });
      const angle = this._lerp(p.angle, s.angle, alpha);
      return { ...s, segments, angle };
    });
  }

  worldToScreen(x, y) {
    return { x: (x - this.cam.x) * this.zoom, y: (y - this.cam.y) * this.zoom };
  }

  render(prev, last, alpha) {
    if (!last) return;
    const snakes = this._interpSnakes(prev, last, alpha);

    // Camera follows our snake's head.
    const me = snakes.find((s) => s.id === this.followId) || snakes[0];
    if (me) {
      const head = me.segments[0];
      this.cam.x = head.x - this.canvas.width / (2 * this.zoom);
      this.cam.y = head.y - this.canvas.height / (2 * this.zoom);
    }

    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawGrid();
    for (const p of last.particles) this._drawParticle(p);
    for (const s of snakes) this._drawSnake(s);
    this._drawBorders();
    const meBoost = me && me.boosting;
    if (meBoost) { ctx.fillStyle = 'rgba(255,255,0,0.3)'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); }
  }

  _drawGrid() {
    const ctx = this.ctx;
    const grid = 100;
    const startX = Math.floor(this.cam.x / grid) * grid;
    const startY = Math.floor(this.cam.y / grid) * grid;
    const endX = this.cam.x + this.canvas.width / this.zoom;
    const endY = this.cam.y + this.canvas.height / this.zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = startX; x < endX; x += grid) {
      const sp = this.worldToScreen(x, 0);
      ctx.beginPath(); ctx.moveTo(sp.x, 0); ctx.lineTo(sp.x, this.canvas.height); ctx.stroke();
    }
    for (let y = startY; y < endY; y += grid) {
      const sp = this.worldToScreen(0, y);
      ctx.beginPath(); ctx.moveTo(0, sp.y); ctx.lineTo(this.canvas.width, sp.y); ctx.stroke();
    }
  }

  _drawParticle(p) {
    const ctx = this.ctx;
    const sp = this.worldToScreen(p.x, p.y);
    if (sp.x < -50 || sp.x > this.canvas.width + 50 || sp.y < -50 || sp.y > this.canvas.height + 50) return;
    const glow = p.r + 6;
    const g = ctx.createRadialGradient(sp.x, sp.y, p.r, sp.x, sp.y, glow);
    g.addColorStop(0, p.color); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, glow, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(sp.x, sp.y, p.r, 0, Math.PI * 2); ctx.fill();
  }

  _drawSnake(s) {
    const ctx = this.ctx;
    const radius = s.radius;
    for (let i = s.segments.length - 1; i >= 0; i--) {
      const sp = this.worldToScreen(s.segments[i].x, s.segments[i].y);
      if (sp.x < -radius * 3 || sp.x > this.canvas.width + radius * 3 ||
          sp.y < -radius * 3 || sp.y > this.canvas.height + radius * 3) continue;
      const g = ctx.createRadialGradient(sp.x, sp.y, radius * 0.5, sp.x, sp.y, radius * 2);
      g.addColorStop(0, s.color); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, radius * 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(sp.x - radius * 0.3, sp.y - radius * 0.3, radius * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    // Eyes
    const hs = this.worldToScreen(s.segments[0].x, s.segments[0].y);
    const eyeDist = radius * 0.5, eyeSize = radius * 0.3;
    for (const side of [-1, 1]) {
      const ex = hs.x + Math.cos(s.angle + side * 0.5) * eyeDist;
      const ey = hs.y + Math.sin(s.angle + side * 0.5) * eyeDist;
      ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(ex, ey, eyeSize, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(ex, ey, eyeSize * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    // Name tag for everyone (helps tell players apart)
    ctx.fillStyle = 'white'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
    ctx.fillText(s.name, hs.x, hs.y - radius - 15);
  }

  _drawBorders() {
    const ctx = this.ctx;
    const W = 4000;
    const corners = [ {x:0,y:0}, {x:W,y:0}, {x:W,y:W}, {x:0,y:W} ];
    ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 10; ctx.setLineDash([20, 10]);
    for (let i = 0; i < corners.length; i++) {
      const a = this.worldToScreen(corners[i].x, corners[i].y);
      const b = this.worldToScreen(corners[(i + 1) % 4].x, corners[(i + 1) % 4].y);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}
```

- [ ] **Step 2: Sanity check**

Run: `node --check src/client/renderer.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/client/renderer.js
git commit -m "feat: add interpolating client renderer"
```

---

## Task 12: Client input module

**Files:**
- Create: `src/client/input.js`

**Interfaces:**
- Browser global `InputController`. Usage:
  - `const input = new InputController(canvas, controlMethod)`
  - `input.getAim(renderer)` → `{ x, y }` world point (uses renderer camera for mouse→world), computed from mouse / arrows / joystick.
  - `input.boost` → bool (spacebar or joystick state).
  - draws its own joystick overlay is NOT its job; keep minimal. Boost flash handled by renderer.
- Mirrors old control handling: mouse (aim at cursor), arrows/WASD (aim far in current direction), joystick (aim in drag direction).

- [ ] **Step 1: Create `src/client/input.js`**

```js
// Captures player input and converts to an aim point + boost flag. Browser-only.
class InputController {
  constructor(canvas, controlMethod = 'mouse') {
    this.canvas = canvas;
    this.method = controlMethod;
    this.mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    this.arrowDir = { x: 0, y: -1 };
    this.boost = false;
    this.joystick = { active: false, cx: 0, cy: 0, x: 0, y: 0 };
    this._bind();
  }

  _bind() {
    this.canvas.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
      if (this.method === 'joystick' && this.joystick.active) {
        this.joystick.x = this.mouse.x; this.joystick.y = this.mouse.y;
      }
    });
    document.addEventListener('keydown', (e) => {
      if (this.method === 'arrows') {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') { this.arrowDir = { x: 0, y: -1 }; e.preventDefault(); }
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') { this.arrowDir = { x: 0, y: 1 }; e.preventDefault(); }
        else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { this.arrowDir = { x: -1, y: 0 }; e.preventDefault(); }
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') { this.arrowDir = { x: 1, y: 0 }; e.preventDefault(); }
      }
      if (e.code === 'Space') { this.boost = true; e.preventDefault(); }
    });
    document.addEventListener('keyup', (e) => { if (e.code === 'Space') this.boost = false; });

    if (this.method === 'joystick') {
      const start = (x, y) => { this.joystick = { active: true, cx: x, cy: y, x, y }; };
      const move = (x, y) => { if (this.joystick.active) { this.joystick.x = x; this.joystick.y = y; } };
      const end = () => { this.joystick.active = false; };
      this.canvas.addEventListener('mousedown', (e) => { const r = this.canvas.getBoundingClientRect(); start(e.clientX - r.left, e.clientY - r.top); });
      this.canvas.addEventListener('mouseup', end);
      this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const r = this.canvas.getBoundingClientRect(); const t = e.touches[0]; start(t.clientX - r.left, t.clientY - r.top); });
      this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); const r = this.canvas.getBoundingClientRect(); const t = e.touches[0]; move(t.clientX - r.left, t.clientY - r.top); });
      this.canvas.addEventListener('touchend', (e) => { e.preventDefault(); end(); });
    }
  }

  getAim(renderer) {
    if (this.method === 'arrows') {
      const head = renderer.followHead || { x: 2000, y: 2000 };
      return { x: head.x + this.arrowDir.x * 1000, y: head.y + this.arrowDir.y * 1000 };
    }
    if (this.method === 'joystick' && this.joystick.active) {
      const dx = this.joystick.x - this.joystick.cx;
      const dy = this.joystick.y - this.joystick.cy;
      const head = renderer.followHead || { x: 2000, y: 2000 };
      if (Math.hypot(dx, dy) > 10) return { x: head.x + dx * 5, y: head.y + dy * 5 };
      return head;
    }
    // mouse → world via camera
    return {
      x: this.mouse.x / renderer.zoom + renderer.cam.x,
      y: this.mouse.y / renderer.zoom + renderer.cam.y,
    };
  }
}
```

Note: `renderer.followHead` is set by `main.js` each frame (the followed snake's interpolated head) so arrow/joystick aim is relative to the live head. Add that in Task 13.

- [ ] **Step 2: Sanity check**

Run: `node --check src/client/input.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/client/input.js
git commit -m "feat: add client input controller"
```

---

## Task 13: Lobby UI + main wiring; retire old client files

**Files:**
- Modify: `index.html` (add lobby UI + script tags; remove old script tags)
- Create: `src/client/main.js`
- Delete: `src/game.js`, `src/snake.js`, `src/particle.js`, `src/utils.js`, `src/main.js`, `src/camera.js`

**Interfaces:**
- Consumes: `NetClient`, `Renderer`, `InputController`.
- Produces: the wired app. Screens: menu (name, color, control, Create/Join), in-game (canvas + HUD), game-over. Render loop runs `requestAnimationFrame`, computes interpolation `alpha` from snapshot timing (fixed 1-snapshot delay), sets `renderer.followHead`, sends input each frame (throttled by NetClient), updates HUD from the latest snapshot.

- [ ] **Step 1: Inspect current menu markup**

Run: `grep -n "id=\"menu\"\|id=\"startGameBtn\"\|id=\"leaderboard\"\|id=\"score\"\|<script" index.html`
Expected: shows the menu container, start button, HUD element ids, and existing `<script>` tags to replace. Note their exact ids for reuse.

- [ ] **Step 2: Update `index.html` — replace the script tags at the bottom**

Find the block of existing script includes (from Step 1 output; they load `src/utils.js`, `src/camera.js`, `src/particle.js`, `src/snake.js`, `src/game.js`, `src/main.js`) and replace the whole block with:

```html
<!-- Shared simulation (also used by server) -->
<script src="src/shared/vector2.js"></script>
<script src="src/shared/constants.js"></script>
<script src="src/shared/random.js"></script>
<!-- Client -->
<script src="src/client/net.js"></script>
<script src="src/client/renderer.js"></script>
<script src="src/client/input.js"></script>
<script src="src/client/main.js"></script>
```

- [ ] **Step 3: Update `index.html` — add lobby controls inside the menu**

Inside the existing `#menu` container, add (place near the existing start button; keep existing name/color/control pickers):

```html
<div id="lobbyControls" style="margin-top:16px; display:flex; flex-direction:column; gap:10px; align-items:center;">
  <input id="playerName" placeholder="Your name" maxlength="16"
         style="padding:10px 14px; border-radius:8px; border:1px solid #2a2f3a; background:#11151c; color:#e6f1ff; font-size:16px; text-align:center;" />
  <button id="createLobbyBtn" class="control-btn">Create Lobby</button>
  <div style="display:flex; gap:8px;">
    <input id="joinCode" placeholder="CODE" maxlength="5"
           style="width:110px; text-transform:uppercase; padding:10px; border-radius:8px; border:1px solid #2a2f3a; background:#11151c; color:#e6f1ff; font-size:18px; letter-spacing:3px; text-align:center;" />
    <button id="joinLobbyBtn" class="control-btn">Join</button>
  </div>
  <div id="lobbyMsg" style="min-height:20px; color:#ff6b6b; font-size:14px;"></div>
</div>
<div id="lobbyBanner" style="display:none; margin-top:10px; color:#00ff88; font-size:18px;"></div>
```

If the old `#startGameBtn` exists, remove it (its single-player role is replaced by Create/Join).

- [ ] **Step 4: Create `src/client/main.js`**

```js
// Wires lobby UI -> networking -> render loop.
(function () {
  const canvas = document.getElementById('gameCanvas');
  const menu = document.getElementById('menu');
  const instructions = document.getElementById('instructions');
  const gameOver = document.getElementById('gameOver');

  const nameInput = document.getElementById('playerName');
  const joinCode = document.getElementById('joinCode');
  const lobbyMsg = document.getElementById('lobbyMsg');
  const lobbyBanner = document.getElementById('lobbyBanner');

  let selectedControl = 'mouse';
  let selectedColor = '#00ff88';

  // Control + color pickers (reuse existing buttons if present)
  document.querySelectorAll('.color-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedColor = opt.getAttribute('data-color');
    });
  });
  const ctrlMap = { mouseBtn: 'mouse', arrowsBtn: 'arrows', joystickBtn: 'joystick' };
  Object.keys(ctrlMap).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => {
      selectedControl = ctrlMap[id];
      document.querySelectorAll('.control-btn').forEach((b) => b.classList.remove('active'));
      el.classList.add('active');
    });
  });

  const net = new NetClient();
  let renderer = null;
  let input = null;
  let running = false;
  let lastSnapAt = 0;

  function playerName() { return (nameInput && nameInput.value.trim()) || 'Player'; }

  net.onError = (m) => { lobbyMsg.textContent = m.message || 'Error'; };
  net.onCreated = (m) => {
    lobbyBanner.style.display = 'block';
    lobbyBanner.textContent = `Lobby code: ${m.code} — share it!`;
    startGame(m.playerId);
  };
  net.onJoined = (m) => { startGame(m.playerId); };
  net.onState = () => { lastSnapAt = performance.now(); updateHUD(); };
  net.onDead = (m) => showGameOver(m.by);

  async function ensureConnected() {
    if (net.ws && net.ws.readyState === WebSocket.OPEN) return;
    try { await net.connect(); }
    catch { lobbyMsg.textContent = 'Could not reach server'; throw new Error('no-conn'); }
  }

  document.getElementById('createLobbyBtn').addEventListener('click', async () => {
    lobbyMsg.textContent = '';
    try { await ensureConnected(); net.create(playerName(), selectedColor); } catch {}
  });
  document.getElementById('joinLobbyBtn').addEventListener('click', async () => {
    lobbyMsg.textContent = '';
    const code = joinCode.value.trim().toUpperCase();
    if (code.length !== 5) { lobbyMsg.textContent = 'Enter a 5-letter code'; return; }
    try { await ensureConnected(); net.join(code, playerName(), selectedColor); } catch {}
  });

  function startGame(playerId) {
    menu.classList.add('hidden');
    if (instructions) instructions.classList.add('hidden');
    if (gameOver) gameOver.style.display = 'none';
    canvas.classList.add('playing');

    renderer = new Renderer(canvas);
    renderer.setFollowId(playerId);
    input = new InputController(canvas, selectedControl);
    running = true;
    requestAnimationFrame(loop);
  }

  function loop() {
    if (!running) return;
    const [prev, last] = net.latestTwo();
    if (last) {
      // 1-snapshot interpolation delay based on ~tick interval.
      const dtMs = 1000 / 30;
      const alpha = Math.min(1, (performance.now() - lastSnapAt) / dtMs);
      const me = last.snakes.find((s) => s.id === net.playerId);
      renderer.followHead = me ? me.segments[0] : renderer.followHead;
      renderer.render(prev, last, alpha);

      if (input) {
        const aim = input.getAim(renderer);
        net.sendInput(aim.x, aim.y, input.boost);
      }
    }
    requestAnimationFrame(loop);
  }

  function updateHUD() {
    const [, last] = net.latestTwo();
    if (!last) return;
    const me = last.snakes.find((s) => s.id === net.playerId);
    const score = document.getElementById('score');
    if (score && me) score.textContent = `Mass: ${Math.floor(me.mass)} | Length: ${me.segments.length}`;

    const list = document.getElementById('leaderboardList');
    if (list) {
      list.innerHTML = '';
      last.leaderboard.forEach((row, i) => {
        const el = document.createElement('div');
        el.className = 'leaderboard-entry' + (me && row.name === me.name ? ' player' : '');
        el.innerHTML = `<span>${i + 1}. ${row.name}</span><span>${row.mass}</span>`;
        list.appendChild(el);
      });
    }
  }

  function showGameOver(by) {
    running = false;
    canvas.classList.remove('playing');
    const fs = document.getElementById('finalScore');
    if (fs) fs.textContent = by === 'wall' ? 'You hit the wall!' : `You were eaten by ${by}!`;
    if (gameOver) gameOver.style.display = 'block';
  }

  // Respawn / back to menu from the existing game-over buttons.
  const restart = document.getElementById('restartBtn');
  if (restart) restart.addEventListener('click', () => {
    if (gameOver) gameOver.style.display = 'none';
    net.join(net.code, playerName(), selectedColor);
  });
  const toMenu = document.getElementById('mainMenuBtn');
  if (toMenu) toMenu.addEventListener('click', () => {
    running = false; net.leave();
    if (gameOver) gameOver.style.display = 'none';
    menu.classList.remove('hidden');
  });
})();
```

- [ ] **Step 5: Delete the retired client files**

```bash
git rm src/game.js src/snake.js src/particle.js src/utils.js src/main.js src/camera.js
```

- [ ] **Step 6: Verify no stale references remain**

Run: `grep -rn "src/game.js\|src/utils.js\|src/camera.js\|new Game(" index.html electron.js`
Expected: no matches (electron.js loads index.html, which now loads the new scripts).

- [ ] **Step 7: Full test suite still green**

Run: `npm test`
Expected: all unit + protocol tests PASS (client files aren't imported by tests).

- [ ] **Step 8: Commit**

```bash
git add index.html src/client/main.js
git commit -m "feat: lobby UI + client wiring; retire old single-player client"
```

---

## Task 14: Manual two-player verification + docs

**Files:**
- Modify: `README.md`, `QUICK_START.md`

**Interfaces:** none (verification + docs).

- [ ] **Step 1: Start the server**

Run: `npm run web`
Expected: `🎮 Snakes IO multiplayer server on http://localhost:3000`.

- [ ] **Step 2: Two-tab smoke test**

Open two browser tabs at `http://localhost:3000`.
- Tab A: enter a name, click **Create Lobby** → a code appears (e.g. `ABCDE`), game starts.
- Tab B: enter the code, click **Join** → game starts.
Verify: both tabs show two named snakes moving; eating particles grows them; running head-first into the other's body kills the intruder; the leaderboard updates; movement is smooth (interpolated), not stuttering.

- [ ] **Step 3: Same-WiFi device test**

Find the LAN IP: `ipconfig getifaddr en0` (e.g. `192.168.0.7`).
On the fiancé's device (same WiFi), open `http://<LAN-IP>:3000`, join the host's code, confirm both players see each other.

- [ ] **Step 4: Update `QUICK_START.md`**

Replace its play instructions with the multiplayer flow:

```markdown
# 🐍 Quick Start — Play Together on WiFi

1. On the host machine: `npm install` then `npm run web`.
2. The terminal prints the server URL. Find your LAN IP:
   - macOS: `ipconfig getifaddr en0`
   - Windows: `ipconfig` (look for IPv4 Address)
3. Host: open `http://localhost:3000`, enter a name, click **Create Lobby**. Share the 5-letter code.
4. Other players (same WiFi): open `http://<HOST-LAN-IP>:3000`, enter the code, click **Join**.
5. Mouse to steer, **Spacebar** to boost. Eat glowing dots to grow; make enemies crash into your body.
```

- [ ] **Step 5: Update `README.md` multiplayer section**

Under Features, adjust the "Play in Browser" wording to describe LAN multiplayer with room codes and server-authoritative play (no cloud required). Remove claims of AI-only single player being the only mode; note bots still fill the world.

- [ ] **Step 6: Commit**

```bash
git add README.md QUICK_START.md
git commit -m "docs: document same-WiFi multiplayer with room codes"
```

- [ ] **Step 7: Final full verification**

Run: `npm test`
Expected: all tests PASS. Manual two-player test from Steps 2–3 confirmed working.

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** room codes (Tasks 8–9,13), server-authoritative sim (Tasks 3–7,9), bots server-side (Task 7), smarter-foundation AI (Task 6), interpolation fixes jank (Tasks 11,13), authoritative collisions fix fairness (Task 5), performance via server sim (Tasks 7,9), error handling for bad codes/disconnect (Task 9), unit + integration + manual tests (throughout, Task 14). All Phase-1 spec sections map to a task.
- **Phase 2 (NOT in this plan):** AI behavior *tuning*, visual/audio polish, mobile polish. Do not implement here.
- **Type consistency:** snapshot shape (`snakes[].segments[].{x,y}`, `radius`, `angle`, `boosting`, `dead`, `particles[].{x,y,r,color}`, `leaderboard[].{name,mass}`) is identical across `Snake.toState`, `GameRoom.snapshot`, server broadcast, and `Renderer`. Message types (`create/created/join/joined/input/leave/state/dead/error`) match between `server.js` and `net.js`.
