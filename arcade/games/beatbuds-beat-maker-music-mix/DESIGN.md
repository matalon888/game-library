# Beatbuds — deep v2 "Band Tour" (lane 26, 2026-10-29)
Status: built behind READY=false (game.js). Fun gate (critic) still to run in a later cycle. No DB on the AWS server: no numbers.

## The game today (v1.js, untouched)
Seven buds; drag sounds (beats / effects / melodies / voices, composed in code) onto them to build a loop. A hidden 3-sound combo
per level, hint every 20 s, 8 secret combos. No fail state.

## Five layers (v1 → v2), 0-3
| layer | v1 | v2 |
|---|---|---|
| verb | 2 (drag/tap sounds, lovely toy) | 3: same drag, but WHERE (spotlight bud counts double) and WHICH matters |
| loop | 0 (find a random hidden combo, no pressure) | 2: a gig = goal chips ticking live, stars, takes limit in worlds 2-3, near-miss card |
| levels | 0 (random combo each time) | 3: 30 authored gigs, 3 worlds, purpose line each (levels.js), HARD gigs 10/20/30, breather 11 |
| meta | 1 (secret combos list) | 2: stars map, 10 hats unlocked by stars, secret sets, daily gig, endless encores |
| feel | 3 | 3: chip chimes rise, star burst + shake, beams flash, confetti on 3 stars |

## Mechanic plan
World 1 Garage: one new goal kind per gig (category count, banned kind, hype meter, feel meter, named sound, both meters).
World 2 Street Fair: locked sounds, TAKES (every placement costs), hype cap, tiny bands (3 buds).
World 3 Arena: the spotlight bud (its sound counts double), exact counts, 7-bud full house.
Stars: 1 = goal chips, 2 = + gold chips, 3 = + the gig's hidden secret set on stage (clue riddle; one sound revealed per 20 s idle).
Each sound has hype (0-3) and feel (0-3), shown as dots on its button.

## Files
dlogic.js (rules + brute-force solver + encore generator), levels.js (30 gigs), deep.js (game), qa/verify.mjs (every gig reaches 3 stars
within its takes), qa/enc.mjs (generated encores solvable), qa/playall.cjs (bot plays all 30 gigs in the real game: 90 stars, no errors).
Board: still "combos found" (+1 per secret combo / 3-star gig), scale unchanged.

## Left
Fresh replay + critic (FUN_REVIEW.md), fix lowest test, fps at 4x throttle, smoke.mjs on the Mac, ship ticket.

deep v2: shipped 2026-11-01 (Verdict TEST, critic 7.0 vs v1 4.4). Board scale unchanged (combos found).
