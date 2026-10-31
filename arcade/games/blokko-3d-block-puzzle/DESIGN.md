# Blokko — deep v2 plan (studio lane 13, 2026-10-29)

Game: a chunky 3D shape of arrow cubes. Drag to spin it, tap a cube to slide it along its arrow; it only leaves if the road
to the edge is clear, otherwise it bumps back and costs a heart. Same name, same idea, same pastel look as v1.

## Where v1 stood (no play data on the AWS server; DB copy is on the Mac)
Layers (0-3): verb 2 · loop 1 · levels 0 · meta 0 · feel 1.
- v1 = endless seeded shapes (box / pyramid / notch / plus) by level number; every level asks the same thing; no stars, nothing
  to collect, no new elements; a win card with "Tap to continue".

## v2 (deep.js, levels.js, logic.js, seeds.js; v1 kept untouched in v1.js; switch in game.js)
Verb: tap a free cube (find it by spinning). Skill: reading the 3D shape fast and not mis-tapping; on bomb levels also *which*
cube to pop first (a bomb saves one tap per cube it blows).
Loop: a level is 10-60 s; hearts (tuned by flow.k as before) limit mistakes; stars = taps vs par (3★ par, 2★ par+2, 1★ cleared; bomb
levels get +1 slack at 3★); a loss shows how close ("SO CLOSE: 2 cubes to go") with one-tap retry.

Mechanic plan (each element appears alone in an intro level, then practice, twist, test, breather):
| World | Levels | Elements |
|---|---|---|
| 1 Candy Corner | 1-12 | arrows; gold cubes (4) |
| 2 Mystery Attic | 13-24 | ? hidden arrows (13), bombs (19), chains (22) |
| 3 Boom Factory | 25-36 | stones only a bomb removes (25), bombs + stones + hidden together, jackpot chain (33), boss (36) |
HARD (red ring): 8, 17, 24, 30, 35; BOSS (gold ring): 12, 36; breathers after each (9-10, 18, 25 start, 32-33).
First 3 levels: 1 can't be lost (mis-taps cost no heart, a ring points at a free cube, slow auto-spin), 2 teaches spin, 3 is the first real shape.
Levels: 36 hand-drawn shapes (layer strings in levels.js with a purpose line each). The arrows are laid by logic.js `gen` (peels the
shape so a full clearing order always exists, stones only if a bomb can reach them); qa/pick.mjs tries 400 seeds per shape and
keeps the most puzzling solvable one (easy intros: many free cubes; hard: few, deep chains); par = best of 1500 searched orders.
After 36: Remix levels (authored shapes of worlds 2-3, fresh arrows, par searched in game) and a Daily shape (+3 coins, streak).

Meta: stars per level (108) → 8 cube skins (Candy, Mint Fizz, Sunrise, Deep Sea, Berry, Midnight, Rainbow, Gold Rush) at
0/6/14/24/36/50/68/90 stars, new one worn the moment it unlocks, "N more stars for the X cubes" always in sight; level map with 3 world
tabs and a next-level pulse; coins (gold cubes, first clears, frenzy, lucky cubes) buy hints (💡 bulb, 6 coins; 2 free to start).
Progress saved in blokko2_* (separate from v1). Board score unchanged: levels cleared (first clears only, so replays for stars don't inflate it).
Feel: combo notes rising, NICE/GREAT/FRENZY/UNSTOPPABLE x-counter, frenzy (5 clears in a row → 5 s of double coins), lucky 1-in-20 cube (+3 coins),
bomb = shockwave ring + hit-stop + shake + flash + chained delays, gold sparkle, ? reveal pop, stone crack thud, last-cube slow-mo,
stars pop one by one with rising notes, idle bulb wiggle, drawn icons (no font needed).

## QA (qa/)
pick.mjs (seeds + par), playall.cjs (all 36 + 2 remix levels solved through the real game: 3★, no errors), shot.cjs (screenshots).

## Status
cycle 1 (2026-10-29): built, playall ok. READY = false. Next: fresh replay, critic (FUN_REVIEW.md), fix lowest test, fps/desktop, ship.
