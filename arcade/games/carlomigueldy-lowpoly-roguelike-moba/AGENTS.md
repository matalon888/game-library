# AGENTS.md

## Project mission

Continue this browser-based 3D low-poly roguelike MOBA prototype into a playable, maintainable HTML5 game. Preserve the lightweight static app unless a task explicitly requires a build system.

## Required workflow

1. Read this file and the relevant docs in `docs/` before editing.
2. Inspect nearby code before changing it; follow the existing style.
3. Keep files focused and avoid broad rewrites unless documented in a plan.
4. Do not add comments unless the user asks for comments.
5. Do not introduce secrets, analytics keys, or server credentials.
6. Run verification before claiming completion:

```bash
npm run check
npm run harness
```

If browser behavior changes, also run:

```bash
npm run dev
```

Then open `http://localhost:5173` and smoke-test solo play.

## Architecture notes

- `src/game.js` owns scene creation, gameplay simulation, waves, combat, and render loop.
- `src/hero.js` owns procedural low-poly rigs and animation clips.
- `src/net.js` owns P2P room codes, invites, and PeerJS data-channel messaging.
- `src/ui.js` owns DOM updates for HUD, logs, upgrades, and game over.
- `src/main.js` wires boot, menus, networking, and game startup.

## Current constraints

- Use Three.js via import maps in `index.html`.
- Keep the game runnable as a static site.
- Prefer no new runtime dependencies unless they materially simplify the feature.
- WebGPU must gracefully fall back to WebGL.
- Multiplayer is P2P only; do not add a central authoritative game server unless requested.

## Suggested development loop

1. Pick one item from `docs/roadmap.md`.
2. Add or update docs if the feature changes architecture or controls.
3. Implement the smallest playable slice.
4. Run `npm run check` and `npm run harness`.
5. Manually test in browser.
6. Commit with a concise message if the user asks for a commit.

## Known follow-ups

- Split `src/game.js` into focused modules once gameplay grows.
- Improve multiplayer authority/reconciliation.
- Add deterministic wave seeds for easier debugging.
- Add automated browser smoke tests if Playwright/Puppeteer becomes part of the repo.
