# Snakes IO — Phase 2 (AI + Polish) Implementation Plan

> Executed autonomously via subagent-driven development. Steps use `- [ ]`.

**Goal:** Make the multiplayer game genuinely fun and polished — smarter AI bots, boost with a mass cost, safe spawns, smooth camera, sound effects, a kill feed, and a minimap.

**Architecture:** Same as Phase 1. Server-authoritative sim in `src/shared/` + `server/`; thin interpolating client in `src/client/`. All gameplay changes happen server-side; presentation changes happen client-side. Snapshot shape may gain fields (backward-compatible additions).

**Tech Stack:** Node, Express, `ws`, vanilla JS, `node:test`.

## Global Constraints
- No build step / framework. Vanilla JS. UMD guard for `src/shared/`; plain globals for `src/client/`.
- Tests use `node:test` + `node:assert/strict`. Server/sim changes must have tests; client presentation validated via `node --check`.
- Keep the existing snapshot field names; only ADD fields.
- World size 4000. Tick 30 Hz.
- Frequent commits (one per task).

## Snapshot additions (contract for this phase)
- `snake.toState()` gains `boosting` (already present).
- `GameRoom.snapshot()` gains `events: [{type:'kill', name, by}]` — recent kill events this tick, for the kill feed. Empty array most ticks.
- Server `state` message already spreads the snapshot, so `events` rides along automatically.

---

## Task 1: Safe spawns (no instant death)

**Files:** Modify `server/GameRoom.js`. Test `test/spawn.test.js`.

**Problem:** `spawnPoint()` picks a fully random point, so a new player/bot can appear on top of another snake and die instantly.

**Interfaces:** Add `findSafeSpawn(snakes)` — tries up to 30 random points in `[300, WORLD-300]`, returns the one whose nearest existing living snake head is farthest away (and always ≥ 250 units if achievable). Used by `_spawnBot` and `addPlayer`.

- [ ] **Step 1: Failing test** — `test/spawn.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { GameRoom } = require('../server/GameRoom.js');

test('a newly added player spawns away from existing snakes', () => {
  const room = new GameRoom('ABCDE', { numBots: 6 });
  const p = room.addPlayer('p1', 'You', '#00ff88');
  let nearest = Infinity;
  for (const s of room.snakes.values()) {
    if (s === p || s.isDead) continue;
    nearest = Math.min(nearest, p.head.distance(s.head));
  }
  assert.ok(nearest >= 150, `nearest snake ${nearest} should be comfortably far`);
});
```

- [ ] **Step 2: Run — expect FAIL** (`spawnPoint` random can be close; test is probabilistic — if it flukes-passes, note it and proceed to implement anyway).
Run: `node --test test/spawn.test.js`

- [ ] **Step 3: Implement** — in `server/GameRoom.js`, replace the module-level `spawnPoint()` usage. Add a method:
```js
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
```
Then in `_spawnBot` and `addPlayer`, replace `const { x, y } = spawnPoint();` with `const { x, y } = this._findSafeSpawn();`. Leave the old `spawnPoint` function in place or remove it if now unused (remove it to avoid dead code).

- [ ] **Step 4: Run — expect PASS**. Run: `node --test test/spawn.test.js`
- [ ] **Step 5: Full suite** `npm test` — all pass.
- [ ] **Step 6: Commit** `git commit -am "feat: safe spawns so snakes don't die on appearance"`

---

## Task 2: Boost costs mass + drops trail particles

**Files:** Modify `src/shared/constants.js`, `server/GameRoom.js`. Test `test/boost.test.js`.

**Problem:** Boost is free and infinite. Real .io boost drains mass and drops food, making it a tactical tradeoff.

**Interfaces:** Add constants `BOOST_DRAIN` (mass/sec, e.g. 22) and `BOOST_MIN_MASS` (e.g. 15). In `GameRoom.step`, after applying input but before/around integration: for each living snake, if it is boosting AND `mass > BOOST_MIN_MASS`, subtract `BOOST_DRAIN*dt` from mass and, every ~3 ticks, drop one `Particle` behind the tail. If `mass <= BOOST_MIN_MASS`, force `setBoost(false)` (too small to boost).

- [ ] **Step 1: Failing test** — `test/boost.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { GameRoom } = require('../server/GameRoom.js');

test('a boosting snake loses mass over time', () => {
  const room = new GameRoom('ABCDE', { numBots: 0 });
  const p = room.addPlayer('p1', 'You', '#00ff88');
  p.mass = 100;
  for (let i = 0; i < 60; i++) { room.setInput('p1', 3000, 2000, true); room.step(1 / 30); }
  assert.ok(p.mass < 100, `boosting mass ${p.mass} should drop below 100`);
});

test('a non-boosting snake does not lose mass to boost', () => {
  const room = new GameRoom('ABCDE', { numBots: 0 });
  const p = room.addPlayer('p1', 'You', '#00ff88');
  p.mass = 100;
  for (let i = 0; i < 60; i++) { room.setInput('p1', 3000, 2000, false); room.step(1 / 30); }
  assert.ok(p.mass >= 100, `idle mass ${p.mass} should not drop`);
});

test('a tiny snake cannot boost', () => {
  const room = new GameRoom('ABCDE', { numBots: 0 });
  const p = room.addPlayer('p1', 'You', '#00ff88');
  p.mass = 12;
  room.setInput('p1', 3000, 2000, true);
  room.step(1 / 30);
  assert.equal(p.isBoosting, false);
});
```

- [ ] **Step 2: Run — expect FAIL.** `node --test test/boost.test.js`
- [ ] **Step 3: Implement.** In `constants.js` add `BOOST_DRAIN: 22,` and `BOOST_MIN_MASS: 15,`. In `GameRoom.step`, inside the loop that applies input + `s.step(dt)`, after setting boost from input, add boost economy. Concretely, in the per-snake apply loop replace the human branch boost handling and add for all snakes after `s.setAim/…` and before `s.step(dt)`:
```js
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
```
(Bots pass boost=false via AI today, so this mainly affects players; that's fine.)

- [ ] **Step 4: Run — expect PASS.** `node --test test/boost.test.js`
- [ ] **Step 5: Full suite** `npm test`.
- [ ] **Step 6: Commit** `git commit -am "feat: boost drains mass and drops trail particles; tiny snakes can't boost"`

---

## Task 3: Smarter AI bots

**Files:** Rewrite `src/shared/ai.js`. Update `test/ai.test.js` (keep existing tests passing; add new ones).

**Problem:** Bots are weak — narrow threat range, no target leading, no proactive wall avoidance, all same skill.

**Interfaces:** Keep `computeAiAim(bot, particles, allSnakes, dt)` → `{x,y}`. Improvements:
- Wider threat detection (350) with flee.
- Proactive wall avoidance: if head within 250 of any wall, steer toward center (highest priority after self-body).
- Interception when hunting: aim ahead of prey using prey heading (`prey.currentAngle`) and distance.
- Bots can now choose to boost when chasing close prey or fleeing — return `{x, y, boost}` (boost optional; GameRoom uses it).
- Per-bot `skill` in [0.6, 1.0] set once (store `bot.skill` if undefined) scaling detection ranges.

- [ ] **Step 1: Add/adjust tests** in `test/ai.test.js` (keep the 3 existing). Add:
```js
test('bot steers toward center when hugging a wall', () => {
  const b = new Snake({ id: 'bot', x: 120, y: 2000, name: 'B', isBot: true });
  b.aiChangeTargetTimer = 999;
  const aim = computeAiAim(b, [], [b], 1 / 30);
  assert.ok(aim.x > 120, 'should steer inward (+x) away from left wall');
});

test('bot leads a moving prey (aims ahead of it)', () => {
  const b = new Snake({ id: 'bot', x: 2000, y: 2000, name: 'B', isBot: true }); b.mass = 300;
  b.aiChangeTargetTimer = 999;
  const prey = new Snake({ id: 'prey', x: 2300, y: 2000, name: 'P', isBot: true }); prey.mass = 50;
  prey.currentAngle = 0; // moving +x
  const aim = computeAiAim(b, [], [b, prey], 1 / 30);
  assert.ok(aim.x >= 2300, 'aim should be at or ahead of prey along its heading');
});
```
Note: `computeAiAim` still returns an object with `.x`/`.y` (now possibly `.boost`); existing tests read `.x`/`.y` so they keep working.

- [ ] **Step 2: Run — expect FAIL** on the two new tests. `node --test test/ai.test.js`
- [ ] **Step 3: Rewrite `src/shared/ai.js`** keeping the UMD guard and dependency resolution. Full replacement:
```js
(function (root) {
  const V = (typeof module !== 'undefined' && module.exports) ? require('./vector2.js') : root;
  const R = (typeof module !== 'undefined' && module.exports) ? require('./random.js') : root;
  const C = (typeof module !== 'undefined' && module.exports) ? require('./constants.js') : root;
  const Vector2 = V.Vector2;
  const randomRange = R.randomRange;
  const CONSTANTS = C.CONSTANTS;

  function pickTarget(bot, particles, others) {
    const head = bot.head;
    const skill = bot.skill;
    const W = CONSTANTS.WORLD_SIZE;

    // 1. Avoid own body.
    const safe = bot.radius * 4;
    for (let i = 15; i < bot.body.length; i++) {
      const seg = bot.body[i];
      if (head.distance(seg) < safe * 2) {
        const ang = Math.atan2(head.y - seg.y, head.x - seg.x);
        return { x: head.x + Math.cos(ang) * 400, y: head.y + Math.sin(ang) * 400 };
      }
    }

    // 2. Proactive wall avoidance.
    const wallMargin = 250;
    if (head.x < wallMargin || head.x > W - wallMargin || head.y < wallMargin || head.y > W - wallMargin) {
      return { x: W / 2, y: W / 2 };
    }

    // 3. Flee bigger snakes within a skill-scaled range.
    const fleeRange = 250 + 150 * skill;
    for (const s of others) {
      if (s === bot || s.isDead) continue;
      if (s.mass > bot.mass * 1.15 && head.distance(s.head) < fleeRange) {
        const ang = Math.atan2(head.y - s.head.y, head.x - s.head.x);
        return { x: head.x + Math.cos(ang) * 350, y: head.y + Math.sin(ang) * 350, boost: head.distance(s.head) < fleeRange * 0.5 };
      }
    }

    // 4. Hunt smaller snakes; lead the target.
    const huntRange = 300 + 250 * skill;
    let prey = null, preyDist = Infinity;
    for (const s of others) {
      if (s === bot || s.isDead) continue;
      if (s.mass < bot.mass * 0.75) {
        const d = head.distance(s.head);
        if (d < huntRange && d < preyDist) { prey = s; preyDist = d; }
      }
    }
    if (prey) {
      const lead = Math.min(preyDist, 300) * skill;
      const px = prey.head.x + Math.cos(prey.currentAngle) * lead;
      const py = prey.head.y + Math.sin(prey.currentAngle) * lead;
      return { x: px, y: py, boost: preyDist < huntRange * 0.4 };
    }

    // 5. Nearest food.
    const foodRange = 600 + 200 * skill;
    let food = null, foodDist = Infinity;
    for (const p of particles) {
      const d = head.distance(p.position);
      if (d < foodRange && d < foodDist) { foodDist = d; food = p; }
    }
    if (food) return { x: food.position.x, y: food.position.y };

    // 6. Wander near center.
    const c = W / 2;
    return { x: randomRange(c - 600, c + 600), y: randomRange(c - 600, c + 600) };
  }

  function computeAiAim(bot, particles, allSnakes, dt) {
    if (bot.skill === undefined) bot.skill = 0.6 + Math.random() * 0.4;
    bot.aiChangeTargetTimer += dt;
    if (!bot.targetPosition || bot.aiChangeTargetTimer > bot.aiChangeTargetInterval * (1.5 - bot.skill)) {
      bot.aiChangeTargetTimer = 0;
      const t = pickTarget(bot, particles, allSnakes);
      bot.targetPosition = new Vector2(t.x, t.y);
      bot._wantBoost = !!t.boost;
    }
    return { x: bot.targetPosition.x, y: bot.targetPosition.y, boost: !!bot._wantBoost };
  }

  const api = { computeAiAim };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 4: Wire bot boost in `GameRoom.step`.** Where bots get their aim:
```js
        const aim = computeAiAim(s, this.particles, all, dt);
        s.setAim(aim.x, aim.y);
        s.setBoost(!!aim.boost && s.mass > CONSTANTS.BOOST_MIN_MASS);
```
(This makes bots occasionally boost to hunt/flee; boost economy from Task 2 applies to them too.)

- [ ] **Step 5: Run — expect PASS** (all AI tests + full suite). `npm test`
- [ ] **Step 6: Commit** `git commit -am "feat: smarter AI — wall avoidance, target leading, fleeing, boost, skill tiers"`

---

## Task 4: Broadcast kill events (for the kill feed)

**Files:** Modify `server/GameRoom.js` (snapshot includes `events`). Test extend `test/gameroom.test.js`.

**Interfaces:** `GameRoom` accumulates kill events produced by `step()` into `this._recentEvents` and includes them in the NEXT `snapshot()` as `events: [{type:'kill', name, by}]`, then clears. `name` = the dead snake's display name (look it up before it's removed), `by` = killer name or 'wall'.

- [ ] **Step 1: Failing test** in `test/gameroom.test.js` (add):
```js
test('snapshot exposes an events array', () => {
  const room = new GameRoom('ABCDE', { numBots: 2 });
  assert.ok(Array.isArray(room.snapshot().events));
});
```

- [ ] **Step 2: Run — expect FAIL.** `node --test test/gameroom.test.js`
- [ ] **Step 3: Implement.** In `GameRoom` constructor add `this._recentEvents = [];`. In `step()`, when building `kills`, also resolve the dead snake's name and push `{type:'kill', name, by}` into `this._recentEvents` for each kill (resolve name from the snake before any removal — you have the snake objects during the death/collision phase; simplest: after computing `kills`, map each `deadId` to its snake's `name` via `this.snakes.get(deadId)` which still exists this tick). In `snapshot()`, add `events: this._recentEvents` to the returned object, then set `this._recentEvents = []` AFTER building the snapshot object (so events are delivered exactly once).

- [ ] **Step 4: Run — expect PASS**; full suite `npm test`.
- [ ] **Step 5: Commit** `git commit -am "feat: broadcast kill events in snapshots for kill feed"`

---

## Task 5: Client — smooth camera + boost visuals

**Files:** Modify `src/client/renderer.js`.

**Interfaces:** Camera lerps toward the followed head instead of hard-snapping (restores the old smooth feel). Boosting snakes get a brighter/pulsing glow and a subtle speed trail. No API change.

- [ ] **Step 1: Implement.** In `Renderer`:
  - Add `this.camSmooth = 0.15;` in the constructor.
  - In `render()`, where the camera currently sets `this.cam.x/y` directly to `head - screen/2`, instead compute the target and lerp: `this.cam.x += (targetX - this.cam.x) * this.camSmooth;` (same for y). On the FIRST frame (cam at 0,0) snap directly to avoid a slide-in from the origin — guard with `if (this.cam.x === 0 && this.cam.y === 0) { this.cam.x = targetX; this.cam.y = targetY; }` before the lerp.
  - In `_drawSnake`, when `s.boosting`, increase the glow radius multiplier (e.g. `radius * 2.4` instead of `radius * 2`) and add a faint white core on the head segment. Keep it subtle.
- [ ] **Step 2: Syntax check** `node --check src/client/renderer.js`.
- [ ] **Step 3: Commit** `git commit -am "feat: smooth camera follow and boost glow"`

---

## Task 6: Client — sound effects + kill feed

**Files:** Create `src/client/audio.js`; modify `index.html` (add `<script>` + kill-feed container), `src/client/main.js`.

**Interfaces:**
- `src/client/audio.js`: browser-global `SoundFX` with `eat()`, `death()`, `boost()` using WebAudio oscillators (port the old `createSound` tones: eat 440/0.1, death 220/0.3, boost 600/0.05). Lazily create the AudioContext on first user gesture (Create/Join click) to satisfy autoplay policy; expose `SoundFX.resume()`.
- `main.js`: instantiate `SoundFX`; call `resume()` in the Create/Join handlers. In the render/HUD update, detect the local snake's mass increased since last snapshot → `eat()`. On `onDead` → `death()`. Track boost edge (input.boost transitions false→true) → `boost()`.
- Kill feed: a `#killFeed` div (top-right under leaderboard). Each `state` message's `events` (kills) appends a line `"<name> was eaten by <by>"` (or `"<name> hit the wall"` when by==='wall'); keep only the last ~5, fade out old entries after a few seconds (simple: cap to 5 and remove oldest).

- [ ] **Step 1: Create `src/client/audio.js`:**
```js
class SoundFX {
  constructor() { this.ctx = null; }
  resume() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  _tone(freq, dur) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
      osc.start(); osc.stop(this.ctx.currentTime + dur);
    } catch {}
  }
  eat() { this._tone(440, 0.1); }
  death() { this._tone(220, 0.3); }
  boost() { this._tone(600, 0.05); }
}
```
- [ ] **Step 2: `index.html`** — add `<script src="src/client/audio.js"></script>` before `main.js`; add a `#killFeed` container near the leaderboard (top-right), styled unobtrusively.
- [ ] **Step 3: `main.js`** — wire `SoundFX` (resume on Create/Join), eat detection (compare `me.mass` to a stored `lastMass`), death on `onDead`, boost on input edge; render kill feed from `last.events`.
- [ ] **Step 4: Syntax check** all changed JS with `node --check`.
- [ ] **Step 5: Commit** `git commit -am "feat: sound effects and kill feed"`

---

## Task 7: Client — minimap

**Files:** Modify `src/client/renderer.js`.

**Interfaces:** Draw a small minimap (e.g. 150×150) in the bottom-right showing the 4000×4000 world: all snakes as dots (your snake highlighted white/larger, others in their color), and the world bounds. Called at the end of `render()`.

- [ ] **Step 1: Implement** a `_drawMinimap(snakes, me)` method and call it at the end of `render()`. Map world→minimap by scale `mapSize / WORLD`. Draw a translucent panel, border, each snake head as a dot, `me` larger/white.
- [ ] **Step 2: Syntax check** `node --check src/client/renderer.js`.
- [ ] **Step 3: Commit** `git commit -am "feat: minimap overlay"`

---

## Task 8: Robustness — empty-room timeout cleanup

**Files:** Modify `server/GameRoom.js`, `server/LobbyManager.js`, `server.js`. Test extend `test/lobbymanager.test.js`.

**Interfaces:** A room with zero LIVE humans for > 30 s is collected even if dead human snakes linger. Simplest: `GameRoom` tracks `liveHumanCount()` (non-bot, non-dead). `LobbyManager.gcEmptyRooms()` collects a room when `liveHumanCount()===0` AND it has been that way for a grace period. Implement via a per-room `emptySince` timestamp updated each tick in `server.js` (or a tick counter in GameRoom). To stay deterministic/testable without wall-clock, use a tick counter: `GameRoom` increments `emptyTicks` each `step()` when `liveHumanCount()===0`, else resets to 0. `gcEmptyRooms()` collects rooms whose `emptyTicks > TICK_RATE*30` (30 s) OR `humanCount()===0` (no connections at all — immediate).

- [ ] **Step 1: Failing test** in `test/lobbymanager.test.js`:
```js
test('room with only a dead human is collected after the grace period', () => {
  const lm = new LobbyManager();
  const { code, room } = lm.createRoom({ numBots: 0 });
  const p = room.addPlayer('p1', 'You', '#00ff88');
  p.isDead = true;
  // Simulate grace period of empty (dead-only) ticks
  for (let i = 0; i < 30 * 30 + 5; i++) room.step(1 / 30);
  lm.gcEmptyRooms();
  assert.equal(lm.getRoom(code), null);
});
```

- [ ] **Step 2: Run — expect FAIL.** `node --test test/lobbymanager.test.js`
- [ ] **Step 3: Implement.**
  - `GameRoom`: add `liveHumanCount()` (`!isBot && !isDead`), `this.emptyTicks = 0`, and at the end of `step()` do `this.emptyTicks = this.liveHumanCount() === 0 ? this.emptyTicks + 1 : 0;`.
  - `LobbyManager.gcEmptyRooms()`: collect when `room.humanCount() === 0` (no connections) OR `room.emptyTicks > CONSTANTS.TICK_RATE * 30`. Require `const { CONSTANTS } = require('../src/shared/constants.js');` in LobbyManager.
- [ ] **Step 4: Run — expect PASS**; full suite `npm test`.
- [ ] **Step 5: Commit** `git commit -am "fix: collect rooms left with only dead humans after a grace period"`

---

## Self-review
- Covers: smarter AI (T3), boost-with-cost (T2), safe spawns (T1), camera smoothing (T5), sound + kill feed (T4+T6), minimap (T7), room-leak fix (T8).
- Snapshot additions are backward-compatible (`events`), consumed by the client kill feed.
- Server/sim tasks (T1–T4, T8) are unit-tested; client presentation (T5–T7) validated by syntax check + the manual/headless smoke test.
