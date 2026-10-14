# Development Roadmap

## Phase 1: Stabilize the prototype

- Split `src/game.js` into smaller modules without changing behavior.
- Add committed browser smoke tests.
- Make `npm run check` include syntax checks and basic static asset checks.
- Fix any WebGPU/WebGL rendering differences.

## Phase 2: Improve core gameplay

- Add enemy attack telegraphs.
- Add tower or lane-like objectives inspired by MOBAs.
- Add item shop choices between waves.
- Add clearer hit feedback and floating damage numbers.
- Add minimap-style arena awareness.

## Phase 3: Deepen roguelike progression

- Add hero archetypes with different ability kits.
- Add upgrade rarity tiers and synergies.
- Add run summary stats.
- Add deterministic run seeds.
- Add unlockable starting boons.

## Phase 4: Harden multiplayer

- Make host authoritative for enemies and rewards.
- Add periodic state snapshots and interpolation.
- Add lobby ready/start/restart messages.
- Add disconnect handling.
- Add latency and connection quality HUD.

## Phase 5: Production polish

- Replace CDN import map with a reproducible build if needed.
- Add mobile-friendly controls.
- Add audio and settings.
- Add accessibility options for color and camera motion.
- Add deployment docs for GitHub Pages or another static host.

## First recommended issue

Start with a safe refactor: extract wave spawning from `src/game.js` into `src/waves.js` while preserving behavior. This improves future development without changing the player experience.
