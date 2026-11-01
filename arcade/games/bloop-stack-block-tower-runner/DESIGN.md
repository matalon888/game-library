# Bloop Stack — deep v2 design (lane 14, 2026-10-29)

Game: Bloop, a jelly blob, slides right on its own. Tap = squeeze a jelly block out underneath so Bloop rises. Walls scrape the
lowest blocks off (a wall cleared with zero spare blocks = FLUSH), low roofs crush a tall stack. v1 = seeded endless levels,
no goals; a run ends in one bonk. (Data was not available on this server; v1 is a single run-and-bonk toy.)

## Five layers today (v1) → v2
| layer | v1 | v2 |
|---|---|---|
| verb | 1 (tap = block, no skill window) | 3: tap early (carry for gems) vs late (flush); spring pads, crushers add timing |
| loop | 1 (run until bonk, no goal) | 3: reach the flag; gems on the way, flush walls, 3 stars, checkpoints on long levels |
| level design | 0 (random terrain) | 3: 36 hand-made levels, purpose line each, solver-checked (qa/solve.mjs, qa/par.mjs) |
| meta | 0 | 2: star map (3 worlds), hats from stars, jelly colours from gems, ghost taps after 3 losses |
| feel | 2 | 3: hit-stop, shake, rising pitch, flush chain → fever, gem chimes, springs, crush squash |

## Mechanics in order
W1 Meadow Hop (1-12): steps, drops, carry a block to a gem in the air, pillars, roofs (too tall bonks), tunnels.
W2 Candy Canyon (13-24): spring pads (hop with no blocks), bonus blocks (free block in the stack), springs under roofs.
W3 Sky Gears (25-36): crushing roofs (timing), crusher + spring, crusher + pillars, checkpoints on the long hard levels.
Sawtooth: every 12 levels has HARD boss levels and breathers (10, 22, 34).

## Stars
1 = flag reached. 2 = every gem. 3 = every gem and enough FLUSH walls (par = 80% of the solver's best).
A checkpoint respawn keeps what was already collected, so stars stay reachable.

## Meta
Level map (3 worlds, stars, next level pulsing), hats unlocked at star totals, jelly colours unlocked at gem totals, the next
unlock always shown. Level 1 is assisted (cannot be lost); losing shows "N blocks short" and retry is one tap.
Board score keeps its meaning: levels cleared (limits unchanged).

## QA
qa/solve.mjs (all 36 clearable with every gem), qa/par.mjs → par.js (taps for ghost hints, flush par), qa/playall.cjs
(plays every level in the real game from the solver's taps).
deep v2: shipped 2026-11-01 (TEST)
