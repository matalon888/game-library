# Time Echo — Project Memory

This file is loaded as context at the start of each Claude Code session. It documents the architecture, critical invariants, design decisions, and conventions of the Time Echo project.

---

## Project Summary

Time Echo is a turn-based browser puzzle game. The defining mechanic is the echo: pressing `R` records the current run as a deterministic replay; the player respawns at the start while the echo repeats its moves on subsequent runs. Levels are solved by coordinating one or more echoes with the live player.

Implementation: HTML and vanilla JavaScript. No build tools, no bundler, no ES modules. Files load via `<script>` tags from `index.html`.

## Working Directory

```
C:\Users\Event Horizon\Desktop\Game Project\None
```

Open `index.html` in a browser. No installation step.

## Architecture

```
index.html
├── version.js   — VERSION constant and history
├── i18n.js      — I18n module (TR/EN dictionary)
├── audio.js     — Audio (Web Audio sound effects)
├── music.js     — Music (chiptune step sequencer; playSting)
├── story.js     — STORY (intro, tutorial, fragments, outro)
├── generator.js — Generator (procedural level generator, currently inactive)
├── levels.js    — LEVELS (23 hand-crafted, direct array)
├── editor.js    — Editor (level editor, URL share, gallery)
├── webgl.js     — WebGLFX (post-processing shader pipeline)
├── sprite.js    — Sprite (PNG character animation engine)
├── effects.js   — Effects (PNG effect playback: portal, sparks, smoke)
├── bark.js      — Bark (character thought-bubble lines)
└── game.js      — Screens, Save, Game (main engine)
```

Load order matters. `game.js` depends on all preceding modules and must load last. `sprite.js` and `webgl.js` precede `game.js`. `generator.js` is loaded but currently unused at runtime.

## Critical Concepts

### Echo Engine

- Each echo is a list of moves: `[{dx, dy}, ...]`.
- Pressing `R` pushes `currentMoves` into `echoes[]` and calls `resetRun()`.
- During replay each echo attempts `echoes[i].moves[turn]` on every tick.
- A blocked echo stays in place but still consumes the move (replay remains deterministic).

### Tick Order (`tick()` in game.js)

1. Pre-snapshot. Door state for this tick is computed from this snapshot.
2. Movement. Player and echoes move simultaneously against the pre-snapshot.
3. Portal teleport. Entities standing on portal cells move to their pair.
4. Post-snapshot.
5. Beam computation. Each emitter casts a beam until a wall or closed door.
6. Damage. Entities in beam cells are killed.
7. Goal check.

### Cell Types

```
. # P G Q B X a-z A-Z 1-9 ^ v < >
```

- `a-z` plates pair with `A-Z` doors of the same letter.
- `1-9` portals pair by digit; each digit must occur exactly twice per level.
- `X` sentry patrols and is lethal on contact.
- `^v<>` are laser emitters and are impassable.

### Level Attributes (outside the grid)

- `lasers: [{ x, y, plate }]` — binds an emitter to a plate. Emitter is silenced while the plate is active.
- `fragile: ['a']` — listed plates latch their paired door open permanently after a single press.
- `patrols: [{ x, y, dx, dy }]` — override the initial direction of a sentry; default is detected at parse time.

### Lasers

- Emitters `^v<>` are always on by default.
- A laser bound to a plate is silenced while the plate is active.
- Beams stop at walls, closed doors, and map edges. Entities are killed by beam contact; they do not block the beam.

## Code Locations

- Echo engine: `tick()` and `recordEcho()` in `game.js`.
- Beam computation: `computeBeamsFromEntities()` in `game.js`.
- Level parsing: `parseLevel()` in `game.js`.
- URL share codec: `encodeLevel()` and `decodeLevel()` in `editor.js`.
- localStorage key: `timeEcho.progress.v2`.

## Versioning

- Single source of truth: `VERSION` object in `version.js`.
- Every release adds a block to `CHANGELOG.md`.
- Semantic versioning: `MAJOR.MINOR.PATCH`.
- `VERSION.history[].changes` is bilingual: `{ tr: [...], en: [...] }`.
- Current main: `1.15.6`.

## Smoke Test

Manual browser test:

1. Open `index.html`; main menu loads.
2. Toggle TR / EN; all strings change.
3. Open the tutorial; advance through the four pages.
4. Start a new run; the intro then tutorial then level 1 loads.
5. Level 1 solution: take a move, press `R` (toast indicates echo recorded), echo walks onto the plate, door opens, player reaches the goal.
6. Level 4 (Köprü): portal teleport works.
7. Level 5 (Işın): laser kills on contact; plate disables the emitter; death triggers camera shake and spark.
8. Level select: 23 cards, single page; "Devam Et" jumps to the highest unlocked level.
9. Editor: build a small level, test, share, open the share URL in a new tab.
10. Mobile layout: viewport below 500px shows the D-pad, R/Z/N buttons, and swipe input.
11. Music: first click on the title screen starts the title track; gameplay switches to procedural chiptune.

Node syntax check:

```bash
for f in *.js; do node --check "$f" && echo "$f: OK"; done
```

Audit script:

```bash
node _audit_hand.js
```

## Design Conventions

- UI language is Turkish; English is the secondary translation. Technical identifiers stay in English.
- Visual style: dark background, blue and purple neon, monospace typography, CRT scanline.
- Sound: procedural synthesis only; the title track is the single external asset.
- No build step. ES modules are not used.
- Single directory. All source files at the project root.
- Code comments are minimal. Comments explain *why*, never *what*.

## Known Design Decisions

- Blocked echoes consume their move; this keeps replays deterministic.
- Multiple entities may occupy the same cell. Only walls, closed doors, and emitters block movement.
- Plate state is evaluated against the pre-snapshot of each tick to avoid mid-tick race conditions.
- Beam damage is evaluated against the post-snapshot so that teleported entities are treated correctly.

## Active Branches

- `main` — production, currently at `1.12.0`. Hosting deploys this branch.

## Synchronization Protocol

Every feature, fix, or design change updates the following files in a single commit:

1. `version.js` — new entry prepended to `VERSION.history`.
2. `CHANGELOG.md` — Keep-a-Changelog entry.
3. `i18n.js` — translation keys for any new UI strings.
4. `CLAUDE.md` — architecture, branch state, or convention changes.
5. `README.md` — public-facing changes.

Version bump policy:

- Stable releases on `main` follow `MAJOR.MINOR.PATCH`.
- Experimental branches append `-experimental.N` (for example, `1.7.0-experimental.3`).

## Roadmap

### Polish

- Asset preloading screen so the character fallback disc is not visible during the first frames while PNG sheets are still decoding.
- Echo characters emit their own short bark lines, distinct from the player pool, with stricter cooldown so the screen does not crowd.
- Win overlay celebration: layered star burst, animated time-bonus, and a path-tracing replay preview alongside the existing fanfare.
- Settings panel: volume slider, language toggle, accessibility options (reduce-motion, high-contrast palette) in a dedicated screen rather than scattered HUD buttons.
- Sentry direction indicator on the tile when paused or in the editor preview.
- Laser beam rendering upgrade: pulse, glow, and end-cap effects driven by `Music.getEnergy()` like the title screen.
- Editor palette additions: quantum tile, fragile plate, sentry with direction handle, multi-plate-binding laser declaration UI.

### New features

- Online leaderboard with a minimal API (level index, stars, time, echo count, anonymous handle).
- Per-level difficulty rating computed from an AI solver's optimal-echo, optimal-move solution.
- Additional hand-crafted levels exploring quantum-plus-crate and sentry-plus-portal compositions.
- Sound effects for crate push, quantum flip, and star award.
- Daily challenge: a single deterministically seeded grid available per day with a shared leaderboard.

## Communication Style

- UI language is Turkish; technical conversations may mix Turkish and English.
- Auto mode: proceed without confirmation for routine tasks; pause for destructive or irreversible operations.
- Plan-mode responses are detailed; execution-mode responses are concise.
- Source identifiers remain in English; user-facing strings are localized via `i18n.js`.

## Skill and Tooling Notes

- The development environment is Claude Code CLI.
- Installed skills:
  - `game-engine` — HTML5 Canvas and WebGL reference.
  - `find-skills` — skill discovery.
- Frameworks (PixiJS, Phaser, Three.js, etc.) are out of scope. Decline framework suggestions.

## Session Quickstart

```powershell
cd "C:\Users\Event Horizon\Desktop\Game Project\None"
claude
```

Useful commands when returning to an active branch:

```bash
git status
git log --oneline -5
git branch -a
```
