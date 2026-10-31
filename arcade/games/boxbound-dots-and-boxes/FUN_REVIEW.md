# Boxbound FUN_REVIEW (cold critic play, 390x780 touch, Playwright/Chrome)

Played v1 (Easy/Normal, 4x4 and 5x5 grids, ~15 games, ~7 min plus a Normal loss) and v2 (?deep=1, pages 1-17, ~9 min; page map, hint panel, daily goals). Measured 60 fps in both (rAF, 2 s). Rematch/Again restart: about 140 ms.

## Scores (0-10)
| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 3 | 8 |
| 2. Toy | 5 | 7 |
| 3. Almost | 3 | 7 |
| 4. One-more | 5 | 7 |
| 5. Surprise | 2 | 7 |
| 6. Mastery | 3 | 7 |
| 7. Tomorrow | 3 | 7 |
| Average | 3.4 | 7.1 |

## First 2 minutes, v1
1. Blurred title card: Boxbound, Easy/Normal/Hard, grid chips, "Tap to play". Clean, but a menu before any action.
2. First tap draws a line; nothing satisfying until the first box, 6-10 moves later. The board starts empty, so ~20 s of lines that do nothing.
3. The CPU replies fast. The "gives N" preview when holding a line is a good teaching touch but easy to miss.
4. First box: small pop, "Box! Draw again". Mild.
5. On Normal I lost 2-23 on 5x5 with no explanation of chains or sacrifices: feels cheated, not close. On Easy I won 10-6 and 16-0 with no thought: boring.
6. Minutes 1-2: a loop of identical ~23 s games; nothing evolves.

## First 2 minutes, v2
1. Opens straight on a board (no menu): page 1, a pre-drawn 3x3, "Close the boxes".
2. About 8 taps later the whole page is cleared; a giant x3 combo slams across the board with box pops. Payoff in ~8 s.
3. Result card: 3 stars, "Perfect page!", New pen: Teal, daily goals ticking, Next page.
4. Page 2 teaches "do not open a box for the computer"; pages 3-4 safe lines then chains. One idea per page.
5. Page 5 is the first 4x4; "CPU chain x6" callouts appear later and sting.
6. Pen unlocks, gold 2-point boxes, the computer going first, "win by N for 3 stars" targets: something new every 2-3 pages.

## Honest notes
- v2 is a real step up: pre-made positions remove the empty-board dead start, combo spectacle is big, stars/pens/daily give tomorrow reasons, defeats come with an "Idea:" line.
- Pages are 8-10 s and easy: a naive bot (take free boxes, avoid third sides) got 2-3 stars on almost every page up to 16; the first real resistance was a draw on page 17. Skill ceiling is low early.
- Toy feel is OK (line anim, ghost line, pops) but lines are thin and not tactile.
- Page map sheet is translucent and the board bleeds through it.
- v1 never explains why you lose.

## What the best app-store game in this genre does in its first 2 minutes that this still does not
- A tiny first win with a characterful animated reaction (squash/stretch ink, escalating audio per chain), not only a number and a card.
- A hard decision inside the first 30 s, and a CPU that visibly threatens, so near-misses feel earned.
- A replay of the missed sacrifice on a loss, not text.
- A streak/login reward and a visible next-unlock bar on the home screen so quitting mid-way hurts.

## 5 biggest fixes (in order)
1. Raise v2's early difficulty curve: a real CPU trap on pages 3-4 so greedy play fails and stars need thought.
2. Show the missed move on a loss/draw (highlight or replay the winning sacrifice); "Idea:" text alone is weak.
3. Stronger tap feel: thicker animated ink with squash, distinct sound per box and per chain length, haptics, a fever state after a 3+ chain.
4. Fix the page-map bleed-through and add a near-miss nudge on exit ("page 17 is one box away").
5. v1/shipped path: drop the menu-first start, add pre-drawn starts and loss explanation, and soften Normal for a first game (adaptive CPU).

Verdict: TEST
