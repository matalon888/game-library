# Girder Go — deep v2 plan (lane 3, 2026-11-01)

Same game: drag beams between joints, press GO, the little vehicle crosses while beams glow green→red; over-stressed beams snap.
v1 = `v1.js` (untouched); v2 = `deep.js` + `levels2.js` (`game.js` is the switch, `READY` false until the fun gate passes; `?deep=1` forces v2 for QA).

## Five layers today (v1) → v2
| Layer | v1 | v2 |
|---|---|---|
| Core verb | 2 (real physics, skill in truss design) | 3 (same + weak-link marks teach the fix) |
| Core loop | 1 (flat gaps, endless, one result: win/lose) | 3 (goal per level, budget + par star, loss shows % across and the weakest beams) |
| Level design | 0 (6 hand specs then random picks of 5 templates) | 3 (36 specs: cliff steps, 1-3 rocks, heavy vehicles, restricted materials, tight budgets; sawtooth + bosses) |
| Meta | 0 | 3 (map with stars, garage of 8 vehicles at star totals, daily bridge with a day streak) |
| Feel | 2 | 3 (rising chime per beam, creak that rises with stress, slow-mo on the first snap, 1-3 star fanfare) |

## Mechanic plan (new idea every 3-4 levels)
W1 Meadow Creek: road+wood (1-4: gap, low anchors, a rock, two rocks), steel arrives (5), truck (6), step down (7), off-centre rock (8), truck over rock (9), breather (10), steel-saver (11), BOSS Big Muddy (12).
W2 Sunset Mesa: cliff steps up/down by 2 (13-14), twin pillars (15), climb over the rock (16), lopsided spans (17), long span (18), pillar+climb (19), breather (20), wood-only (21), long truck haul (22), tight budget (23), BOSS (24).
W3 Frost Peak: bus (heaviest) intro (25-26), frozen wood (27), thin budget (28), ski jump (29), bus downhill (30), breather (31), 16-wide with 3 rocks (32), bus climb (33), wide bus (34), tight spot (35), BOSS Summit Span (36).

## Stars
1 = crossed, 2 = crossed with nothing snapped, 3 = nothing snapped and cost at or under par (the cheapest reference design that holds at +40% weight). Budget = par × slack (1.12-1.9, bigger early).
Board score: still "levels cleared" (+1 per level crossed), limits unchanged.

## Meta / tomorrow hook
Map (3 worlds × 12, stars, next level pulsing), Garage (Sunny Car 0 → Gold Champ 60 stars; every star counts, daily bridge counts +1), Daily Bridge (seeded crossing from the pieces, same for everyone that day, streak shown on card and map; "Tomorrow: a new Daily Bridge · day N").

## QA
`node qa/check2.mjs` proves all 36 specs have a reference design that crosses at 1.0/1.12/1.25/1.4× vehicle weight. `qa/playall.cjs` plays each level in the real game (bot builds the reference design, presses GO).

deep v2: in progress (not shipped)
deep v2: shipped 2026-11-01 (Verdict TEST)
