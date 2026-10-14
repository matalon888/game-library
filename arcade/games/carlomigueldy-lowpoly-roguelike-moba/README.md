# Lowpoly Roguelike MOBA

A browser-based 3D low-poly roguelike MOBA prototype built with Three.js. It features rigged procedural characters, animation clips, DOTA-style click movement and abilities, roguelike wave progression, and WebRTC peer-to-peer co-op invites by link, room code, and QR code.

## Features

- 3D low-poly arena rendered with Three.js
- WebGPU renderer with WebGL fallback
- Procedural rigged hero and creep models
- Idle, run, attack, and cast animations
- Top-down MOBA controls: click-to-move, Q/W/E/R abilities
- Roguelike waves, elite/boss spawns, level-up boons, permadeath runs
- Browser P2P multiplayer via PeerJS/WebRTC
- Invite friends with a link, code, or QR code
- Lightweight static app with no build step

## Quick start

```bash
npm run dev
```

Open `http://localhost:5173`.

## Controls

- Move: left-click or right-click the ground
- Abilities: `Q`, `W`, `E`, `R` cast toward the cursor
- Objective: survive waves, level up, choose boons, and last-hit enemies for gold

## Multiplayer

1. Click **Host Co-op Run**.
2. Share the invite link, room code, or QR code.
3. The joining player opens the link or enters the code.
4. The host clicks **Start Run**.

The current multiplayer implementation is a lightweight P2P prototype. Host/client state sync is intentionally simple and documented in `docs/multiplayer.md` for future hardening.

## Project structure

```text
.
├── index.html          # App shell, import map, HUD/menu markup
├── package.json        # Scripts and project metadata
├── src/
│   ├── game.js         # Three.js scene, gameplay, waves, combat
│   ├── hero.js         # Low-poly rig and procedural animation clips
│   ├── main.js         # Boot/menu/network wiring
│   ├── net.js          # PeerJS room codes, invite links, QR generation
│   ├── styles.css      # HUD, menu, overlays
│   └── ui.js           # DOM/HUD/upgrade/game-over controller
├── docs/               # Continuation docs for future development
├── scripts/            # Agent harness and maintenance scripts
└── AGENTS.md           # Instructions for coding agents
```

## Verification

```bash
npm run check
npm run harness
```

`npm run check` validates JavaScript syntax. `npm run harness` prints the current project context and continuation tasks for agents.

## Roadmap

See `docs/roadmap.md` for the recommended continuation path.

## License

MIT
