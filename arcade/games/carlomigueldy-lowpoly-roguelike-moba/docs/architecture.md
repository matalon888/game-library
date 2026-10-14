# Architecture

## Runtime

The game is a static HTML5 app. `index.html` defines the import map and loads `src/main.js` as an ES module. Dependencies are loaded from CDNs.

## Rendering

`src/game.js` creates a Three.js renderer using `THREE.WebGPURenderer`. The renderer uses WebGPU when available and falls back to a WebGL backend when not available. The game uses simple mesh primitives and baked faceted geometry for the low-poly look.

## Main modules

### `src/main.js`

Bootstraps the renderer, wires menu buttons, creates `Game` and `Net` instances, and starts solo/host/join flows.

### `src/game.js`

Owns the Three.js scene, camera, arena, render loop, input handling, entities, combat, abilities, waves, upgrades, and network event handling.

This file is currently the largest module. Future work should split it gradually into focused modules such as:

- `src/world.js` for arena/lighting/props
- `src/combat.js` for damage/projectiles/abilities
- `src/waves.js` for enemy spawning and scaling
- `src/entities.js` for entity factories and shared state

### `src/hero.js`

Creates procedural low-poly rigged characters. The rig is a hierarchy of named groups such as pelvis, torso, arms, legs, and head. Animation clips target those named groups with `THREE.AnimationMixer`.

### `src/net.js`

Provides PeerJS/WebRTC networking. The host claims a human-readable room code; joiners connect to the host by code. The host relays peer messages to approximate a small mesh.

### `src/ui.js`

Owns DOM updates for HUD bars, ability cooldowns, logs, upgrade cards, network labels, and game-over overlays.

## Data flow

```text
main.js
  ├─ creates renderer
  ├─ creates Net when hosting/joining
  └─ creates Game

Game
  ├─ receives local input
  ├─ updates simulation
  ├─ sends/receives Net messages
  ├─ updates UI
  └─ renders scene
```

## Current technical debt

- `src/game.js` mixes world setup, simulation, combat, AI, and network handling.
- Multiplayer state is not authoritative enough for competitive play.
- Browser smoke testing is manual/local rather than committed to the repo.
- CDN dependencies make quick prototyping easy but reduce offline reproducibility.
