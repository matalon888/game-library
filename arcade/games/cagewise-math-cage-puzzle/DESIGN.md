# Cagewise: deep v2 plan (lane 34, 2026-11-01)

deep v2: in progress (READY=false in game.js; `?deep=1` forces it for QA). v1 is kept untouched as `v1.js`.

## Five layers (v1 -> v2), scored 0-3
- Core verb: 2 -> 2 (tap a square, tap a number; notes, hints). Skill ceiling now visible: stars for no slips + par time.
- Core loop: 1 -> 2 (v1 had no goal beyond "solved"; v2: slips (repeat / wrong cage) cost a star, par clock passes with a PAR PASSED cue, cage CHAIN x N / ON FIRE for clean cages in a row, row/column sweep glow, "SO CLOSE: 1 slip cost you a star" + one-tap 3-star retry)
- Level design: 0 -> 3 (30 authored specs in 3 worlds; every puzzle proven unique by `qa/check34.mjs`; purpose line each; boss 10/20/30, hard 9/17/27, breathers 6/11/18/25/29)
- Meta: 0 -> 3 (map with stars, chest every 8 stars (stars + gold-cage keys) picking 1 of 3 board themes, 8 themes incl. a rare golden one, daily puzzle with day streak, "Next / tomorrow" line on the win card)
- Feel: 2 -> 2 (kept v1 pops/chimes; new: chain arpeggio pitch rises, bigger sparks per chain, row/col sweep, win stars land one by one with rising chime)

## Mechanic plan (3 worlds)
1. Pine Row (4x4, 1-10): one sign at a time: + (L2), - (L3), x (L4), / (L5), breather L6, 3-cell cages L7, few gifts L8, hard L9, boss L10 = first 5x5.
2. Mirror Hall (5x5, 11-20): hidden-sign "?" cages from L13 (the target shows, the sign does not; any sign that works counts, and the puzzle still has exactly one solution), plus-and-times only L16, hard L17, minus/divide only L19, boss L20 full of ? cages.
3. Grand Hall (6x6, 21-30): 6x6 with gold cages (finish one for a chest key) L23/25/29/30, ? cages, huge cages, final boss L30.
After 30: endless generated puzzles with everything unlocked.

## First 3 levels
L1: 4x4, 10 of 13 cages are single squares (a target is the number), first square pre-selected, a hand on the first square, first pad key pulses. L2 adds plus cages, L3 minus; nothing can be lost (stars only).

## Stars
3 = no slip, no hint, under par. 2 = one of those missed. 1 = solved. Replays can only raise stars. World board stays "Puzzles solved" (+1 per solve, limits unchanged).

## Levels file
`levels.js` is built by `tools34/gen.mjs` (specs: cage-size mix, signs, ? share, difficulty pick among seeded candidates by solver node count) and re-proved by `qa/check34.mjs` (Latin square, every cage right, exactly one solution).
