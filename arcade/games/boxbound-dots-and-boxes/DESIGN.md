# Boxbound: deep v2 design

deep v2: in progress (built 2026-10-31 lane 83, READY false; fun gate not run yet, fresh replay + critic next cycle)

## What it is
Dots and boxes on notebook paper: draw a line between two dots, close a box to claim it and draw again. v1 = one open match vs a CPU on 4x4/5x5/6x6.

## The five layers (0-3), v1 -> v2
| Layer | v1 | v2 | Note |
|---|---|---|---|
| Core verb | 2 | 3 | Same drag/tap line. Added: chain escalation (rising chime, TRIPLE, CHAIN xN, confetti at 5), gold boxes (worth 2, sparkle + GOLD +2), hint that shows the exact best line. |
| Core loop | 1 | 3 | v1: one long empty-board match, win/lose card. v2: a page is a mid-game position (3-11 min of thinking compressed to 1-2 min), you choose when to stop taking boxes and who opens the long chain. Instant retry. |
| Level design | 0 | 3 | 30 preset pages (`levels.js`, `why` line each) found by `qa/gen.mjs` and kept only when the exact solver (`qa/solve.mjs`) proves: a win exists, most first lines lose (share of winning first moves 5-60%, falling per world). |
| Meta | 0 | 3 | Page map, 3 worlds x 10, stars per page, 12 pens unlocked by total stars (lines and stars use the pen), Daily Page + streak. |
| Feel | 2 | 3 | See below. |

## Worlds
Pencil Case (1-10): 3x3 then 4x4, Easy/Normal CPU, learn safe lines, chains, who opens first. Margin Notes (11-20): gold boxes worth 2, CPU Normal, CPU-first pages.
Final Exam (21-30): Hard CPU (double-cross), 5x5 with half the boxes already claimed.

## Stars
1 = win, 2 = win by max(2, 60% of the best margin), 3 = win by the best margin vs best play ("opt", from the solver) with no hint and no undo.

## First 3 levels
Page 1 starts with free boxes (boxes with 3 sides) so the first line closes a box at once; 3x3, Easy CPU, solver margin 7. Pages 2-4: 3x3, one idea each.

## Meta and tomorrow hook
Pens by total stars 0/3/6/10/15/21/28/36/45/55/66/80. Daily Page: generated from the day number with the same solver rules, same for everyone, first win each day +2 stars and the day streak. Result card and map say what waits tomorrow.

## Feel
Chain pops escalate with the run length; chime pitch climbs along a chain; gold sparkle; CPU chain pop in red with a buzz so an opened chain hurts; stars pop one by one with chimes; hint pulses the best line gold; SO CLOSE line on a loss of 1-2.

## Fairness / scoring
`flow.k()` and the tuner untouched. Board still submits +1 per win (Hard counts 2 in v1 only; in v2 pages `cpu` 2 = Hard). v1 keys untouched, v2 uses `bxd_*` keys.

## Known issues / left
- Hint on a 20-free-line page freezes the UI ~3 s (exact solve in the main thread).
- Easy/Normal pages are easy for a good player (bot wins 1-23); the Hard pages are the difficulty. Watch the lab: if W1 is too easy, tighten shares in qa/gen.mjs.
- Fun gate (critic) not run yet.

## Switch
`READY` in game.js is false: v2 only at `?deep=1`. Set READY true when the fun gate passes (FUN_REVIEW.md).
deep v2: shipped 2026-10-31 (Verdict TEST)
