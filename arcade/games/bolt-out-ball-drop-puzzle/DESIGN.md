# Bolt Out — deep v2 design

(lane 15, 2026-10-29. No play data on the studio server: the db copy lives on the Mac; first numbers come with the lab test `deep-bolt-out`.)

## v1 scored (0-3)
| Layer | v1 | Why |
|---|---|---|
| Core verb | 2 | tap a bolt, balls fall: order is the skill, satisfying physics |
| Core loop | 1 | endless generated vessels, one idea (grey/colour/bomb), no reason to care which vessel |
| Level design | 0 | random lanes from a seeded generator; level 12 is level 5 with more bolts |
| Meta | 0 | level counter only |
| Feel | 2 | good pour, bomb blast, confetti; nothing on a good order vs a lucky one |

## Plan (same game: tube vessel, bolts, grey/colour/bomb rules, same look, 3D glass jar)
- **36 hand-picked vessels, 3 worlds of 12** (levels.js, each with a purpose line). Layout = up to two lanes of bolts that pour into a
  shared "tail" of wide bolts, then the jar. Found with qa/search.mjs (traps counted by the solver), chosen/ordered by hand.
  World 1 *The Garage*: colour, grey, bombs, merging lanes. World 2 *The Lab*: goo (spoils the jar; a bomb pops it) and twin bolts
  (same ring colour, one tap pulls both, both piles fall at once). World 3 *The Foundry*: padlocked bolts (the key bolt of the same colour
  frees them). Each world: intro levels, a HARD (red ring), a breather, a boss (36 = every rule).
- **Stars per vessel**: 1 cleared, 2 within par+1 pulls, 3 par pulls (par = the solver's shortest order; useless pulls cost a star).
- **Meta**: level map (3 worlds, world opens on its predecessor's boss), 8 jars unlocked by total stars (6/14/24/36/50/68/90), coins
  (+1 first clear, +1 first 3 stars, golden ball in every 5th vessel, +3 daily) buy hints (the bulb shows the next bolt from the live
  state; 2 free), daily vessel with a streak, 90 bonus vessels after level 36 (each verified through the real physics, qa/mkbonus.cjs).
- **Feel**: pull pitch climbs with each pull, conversion wave pitch climbs, jar ticks rise with %, bomb pop = hit-stop + shockwave +
  shake (red ring on the culprit when it is a loss), slow-mo on the winning pour, golden ball, padlock falls off with a click, a locked tap
  pulses the key bolt, "SO CLOSE" lose card when 70%+ is in, dead-end nudge pulses the restart button.
- **First 3 levels**: no title card; level 1 = one bolt, hand pointer after 1 s; 2 = any order; 3 = grey needs colour (a lose costs 1 s).

## Rules fixed so the maths and the physics agree (logic.js ↔ deep.js)
A pile = one token on one bolt. Landing: bomb + colour = BOOM; bomb + grey/goo = bomb pops and takes the goo and any other bombs of its
pile with it (greys stay); grey + colour = colour; grey/goo/bomb into the jar = lose. Twins fall at the same moment (landings merge).
qa/playall.cjs plays every vessel through the real physics in the solver's order: all 36 win at par.

## Fairness / data
Authored vessels (no difficulty multiplier, flow.k() unused); board score unchanged (levels cleared, `sum`, maxRun 2); v1 untouched in v1.js.

## Status
deep v2: built, READY false (cycle 1). Left: fresh replay, critic gate (FUN_REVIEW.md), desktop/fps, ship.
