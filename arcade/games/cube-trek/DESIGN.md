# Cube Trek — deep v2 design (lane 34, 2026-10-31)

deep v2: in progress (READY false)

## What it is
8×8 chunky block puzzle (block-blast family) with quest goals: drag one of three pieces onto the board, full rows/columns burst,
free every gem. v1: quest levels are procedural (seeded rubble, gems placed on the fullest rows), every 3rd is a score target,
game over when no piece fits. Levels 1-2 are hand-made warm-ups.

## Five layers today (0-3)
- Core verb 2: drag a piece, shows the lines it would clear. Skill is only "place well".
- Core loop 1: random trays, random rubble: no authored decision, "no space" ends the run with little blame.
- Level design 1: two warm-ups, then the same shape with more gems; no new element ever appears.
- Meta 1: a level number. No stars, map, collection, daily.
- Feel 2: good lift/shadow/preview/burst/gems fly to the counter; combo words exist. Missing: stars, big-combo spectacle.

## Plan
**Same game** (name, 8×8 board, three-piece tray, drag, gems, art). Deep v2 turns it into a hand-made puzzle quest:
authored board + the *exact* pieces of every tray (`levels.js`, deals), a move limit and a par (3 stars), so every level is a
small puzzle with a "why": the right piece in the right gap, in the right order. Checked by qa/solve.mjs (iterative-deepening
solver over the authored deals: every level solvable, par = solver minimum).

Mechanic plan (new element every ~5 levels):
1. gems in lines (L1-3) · 2. piece choice (L4-5) · 3. 2x2/L pieces, several rows at once (L6-8) · 4. wells: four rows at once (L9)
5. **ice** (L11+): survives the first clear (cracked), second clear breaks it; columns that finish cracked ice = cascades
6. **bombs** (L21+): when their line clears they also clear the 8 neighbours; bomb next to bomb = chain; blasts crack ice
7. cascade rule: lines that become full after a clear go too ("CHAIN!")

Worlds: Crystal Cove 1-10 (gems) · Frost Peaks 11-20 (ice) · Blast Caverns 21-30 (bombs + everything). Hard levels 9, 19, 29;
bosses 10, 20, 30; breather 25 (fireworks). After 30: the v1 endless quest generator (kept) with ice/bombs sprinkled in.

Meta: level map (3 worlds, stars, next level pulsing) · stars → crystal chest every 10 stars (random pick: a block skin
(colour set), a trail) · skins collection with empty slots · **tomorrow hook**: a daily puzzle (seeded rubble puzzle of the
day, same for everyone) and a day streak; the win/lose card and the map say "Tomorrow: Daily Dig #n · day 2 streak".

Feel list (juice pass for deep.js): move-count pips with a pulse on the last 3; "SO CLOSE: 1 gem left" on a loss; combo words
scale (GOOD → UNBELIEVABLE) with camera push + slow-mo on 4+; bomb = shockwave ring + shake + hit-stop; ice crack = shards
+ glassy ping, ice break = bigger; gem fly keeps; stars pop one by one on the win card with rising notes; one-tap retry.

First 3 levels: L1 can't be lost (3 moves, one obviously-fitting piece); L2 two gaps → double clear; L3 a column (the verb
twist). Level 4 is the first one where a wrong piece can be placed (and the loss explains it).

## Files
- v1.js — the untouched old game (the switch loads it for the A arm).
- rules.js — pure rules (place/clear/cascade/bomb/ice) shared by game and checker.
- levels.js — 30 levels + worlds. qa/solve.mjs — the solver.
- deep.js — the new game (TO BUILD, next cycles). game.js — switch (READY false until the fun gate passes).

## Board score
v1 board = levels cleared (sum). v2 keeps "levels cleared" (WB.submit(1) per level, same scale), so limits stay.
