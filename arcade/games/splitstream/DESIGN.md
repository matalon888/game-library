# Splitstream — DESIGN (deep v2, lane 59, started 2026-10-31)

Game: roller-skate on twin rails; drag/tap spreads or squeezes the legs so each skate stays on its rail; straddle blocks on
decks, squeeze onto single beams, collect gems, reach the arch. v2 keeps all of that (same name, art, controls).

## Five layers (0-3), v1 -> v2 plan
- Core verb 1 -> 2: one drag, now readable: a yellow marker on the span meter shows the width the track needs 0.4 s ahead (green when matched).
- Core loop 1 -> 2: 25-40 s tracks with a decision every second; near-miss lose card ("SO CLOSE! 91%"), instant retry.
- Level design 0 -> 3: 30 authored tracks (levels.js, purpose line each), 3 worlds, sawtooth with HARD bosses at 10/20/30 and breathers at 19/25.
- Meta 0 -> 2: map, stars (gem %), skate styles from star chests (every 8 stars), Daily Run + streak (tomorrow line on the win card).
- Feel 1 -> 2: gem combo callouts (RUSH x5, UNSTOPPABLE x20 with flash/haptic), boost speed kick (camera pulls back), rising pitch.

## Mechanic plan
W1 Sunset Strip: rails (1-3) -> single beam squeeze (4-5) -> deck straddle (6-7) -> combined (8) -> quick changes (9) -> boss (10).
W2 Neon Pier: breathing rails (11-13) -> boost pads (14-15) -> snap gates (16) -> mixes (17-18) -> breather (19) -> boss (20).
W3 Glass Sky: ice (21-24, legs slide: move early) -> breather (25) -> tight decks (26) -> snap on ice (27) -> gauntlet (28) -> boss (30).
Stars: 1 = finish, 2 = >=65% gems, 3 = >=92% gems (gems sit on the rails, so they measure how centred you skate).
Levels past 30 and the Daily Run come from `generate()` (same vocabulary, seeded by date for the daily).

## Fairness / score
Speed still multiplied by flow.k() as in v1 (untouched). Board = "Levels cleared" sum: v2 submits 1 only on the FIRST clear of a level.
Saves in store('splitstream2'); v1 saves untouched.

## Status
Built behind READY=false (game.js `const READY`), QA with ?deep=1&level=N. qa/levels.mjs: all 30 + generated tracks pass a thumb
model (<=6 u/s). qa/play.cjs: bot clears levels 1, 4, 6 with no console errors.
Left: hand playtest (feel, difficulty for humans), ice/boost visuals check, bot run of all 30 in browser, fps at 4x CPU,
critic gate in a later cycle, then READY=true + ticket. deep v2: NOT shipped yet.
