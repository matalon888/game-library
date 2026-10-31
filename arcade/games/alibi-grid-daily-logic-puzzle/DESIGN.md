# Alibi Grid — design (studio lane 19)

deep v2: shipped 2026-10-31 (Verdict: TEST)

## What it is
A grid of suspects, each innocent or a criminal. Every person you clear tells one true clue; deduce the rest with proof
(guessing is refused: "not proven yet"). Three mistakes and the trail goes cold.

## The numbers
No DB on the AWS server this cycle (no play data read). v1: procedural cases, level number only, one grid size, no meta.

## Five layers today (v1), 0-3
| Layer | v1 | Why |
|---|---|---|
| Core verb | 2 | proof-only marking has real skill (chain reading) but one rule set from case 1 to 50 |
| Core loop | 2 | a case is 1-3 min, each card gives a clue; no pressure curve, no streak |
| Level design | 0 | procedural, same statement types, same 4x5 grid always |
| Meta | 0 | a level counter |
| Feel | 1 | flip + sparks; no combo, no win spectacle |

## Verb and skill ceiling
Read the clue pile, find the card that MUST be innocent/criminal, tap it. Better players chain faster and never use a hint:
stars = no mistakes + no hints.

## Round loop (v2)
Open on the next case (no menu), a title card with the case name and purpose, one revealed card. Pick the provable card →
flip + chime (pitch climbs with the streak), clue slides in. Streak pops SHARP x3 / ON FIRE x5 / UNSTOPPABLE x8 / LEGEND x12.
Win: culprits are cuffed one by one, stars drop, an evidence sticker is stamped. Loss: "So close: 3 people left", instant retry.

## Mechanic plan (statement families unlock in order; each case's spec names its focus)
World 1 · Maple Street (1-10, 3x3 to 4x5, all true): direct naming (1) · row counts (2) · columns (3) · neighbours (4) · my-row (6) ·
neighbours of a stranger (7) · HARD 8 (no names) · breather 9 · BOSS 10.
World 2 · Harbor Docks (11-20): jobs (11) · pairs both/one (13) · odd/even (15) · more criminals/innocents (16) · above/below/left/right (17) ·
corners, edges, "at least" (18 HARD) · breather 19 · BOSS 20.
World 3 · Grand Hotel (21-30): CRIMINALS LIE (21): a criminal's statement is false; the card shows a LIES tag. Then lies with rows (22),
neighbours (23), jobs (24), pairs + parity (25), majority + directions (26), all families (27), HARD 28 (nothing named), breather 29, BOSS 30.
After 30: Cold Cases, generated (same families, liars every other block of 5, rising chain length).
First 3 cases: 1-2 cannot be lost (`safe`), a hand shows the first provable card, case 3 is the first that can be lost.

## Meta
- Case map: 3 worlds x 10, evidence stickers (30 emoji) with stars, HARD/BOSS/LIARS marks, next case pulsing, linear unlock.
- Stars (clean = 3, 1-2 slips = 2, more = 1) feed 7 ranks (Rookie ... Legend) with a progress bar.
- Hints are a resource: start 3, +1 per clean solve, +2 per rank, +3 per world cleared. Cap 9.
- Case of the Day (seeded by date, same for everyone, liars on even dates) with a streak.
- Board: "Cases solved", +1 per first solve of a case (same scale as v1).

## Feel list
Flip + pitch-climbing chime; sparks grow with streak, ring at 3+; confetti at 5+; liar reveal gets a low buzz; cuff sequence with rising
square tones; star drop with ding; sticker stamp; rank bar fills; hand + idle nudge; hint wiggle after 25 s stuck.

## Files
game.js (switch) · v1.js (untouched v1) · deep.js · dlogic.js (grid-size-free solver, clue families, liar rule) · levels.js (baked)
· qa/specs.mjs (the 30 hand-drawn cases: truth grid, start, families, focus, purpose) · qa/bake.mjs (spec to solver-checked puzzle)
· qa/playall.cjs (all 30 + cold + daily through the real game, lose/retry/persistence) · qa/shot.cjs (phone screenshots).

## Status (cycle 1, 2026-10-29)
Built and QA'd: all 30 cases chain-verified at bake time and solved through the game by the bot (0 mistakes); cold cases and
daily solve; lose/retry, reload persistence, desktop + phone layouts, no console errors.
Left: fresh replay + critic gate (FUN_REVIEW.md, PLAYBOOK section 0), tune from the critic, smoke.mjs + fps on the Mac,
ship ticket (READY true only after the gate passes).
