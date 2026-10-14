# Architecture

Rail Tangle keeps game logic fully isolated from rendering so the engine can
be unit-tested in Node while the UI runs in the browser.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/engine.js` | Pure logic: direction model, tile model, route following, board solving, procedural generation. No DOM. |
| `src/levels.js` | Hand-authored level definitions + `buildLevel`, which derives the correct pieces along each route so a solution is guaranteed. |
| `src/ui.js` | `RailGame` class: canvas rendering, click/right-click rotation, solved-route highlighting, win animation. |
| `src/main.js` | Browser entry: wires the canvas, HUD, buttons, and level picker; random board entry point. |
| `test/engine.test.js` | Node test runner tests for the engine and all levels. |
| `scripts/generate-results.js` | Reproducible demo artifacts into `results/`. |

## Tile model

A tile has a `base` piece id and a `rotation` (0–3 quarter turns clockwise):

- `1` straight horizontal (E–W)
- `2` straight vertical (N–S)
- `3`–`6` the four curves E/S/W/N

`connections(tile)` returns the two active directions after rotation.

## Route model

A route has a `start` station, a `goal` station, and a `startDir` (the
departure heading). `followRoute` walks cell to cell:

1. Enter a cell traveling direction `t`.
2. The cell's tile must connect the incoming side (`opposite(t)`).
3. It must connect exactly one other side for the exit; otherwise it is a dead end.
4. Reaching the goal cell ends the walk successfully.
5. Revisiting a cell or stepping off the board fails the route.

`isSolved` requires every route to resolve successfully.

## Level authoring

Levels are declared as adjacency data (`def.routes` with ordered `path` tile
lists) plus a `scramble` map. `buildLevel` computes the required base piece
for every path step with `pieceFor(incoming, outgoing)`, guaranteeing a valid
solution; the scramble makes the stored board interesting to play.

## Procedural generation

`generateLevel(seed, w, h, routes)` carves a random walk per route, anchoring
the first and last tile and scrambling the middle ones, then scatters decoys.
A verify-and-retry loop unscrambles a copy and asserts every route resolves.

## Rendering

`ui.js` draws grid cells on canvas. Solved route cells are highlighted in
green; the goal station shows an `S`. On win, each train animates across its
resolved path before the completion popup appears.

## Bundling

`npm run build` uses esbuild to bundle `src/main.js` (CommonJS source) into a
single `dist/game.js` for browsers. Keep `engine.js` and `levels.js` free of
DOM references so they can run under `node --test` unmodified.

## Data flow

```text
index.html
  └─ dist/game.js (esbuild bundle of src/main.js)
       ├─ src/levels.js  ──► createBoard(level)
       ├─ src/engine.js  ──► followRoute / isSolved / generateLevel
       └─ src/ui.js      ──► canvas draw, input handling
```