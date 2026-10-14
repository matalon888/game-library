# Rail Tangle

Rotate the tracks, route every train to its station. A compact train-path puzzle that runs entirely in the browser.

## One-sentence value proposition

Rail Tangle is a JavaScript train-routing puzzle where you click (or right-click) to rotate rail tiles until every departing train follows a complete, connected track to its destination station.

## Problem it solves

Puzzle games usually need an engine, assets, and a backend. Rail Tangle shows a genuinely playable, testable puzzle built from a small deterministic engine (~200 lines) with a solver, a route verifier, an animated win sequence, six hand-crafted levels, and procedural boards — all served as a few static files.

## Key features

- 6 hand-crafted levels with par move counts
- Procedural level generator (seeded and reproducible)
- Route engine that verifies connected train paths, detects dead ends and loops
- Canvas rendering with solved-route highlighting and a train animation on win
- Right-click / Ctrl+click rotates counter-clockwise
- Node.js test suite covering the full engine

## Screenshot / representative output

The game renders on an HTML5 canvas. Headless runs produce reproducible artifacts instead:

```
Rail Tangle - validation report
Level 1 'First Track' routes=1 solvable=yes moves-par=1
...
seed 8 routes=2 solvable=yes
```

See `results/validation-report.txt` and `results/solution-walkthrough.txt`.

## Architecture summary

Three layers: a pure logic engine (`src/engine.js`), a level builder (`src/levels.js`), and a thin canvas UI (`src/ui.js`, `src/main.js`) bundled with esbuild.

- `engine.js` — tiles, rotations, route following, board solving, procedural generation
- `levels.js` — hand-authored level definitions and a builder that guarantees a solution
- `ui.js` / `main.js` — rendering, input, HUD, level picker

## Requirements

- Node.js 18+ to run tests and build
- Any modern browser to play (no build required to play if `dist/game.js` is present; run `npm run build` if you modify the source)

## Installation

```shell
git clone https://github.com/Wsh7Ash/rail-tangle.git
cd rail-tangle
npm install
```

## Quick start

```shell
npm run build   # bundle dist/game.js from src/
npm test        # run the engine test suite
```

Then open `index.html` in a browser, or serve the folder:

```shell
npx serve .
```

## Usage examples

Play: click a tile to rotate clockwise; right-click (or Ctrl+click) to rotate counter-clockwise. Each station is marked `S`. A route is solved when a train can travel unbroken from its station to the adjacent goal station.

- Restart resets the current level.
- Random Board generates a fresh, guaranteed-solvable puzzle.
- Level picker jumps to any of the 6 hand-crafted levels.

Generate validation artifacts:

```shell
node scripts/generate-results.js
```

## Configuration

No runtime configuration needed. New levels are plain objects in `src/levels.js`; see `docs/ARCHITECTURE.md` for the level format.

## Testing

```shell
npm test
```

Tests cover direction rotation, tile connections, route following (success, dead ends, off-board exits, loops), board solving, all six hand-crafted levels (start scrambled, solvable after rotating the scramble back), and the procedural generator across 25 seeds.

## Project structure

```text
rail-tangle/
├─ index.html
├─ style.css
├─ src/
│  ├─ engine.js
│  ├─ levels.js
│  ├─ ui.js
│  └─ main.js
├─ test/
│  └─ engine.test.js
├─ scripts/
│  └─ generate-results.js
├─ results/
│  ├─ validation-report.txt
│  ├─ solution-walkthrough.txt
│  └─ generated-level-seed-1.json
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ USAGE.md
│  └─ PROJECT_SPEC.md
└─ dist/game.js
```

## Limitations

- Canvas rendering; no touch-swipe gestures for rotate direction (tap rotates clockwise).
- No audio.
- The procedural generator targets small boards (up to about 8x8); very large boards may produce sparse puzzles.

## Roadmap

- Add touch input with a rotate-direction button.
- Add solvability-aware level picker showing best par.
- Add a daily puzzle seed with shareable link.

## Security notes

Rail Tangle is a static browser puzzle. It makes no network requests, collects no data, and includes no third-party runtime dependencies at play time.

## License

MIT. See `LICENSE`.