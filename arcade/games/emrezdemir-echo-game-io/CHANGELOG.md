# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.15.6] - 2026-05-17

### Added
- Inline SVG favicon embedded as a data URI. A small purple-and-cyan diamond glyph replaces the missing `/favicon.ico` request that was producing 503 errors on the host.

## [1.15.5] - 2026-05-17

### Fixed
- Reworked the sub-path fix from `document.write` to `location.replace`. When the URL lacks a trailing slash and has no file extension (for example `https://hbnf.net/time-echo`), the head script now triggers a redirect to the `/path/` form. After the redirect the browser sets the correct base and reissues every relative request under the intended sub-path. This is reliable regardless of CSP policies or parser timing that can affect `document.write`.

## [1.15.4] - 2026-05-17

### Fixed
- Removed the static `<base href="./">` introduced in 1.15.3. When the page was loaded without a trailing slash (for example `https://hbnf.net/time-echo`), the browser treated the last segment as a file and `./` resolved to the parent directory, causing every asset request to fall back to the host root.
- A synchronous head script now injects `<base href="<path>/">` only when the URL has no trailing slash and no file extension. With this in place, accessing `/time-echo` or `/time-echo/` both resolve relative assets under `/time-echo/`.

## [1.15.3] - 2026-05-17

### Added
- `<base href="./">` in `index.html` so every relative path resolves against the document directory. This allows the build to run under sub-paths such as `https://hbnf.net/time-echo/` without server-side rewrites.

### Changed
- Editor share URL is now built from `location.href` (stripped of any hash or query) so the sub-path of the current page is preserved.

## [1.15.2] - 2026-05-17

### Changed
- Each sprite animation declares a bounding box of the visible character pixels (idle/run/hurt are tall, dead is wide). `Sprite.draw` crops to this region and fits it to the cell while preserving aspect ratio, so the character now occupies the tile properly instead of being lost in the surrounding transparent padding.
- Feet (or body bottom for the dead pose) remain anchored to the bottom of the grid cell.

## [1.15.1] - 2026-05-17

### Changed
- Character draw size constrained so the sprite frame fits within a single grid cell. Player size lowered from `cell * 1.30` to `cell * 1.0`; echo size from `cell * 1.20` to `cell * 0.95`.

## [1.15.0] - 2026-05-17

### Added
- `bark.js` module: short thought-bubble lines emitted by the player character.
- Trigger conditions: 6% chance on movement, 18% on wall bump, 55% on echo record, low-rate idle trigger after 5 seconds without movement, forced trigger on death.
- Bilingual phrase pool (TR and EN) selected from current i18n language.
- Bubble renders as a rounded box above the sprite head with a tail and a 400 ms fade.

### Changed
- `deploy.ps1` packages `bark.js`.

## [1.14.2] - 2026-05-17

### Fixed
- Character feet now anchor at the bottom of the grid cell. Previously the sprite was centered on the cell, so larger draw sizes spilled the figure onto the wall below.

### Changed
- `Sprite.draw` accepts a `cell` parameter and aligns the sprite with `FOOT_RATIO = 0.85` against the cell bottom.
- Draw sizes tuned: player `cell * 1.30`, echo `cell * 1.20`.

## [1.14.1] - 2026-05-17

### Changed
- Character sprite draw size raised to compensate for the transparent padding around each 128x128 PNG frame. Player size changed from `cell * 0.92` to `cell * 1.85`; echo size from `cell * 0.85` to `cell * 1.70`.

## [1.14.0] - 2026-05-17

### Added
- `effects.js` module: PNG effect animation engine. Loads horizontal-strip spritesheets and plays one-shot animations at world cells (portal, sparks, smoke).
- Portal teleport spawns the PNG portal animation at both endpoints.
- Laser and sentry deaths spawn the sparks animation at the victim cell.
- `level_music.mp3` plays as the looping in-game soundtrack across every level.
- `teleport.mp3` plays on every portal teleport.

### Changed
- Procedural chiptune is no longer the in-game track; `Music.play("game")` now plays the MP3 file.
- `Audio.teleport()` synth call replaced by `Music.playTeleportSfx()` (HTMLAudio MP3).
- `deploy.ps1` packages `effects.js` and the `effects/` asset folder.

## [1.13.0] - 2026-05-17

### Added
- `sprite.js` module: PNG-based character animation engine. Loads 128x128 horizontal-strip spritesheets from `char/City_men_3/` for Idle, Run, Hurt, and Dead animations.
- Animation states map directly from existing render state: Idle when stationary, Run while moving (all directions), Dead while `player.dead` is true. Hurt slot reserved for future damage events.
- Echo characters use the same spritesheets rendered through a `hue-rotate` filter for a violet tint.

### Changed
- `drawAstronaut` now delegates to `Sprite.draw`. The procedural Canvas2D figure was removed. The function signature and call sites are preserved; an additional `moving` flag is computed from `sinceMove`.
- `deploy.ps1` packages `sprite.js` and the `char/` asset folder.

## [1.12.2] - 2026-05-17

### Fixed
- Level 10 (Devriye): the sentry was outside the player's path. The grid was redesigned so the only route from door A to the goal crosses the sentry's lane.
- Level 18 (Çukur): the portals were decorative because column 4 was open all the way from row 3 to row 7. Rows 4 and 6 were sealed so the portal pair is the only passage.
- Level 21 (Sis): the portal was decorative because the player could reach the goal directly through the door. The grid was redesigned so the portal is the only access to the goal corridor.
- Level 23 (Sonsuz Döngü): the quantum tile was off the critical path. It was moved from (4,5) to (7,5) so the player must time it when crossing from plate c to door C.

## [1.12.1] - 2026-05-17

### Fixed
- Level 9 (Dalgalanma): the right corridor (column 7) was open through rows 2 and 4, allowing the player to reach the goal without crossing any quantum tile. The grid was redesigned so column 4 is the only vertical passage and both quantum tiles sit on it.

### Changed
- Level 9: move budget raised from 20 to 22 to account for the required quantum-tile timing.

## [1.12.0] - 2026-05-17

### Changed
- Redesigned levels 6, 13, 16, 17, and 18 to enforce the echo mechanic in mid-to-late game progression.
- Level 6 (Çöküş): replaced the triple-mechanic overload with a portal-and-door composition where the echo holds the plate remotely.
- Level 13 (Kutu Çıkmaz): the crate opens door A while a laser still threatens the goal, requiring an echo on a second plate to silence the beam. Move budget raised from 18 to 28.
- Level 16 (Üç Aşama): replaced the duplicate of level 3 with a three-stage composition (door, laser, portal well) requiring two echoes plus a final traversal.
- Level 17 (Perde): replaced the dual-fragile layout with one fragile plate (latches its door) and one regular plate (held by echo).
- Level 18 (Çukur): reduced from three portal pairs to two, with door A gating the first corridor. Move budget lowered from 28 to 26.
- Rewrote level introduction strings to clearly state why each level requires an echo.

### Notes
- Level 8 (Kargo) and level 11 (Kırılgan Plaka) retained as solo-passable introduction levels for their respective mechanics.
- All 23 hand-crafted levels pass the BFS-based audit (`_audit_hand.js`).

## [1.11.3] - 2026-05-17

### Fixed
- Level select layout clipped top rows on tall content: `align-items: flex-start` applied to `#screenSelect`, `#screenVersion`, and `#screenEditor` so scroll reaches the start of content.
- Editor action bar overflowed the sidebar: `.ed-actions` switched from flex row to a three-column grid; five buttons now wrap across two rows.

### Changed
- Level list grid: `repeat(3, 1fr)` → `repeat(auto-fill, minmax(220px, 1fr))`. Card frame max-width increased from 920px to 1280px.
- Mini-map preview height reduced from 72px to 56px; card padding tightened.
- Single-page pager hidden when total pages equals one.

## [1.11.2] - 2026-05-17

### Changed
- Rewrote `README.md` with a structured layout: status badges, table of contents, section hierarchy with consistent emoji prefixes.
- Added an explicit AI-Native Development section documenting the iterative development workflow, the persistent memory bank file (`CLAUDE.md`), and the synchronization protocol across `version.js`, `CHANGELOG.md`, `i18n.js`, `CLAUDE.md`, and `README.md`.
- Removed stale references to procedurally generated levels and old version codenames.

## [1.11.1] - 2026-05-17

### Fixed
- Save state key bumped from `timeEcho.progress.v1` to `timeEcho.progress.v2` so that cleared indices from the removed procedural generator no longer alias new hand-crafted levels.

## [1.11.0] - 2026-05-17

### Removed
- Procedural level generator disabled. `TOTAL_LEVELS` now equals the hand-crafted level count.
- `LEVELS` proxy replaced with a direct array.

### Added
- 12 new hand-crafted levels (12 through 23) extending the difficulty curve.
- Level 23 (Sonsuz Döngü) combines doors, fragile plate, portal, quantum tile, laser, and sentry in a single 13×14 grid.

### Changed
- `LEVELS_PER_PAGE` raised from 12 to 24 so the 23 levels fit on one page.

### Fixed
- `isPlateCell` no longer treats `v` (laser-down emitter) as a plate.

## [1.10.1] - 2026-05-17

### Fixed
- Level 9 (Dalgalanma): row 4 grid string was being truncated by `.slice(0, 9)`, sealing the right corridor. Row written directly as `#.#####.#`.
- Level 10 (Devriye): redesigned to a 10×6 grid where door A is the only vertical passage and the sentry blocks the path to the goal. Move budget raised from 22 to 28.

### Added
- `_audit_hand.js` script applies the `Generator.auditLevel` logic to hand-crafted levels. Result: 11/11 passing after fixes.

## [1.10.0] - 2026-05-16

### Changed
- Replaced the front-facing astronaut sprite with a side-view pixel-art character: hair, skin, torso, arms, legs, walk cycle, facing flip, and front/back limb shading.
- Function name `drawAstronaut` retained for call-site compatibility.

## [1.9.9] - 2026-05-15

### Changed
- Replay UX: returning from a replay restores the original win overlay (continue / menu) instead of an intermediate dialog.
- Level 7 (Kuantum Geçit): grid simplified to a single three-quantum corridor with no alternate path.

## [1.9.8] - 2026-05-14

### Fixed
- Title-screen MP3 (`voyage_main_menu.mp3`) now plays only on the title screen. Other screens (select, editor, version, story, game) use the procedural chiptune engine.

## [1.9.7] - 2026-05-13

### Changed
- Level 6 (Çöküş) second iteration: portal (9,1)↔(2,5) drops the player into the laser corridor. Plate `a` opens door A and disables the laser.

## [1.9.6] - 2026-05-13

### Fixed
- Mobile and small-viewport layout: `viewport-fit=cover`, safe-area-inset padding, `100dvh` for full-height containers, inline transforms removed where they conflicted with CSS animations.
- Hover effects disabled below 900px viewport; `:active` tap feedback used instead.

## [1.9.5] - 2026-05-12

### Added
- Seven-stage audit pipeline for the procedural generator (P/G count, door-plate pairing, portal pair count, plate reachability, doors-closed solo-pass detection).
- Generator now re-generates levels that fail audit.

## [1.9.4] - 2026-05-12

### Changed
- Level 6 (Çöküş) redesigned: portal becomes the mandatory transition; rows 4 and 6 walled off; orphan plate removed. Move budget lowered from 32 to 28.

## [1.9.3] - 2026-05-11

### Added
- Portal teleport effect: particle bursts at both endpoints.
- Procedural spectrum fallback for environments where the audio analyser is unavailable.

### Fixed
- Ghost replay: `_replaying` flag bypasses the tick `busy` guard so the replay actually animates.
- Post-replay flow: replay end returns to the original win overlay.

## [1.9.2] - 2026-05-10

### Added
- External title-screen track via Web Audio `AnalyserNode`. `TitleFX` modulates stars, nebula, logo glow, and a spectrum bar overlay from bass / mid / treble energy.
- `THIRD_PARTY.md` documenting third-party assets and licensing.

## [1.9.1] - 2026-05-09

### Changed
- Music rewritten as a dark ambient drone (lead and arpeggio layers removed).
- Quantum tiles render with a real-time pulse and stronger state contrast.

### Added
- `TitleFX` module: parallax stars, drifting echo silhouettes, nebula, logo glitch, button-hover response.

## [1.9.0] - 2026-05-08

### Added
- WebGL2 post-processing pipeline: bloom, CRT distortion, chromatic aberration, scanlines, vignette, grain. Canvas2D rendering preserved; only the final composite passes through the shader stages.

## [1.8.0] - 2026-05-05

### Added
- Sentry (`X`): patrolling enemy that paces a corridor and is lethal on contact.
- Fragile plate: latches its paired door open permanently after a single press.
- Five biome color palettes.
- Story fragments at milestone levels.
- Three-star burst effect on perfect clear.

### Fixed
- Door letter `B` no longer collides with the box character. Generator skips `B`, `G`, `P`, `Q`, `X` when assigning door letters.

## [1.7.1] - 2026-05-01

### Fixed
- Initial spawn bug on certain procedural levels.
- Level select UI: minor layout corrections.

### Added
- Story fragments interleaved with level transitions.

## [1.7.0] - 2026-04-29

### Added
- Quantum tile (`Q`): flips between wall and floor every move.
- Pushable crate (`B`): activates plates and blocks laser beams.
- Diagonal movement: keys Q, E, X, C plus 3×3 D-pad on mobile.
- Smooth cell-to-cell tween (120 ms, ease-in-out).
- Parallax star/nebula background.
- Star scoring (1–3 stars based on echoes used vs. moves).
- Ghost replay of the winning run.
- Speed-run timer.
- Custom level gallery (localStorage).
- Pixel-art procedural tile cache.

### Changed
- Total level count raised to 1987 via the procedural generator (later removed in 1.11.0).

## [1.0.0] - 2026-04-20

### Added
- Initial release.
- Core echo mechanic: recorded move sequences replay deterministically.
- Mechanics: plate, door, portal, laser.
- 6 hand-crafted introductory levels.
- Browser-based, no build step. Vanilla JavaScript with `<script>` loading.
- Turkish and English UI via `i18n.js`.
- Procedural sound effects (`audio.js`) and chiptune music (`music.js`).
- Level editor with URL share encoding (`editor.js`).
- localStorage-backed progress (`Save` module in `game.js`).
