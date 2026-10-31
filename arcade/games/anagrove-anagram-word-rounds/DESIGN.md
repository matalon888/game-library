# Anagrove — deep v2 plan (studio lane 24, 2026-10-29)

deep v2: built, READY=false until the fun gate passes (see FUN_REVIEW.md).

## The game
Six letters, a wall of word slots (3-6 letters) and a clock. Tap letters, ENTER; every word fills a slot; any six-letter word
unlocks NEXT. Same name, same idea, same painted-forest art as v1 (v1.js stays untouched for the A/B).
No analytics DB on the AWS server, so no new numbers; v1 had no levels, no goals, no meta (random rounds, one 2:30 clock).

## Five layers today (v1) → v2
| Layer | v1 | v2 |
|---|---|---|
| Core verb | 1 | 2 — same tap-to-spell, now with decisions: chain speed, wilted tile, thorn risk, gold slot |
| Core loop | 1 | 2 — goal chip (words / long words / start letter / chain / gold / fast six), clock, stars live in the chip, near-miss line |
| Level design | 0 | 2 — 30 hand-picked rounds (levels.js, purpose line each), 3 groves, sawtooth, HARD round every 10 |
| Meta | 0 | 2 — grove map with a tree per round that grows with stars, seed chest every 6 stars → 8 tile looks, endless groves after 30 |
| Feel | 2 | 2-3 — chain counter with timer bar, bloom (x2 points, pink glow), gold-word burst, screen shake on six, rolling star card |

## Mechanic plan (in order)
1. Spelling + first-letter hints, no clock on round 1 (cannot be lost), idle glow hint on rounds 1-2
2. Goal for 2nd star (round 2), chain (3), golden word +10 s (4), long words (5), start-letter goal (6), speed six (7)
3. World 2 Whisper Woods: wilted tile (wakes after n words), thorns (wrong word −3 s), wind (tiles blown around, sway warning)
4. World 3 Ember Canopy: fog (wall hidden, only counts per length shown), then all tricks combined
Stars: 1 = six-letter word found, 2 = + the goal, 3 = + share of the wall (s3). Chain = words within 7 s; x4 starts bloom (8 s double points).

## Fairness
Clock = spec.t / flow.k() (same rule as v1; k stays 1 with the world board on). Board still submits words found. Daily keeps
v1 behaviour (seeded round, same for everyone). No money, no ads. Random only in chest picks.

## QA
`node qa/check.mjs` validates 30 levels; `node qa/playall.cjs [from] [to] [frac]` plays them through the real game with real taps.
