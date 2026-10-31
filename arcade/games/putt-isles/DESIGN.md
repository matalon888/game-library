# Putt Isles — DESIGN (deep v2, lane 58)

Status: deep v2: built behind READY=false (2026-10-31). Not shipped. Fun gate (critic) runs in a LATER cycle.

## Five layers (0-3), before -> plan
| Layer | v1 | v2 |
|---|---|---|
| Core verb (drag back / tap flag to putt, power by pull) | 2 | 2 (surfaces change how far a putt rolls; aim dots now show the real roll, sand/ice/pads included) |
| Core loop (race 3 rivals, timer, stroke cap) | 1 | 2 (stars: clear / par / par + all coins; coins on the fairway edges give risk-reward) |
| Level design | 0 (generated path) | 3 (30 authored holes, 3 worlds, each with a purpose line in levels.js) |
| Meta | 0 | 2 (hole map with stars, 6 ball skins by total stars, Daily Hole + streak) |
| Feel | 2 | 2+ (coin chain pitch, BOOST, LIP OUT, stars pop, new-ball confetti) |

## Worlds
1. Meadow Isles (1-10): corners, bumpers, sliding blocks, spinning bars, ramp jumps; hole 9 hard, hole 10 breather.
2. Dune Isles (11-20): sand slows (x2.6 friction), boost pads kick +6 speed once per pad; hole 19 hard.
3. Frost Isles (21-30): ice (x0.25 friction); 29-30 hard finale.
Hole n opens when hole n-1 has >=1 star. First hole is one straight lane (demo putt kept), new idea introduced every 1-2 holes with a short caption (once per player).

## Stars / meta
1 star: sink it. 2 stars: at par or better. 3 stars: par and every coin. Ball skins at 0/6/15/27/40/55 stars (max 90).
Daily Hole: generated from the date (same for everyone), streak counter on the map. Win card ends with the next unfinished goal ("3 coins missed", "4 more for a new ball", "Next: <hole>").
Rivals (KAI, NORA, BO) race but only the timer / stroke cap (par+4) can lose the hole. Difficulty never depends on device, money or ads; flow.k() untouched.

## Board score
Unchanged: +1 per hole cleared (board 'Holes cleared', sum mode). Limits unchanged.

## QA
qa-validate.mjs (layout), qa/play.cjs (bot plays holes: node qa/play.cjs 8058 1,2,3 shots), qa/map.cjs (map + daily).
Switch: `READY && ab('deep-putt-isles')`; ?deep=1 forces v2; ?deep=1&hole=N jumps to a hole.

## Left
Fresh replay by hand, tune par/time per hole, juice pass (hit-stop on bumpers, trick-shot goals), critic gate, fps check, READY=true, ship ticket.
deep v2: shipped 2026-10-31 (Verdict TEST, critic avg 7.3)
