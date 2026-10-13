# Snakes IO — Multiplayer Core (Phase 1) Design

**Date:** 2026-06-30
**Status:** Approved
**Author:** Darius + Claude

## Summary

Convert the Snakes IO game from a fully client-side single-player game into a
**server-authoritative real-time multiplayer game** playable by multiple people
on the same WiFi network. Players join games via short **room codes**. The Node
server runs the authoritative simulation; browsers send inputs and render the
state the server broadcasts, using interpolation for smooth movement.

This phase is the foundation. It also inherently fixes a class of existing
glitches (unfair collisions, movement jank, performance) by making the server
the single source of truth.

## Goals

- Two or more players on the same WiFi can play together in real time.
- Lobby system with room codes: one player creates a lobby and gets a code; others join with it.
- AI bots fill the world, running server-side (smarter behavior is tuned in Phase 2).
- Fix the root cause of "collisions feel wrong" (authoritative collision detection).
- Fix movement jank via client-side interpolation between server snapshots.
- Improve performance by centralizing simulation on the server.
- No cloud/internet required — the host Mac runs the Node server; players connect over LAN.

## Non-Goals (deferred to Phase 2 or later)

- Smarter AI behavior tuning (foundation only in Phase 1).
- Visual & audio polish (skins, name tags, kill feed, music/SFX).
- Mid-game reconnect / state recovery.
- Cloud/internet deployment (LAN only for now).
- Spectator mode, accounts, persistence.

## Architecture

```
Browser (each player)            Node server (authoritative)
  - renders server state          - LobbyManager: rooms keyed by code
  - sends inputs      ──WS──►      - GameRoom per lobby:
  - interpolates      ◄─WS──         - fixed 30Hz simulation tick
    between snapshots                - snakes, bots, particles, collisions
                                     - broadcasts state snapshots ~20-30/s
```

The server owns all game state. Clients are thin: they capture input, send it,
and render the latest authoritative snapshot with interpolation. No game logic
(movement, collision, eating, AI) runs in the browser anymore.

## Components

Each module has one clear purpose and a well-defined interface.

### Shared simulation — `src/shared/` (browser-free, Node-runnable)
The current simulation logic is extracted out of canvas/DOM-coupled code so it
runs in Node and is unit-testable.
- `vector2.js` — `Vector2` math (already pure; move here).
- `snake.js` — snake state + movement/eating/growth. **No drawing code.**
- `particle.js` — particle state + update. **No drawing code.**
- `ai.js` — bot decision logic (target selection, avoidance) producing an aim vector.
- `collisions.js` — authoritative collision rules (snake-particle, head-to-head, head-to-body, boundary).
- `constants.js` — world size, tick rate, speeds, masses, particle counts.

**Dependency note:** rendering (canvas, glow, grid, joystick drawing) stays in
the client and is rewritten to draw from plain state objects, not `Snake`
instances with methods.

### Server — `server/`
- `index.js` — Express static file server + `ws` WebSocket server; routes messages to `LobbyManager`.
- `LobbyManager.js` — create room (generate unique code), join room by code, remove player, destroy empty rooms.
- `GameRoom.js` — one authoritative game instance: holds snakes + particles, runs the fixed-tick loop, applies queued inputs, runs AI + collisions via `src/shared`, builds and broadcasts snapshots.

### Client — `src/client/`
- `net.js` — opens WS, sends `join`/`input`/`leave`, receives and buffers snapshots.
- `renderer.js` — draws the latest snapshot with interpolation; owns camera, grid, particles, snakes, joystick, boost flash.
- `input.js` — mouse/keyboard/joystick capture → aim vector + boost flag, sent via `net.js`.
- `main.js` — wires lobby UI → net → renderer; manages menu/lobby/in-game/game-over screens.

### UI — `index.html`
- Menu: name entry, color picker, control method (existing).
- **Create Lobby** button → shows generated room code to share.
- **Join Lobby**: text field for a room code → join.
- In-game HUD (score, leaderboard) reused, fed from server snapshots.

## Network Protocol (JSON over WebSocket)

**Client → Server**
- `{type:"create", name, color}` — create a new lobby.
- `{type:"join", code, name, color}` — join an existing lobby.
- `{type:"input", aimX, aimY, boost}` — player intent; applied on next tick.
- `{type:"leave"}` — leave lobby.

**Server → Client**
- `{type:"created", code, playerId}` — lobby created.
- `{type:"joined", code, playerId}` — joined successfully.
- `{type:"state", tick, snakes:[{id,name,color,segments:[{x,y}],radius,mass,boosting,dead}], particles:[{x,y,r,color}], leaderboard:[{name,mass}]}` — authoritative snapshot.
- `{type:"dead", by}` — your snake died (killer name or "wall").
- `{type:"error", message}` — e.g. unknown/expired code.

**Rates:** simulation tick 30Hz; snapshot broadcast 20–30Hz. Snapshots may send
only on-screen / changed data later if bandwidth needs it (not required on LAN).

## Data Flow

1. Player picks name/color, clicks Create or Join → `net.js` sends message.
2. Server resolves the `GameRoom`, spawns the player's snake, replies `created`/`joined`.
3. Each frame, `input.js` computes aim + boost and sends `input` (throttled).
4. `GameRoom` tick: apply inputs → move snakes → run AI for bots → resolve collisions → respawn dead bots → maintain particles → build snapshot.
5. Server broadcasts `state`; `net.js` buffers the two most recent snapshots.
6. `renderer.js` interpolates positions between the two snapshots by render time → smooth motion.
7. On death, server sends `dead`; client shows game-over with option to respawn (rejoin same room).

## Error Handling

- **Unknown/expired room code:** server replies `error`; client shows a message and returns to menu.
- **Player disconnect (closed tab / WiFi drop):** server removes the snake; room is destroyed when it has no human players.
- **Reconnect:** treated as a fresh join (a new snake). No mid-game recovery in Phase 1.
- **Malformed messages:** server validates type/fields, ignores or replies `error`; never crashes the room.
- **Empty rooms:** garbage-collected so codes can be reused.

## Testing

- **Unit tests** on `src/shared/`: movement integration, eating/growth, each collision rule, AI aim output, boundary detection. Now possible because the sim is browser-free. Use Node's built-in `node:test`.
- **Integration:** a script that spins up a `GameRoom`, injects inputs for two
  fake players, and asserts state evolves correctly (collisions, scoring).
- **Manual:** two browser tabs on the host, plus the fiancé's device at
  `http://<host-lan-ip>:3000` — create lobby on one, join with code on the other,
  confirm both see each other move, eat, collide, and die fairly.

## Tech Choices

- WebSockets via the `ws` library (tiny, standard, ideal for LAN). Add as a dependency.
- Vanilla JS, no build step / framework — matches the existing project style.
- Express stays as the static file + page server; `ws` attaches to the same HTTP server.
- Electron wrapper remains for the single-machine path but is not the focus of Phase 1.

## Risks / Open Considerations

- **Refactor surface:** extracting sim from canvas-coupled `Snake`/`Particle` is
  the largest task; mitigated by keeping behavior identical and adding unit tests.
- **Interpolation tuning:** snapshot rate vs. smoothness; LAN latency is low so a
  one-snapshot interpolation delay should be ample.
- **Bandwidth with big snakes:** many segments per snapshot. Acceptable on LAN;
  can optimize (delta encoding / segment thinning) later if needed.

## Phase 2 (out of scope here, for context)

Smarter AI tuning, visual & audio polish (skins, name tags, kill feed, sounds),
mobile/touch polish, and mopping up remaining glitches.
