# Project Specification

## Name

Rail Tangle

## Category

Game

## Target user

Casual puzzle players and developers who want a small, fully source-controlled
game project to study or extend.

## Problem

Most open-source "small games" are either unplayable scaffolds or heavy
engines with asset pipelines. There is room for a genuinely playable,
dependency-light puzzle whose logic is testable.

## Solution

A track-routing puzzle in a few static files: a pure JS engine, six hand-made
levels, a procedural generator, and a canvas UI.

## Core workflow

1. Load a board with stations and pre-placed tiles.
2. Player rotates tiles to complete tracks.
3. Engine verifies each route after every move.
4. All routes resolved → train animation → win panel.

## Must-have features

- Rotatable straight and curve tiles
- Route following with dead-end and loop detection
- Solved-state highlighting
- 6 levels + random generator
- Win flow and move/par counter

## Nice-to-have features

- Counter-clockwise rotation via right-click/Ctrl+click
- Level picker
- Reproducible seeded random boards

## Stack

- JavaScript (CommonJS), Node 18+ test runner, esbuild bundler
- HTML5 Canvas, zero runtime dependencies

## Test strategy

Unit tests on `engine.js` (rotation, connections, followRoute happy/sad paths,
loop detection, isSolved) and on all authored levels + generator seeds.

## Demo/result strategy

`scripts/generate-results.js` writes a validation report, a solution
walkthrough, and an example generated level under `results/`.

## Safety considerations

No network, no storage, no third-party runtime code. Static file only.

## Definition of done

- `npm test` passes
- `npm run build` produces `dist/game.js`
- `node scripts/generate-results.js` reports all levels solvable
- Game is playable by opening `index.html`