# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-09-19

### Fixed

- `npm test` failed on Windows/Node v24 with `Cannot find module ...\test`; the
  script now uses `node --test` auto-discovery (still runs 13/13 tests).

## [1.0.0] - 2026-09-19

### Added

- Route engine: tiles, clockwise rotation, route following with dead-end, off-board,
  and loop detection, and full-board solving.
- Six hand-crafted levels with par move counts and guaranteed solutions.
- Seeded procedural level generation with unscramble verification.
- Canvas UI: solved-route highlighting, train animation on win, HUD, and level picker.
- esbuild bundling into `dist/game.js`.
- Node.js test suite (13 tests) and reproducible result generation script.