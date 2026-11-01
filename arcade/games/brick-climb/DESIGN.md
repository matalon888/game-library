# Brick Climb — DESIGN (deep v2 plan, lane 37, 2026-11-01)

**What it is:** 3D Bridge-Race-style climb. Grab bricks of your colour, run to a bridge, lay them as stair steps, climb floor by floor to the
gold platform before three rival runners. A bigger stack knocks a smaller one off. Same name, same look, same verb. v1 untouched in `v1.js`.

## Five layers today (v1, 0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 2 | floating joystick; decisions about when to climb and which lane; skill exists but nothing rewards it |
| Core loop | 1 | ~30 s race, rivals only differ by speed; no pressure inside, no goals beyond "first" |
| Level design | 0 | seeded random floors, level 12 = level 2 with more steps |
| Meta | 0 | level counter + board "Levels cleared" |
| Feel | 1 | pickup tone scale, steps pop; no combo, no escalation, flat cards |

## v2 plan
**Verb with skill:** route + timing: collect exactly what the climb needs (pill shows `stack / need`), choose the lane, use a big stack as a weapon,
pick up bricks in a **streak** (1.6 s window) for x5/x8/x15 callouts and **FEVER** at 10 (5 s, every brick counts double).
**Round (15-60 s):** collect → decide when to climb (need shown) → steps → next floor refill → finish first. Rivals: `norm`, `rush` (climbs early with
too few), `hoard` (huge stack), `hunt` (chases a smaller stack, "RED IS COMING!"); everyone runs from a much bigger stack.
**Stars:** ★ win (1st) · ★ under the par time · ★ the level's goal (streak N / smash N / grab N gold / never hit). Par = QA bot median ×1.7 + 8 s.
**Mechanics, in order:** 1 bricks+stairs (L1 cannot be lost) · 2 two floors · 3 bump rule · 4 gold (+4) · 5 three floors · 6 closed lane (steals) ·
7 hoarder · 8 head start · 9 mix · 10 BOSS Big Red. W2 Candy Quarry: 11 sweeper bar (knocks stack off) · 12 two bars · 13 bombs (half the stack) ·
14 minefield · 15 bars+bombs+closed lane · 16 breather (gold) · 17 two hunters · 18 four floors · 19 gauntlet · 20 BOSS Green Giant.
W3 Frost Spire: ice floors (you slide) 21-29, breather 26 · 30 BOSS Gold Tyrant.
**Worlds:** Sunny Yard · Candy Quarry (pink) · Frost Spire (ice blue). Own sky/ground/water. Bosses are bigger runners.
**Meta:** level map (3 worlds, stars, pulsing next node, red outline on hard, crown on bosses) · a chest every 6 stars = a new brick colour (12) ·
Daily Climb (seeded for the day) with a daily gift and a day streak.
**Tomorrow hook:** win cards say "Tomorrow: Daily Climb #N · 🔥 day D"; the map's Daily button and the gift are real.
**Feel list:** shake + hit-stop on knock/whack/bomb, particles on every pickup, rising pickup pitch, streak bar, FEVER pulse, floor callouts, star pops.
**Board score:** unchanged meaning ("Levels cleared"): +1 on the first clear of a level only.
**Fairness:** rival speed = `rs × flow.k()` capped at 1.03 exactly as v1's formula; no difficulty depends on device/money.

## Build status
2026-11-01 cycle 1: built, READY false (`?deep=1` forces v2). `tools37/bsim.cjs` runs any level headless (`__game.run(n)`): QA bot clears all 30
(hard ones 20-80% of runs; idle bot never wins). Left: critic gate (FUN_REVIEW.md), 4× CPU fps, desktop shots, ticket.
deep v2: in progress (2026-11-01 02:10Z phone shots checked, no errors; critic pending at load<24)

deep v2: ready for TEST 2026-11-01 (critic 7.3 vs 3.6)
