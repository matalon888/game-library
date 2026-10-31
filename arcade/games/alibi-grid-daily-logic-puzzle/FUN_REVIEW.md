# Alibi Grid: fun review (cold critic, 2026-10-31, second pass)

Method: Chrome headless via Playwright, 390x844 touch (hasTouch, DPR 2), video + screenshots, every non-127.0.0.1 host blocked, no console errors. v1 and v2 (?deep=1) each ran about 10.9 min of real time in two sittings that share one profile (a first 10-min run was killed at ~5 min when something else on the shared box closed Chrome). v1 reached case 18, v2 reached case 13, plus a direct jump to case 21 (Liars) for a look.
Caveat on how I played: in v2 I really tapped card, then Innocent/Criminal, after a 1-2 s "reading" pause, but my script knew the truth grid, so it tried cards until one was accepted (about 550 "Right, maybe, but not proven yet" refusals, all free). A human would burn real thinking time there. In v1 a test hook did the provable marks and I added real taps for pokes and one hint. So I judge feel and structure, not human solve difficulty. I forced a 3-mistake loss in v2 (case 9); I never saw one in v1.

Frame rate: avg 58.9-59.6 fps in both versions, p95 frame 16.8 ms, p99 16.8-33 ms, worst single frame 83-200 ms (a handful of frames). Nothing under 30 fps. This is desktop headless Chrome, not a real phone; low-end Android is unverified.

## Scores (0-10)

| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 4 | 7 |
| 2. Toy | 5 | 7 |
| 3. Almost | 5 | 7 |
| 4. One-more | 4 | 8 |
| 5. Surprise | 3 | 6 |
| 6. Mastery | 3 | 7 |
| 7. Tomorrow | 4 | 7 |
| **Average** | **4.0** | **7.0** |

v2 average: 7.0. Lowest v2 test: Surprise (6). v2 beats v1 on all seven.

Why:
1. v1 opens on a dark "Tap to open the case" wall of text and a Daily Challenge card, then a 4x5 board with about 8 clue lines. The first satisfying flip is 6-8 s after the tap and needs reading. v2 drops you on a 3x3 board with one card already green and a pointing hand; the first flip, sparkles and chime land around 4-5 s. Still a puzzle: the "pop" is a reward for thinking, not an instant hit.
2. v1 flips are pleasant but a bit dull and silent-feeling. v2 has a pitch-climbing chime, sparkle ring, "SHARP x3" pop, a wobble and "not proven yet" toast for a right-but-unproven tap. Twenty rapid taps on cards mostly open the ask sheet, so the pure toy is the ask-sheet dance (card, then button), not bubble wrap. Fine, not great.
3. v1: a wrong mark shakes the card and costs a life, with no explanation. v2: the loss card says "You could have proven Lark from Rue's clue" and "4 of 20 cleared", which makes the loss feel like my miss and teaches the skill. That is the best single idea in the game. Held back by: no undo, and the first two cases cannot be lost so you never feel the sting early.
4. v1: win overlay needs a tap-to-continue, and next case is on a 4x5 board of reading. v2: "Next case" and a retry button are one tap, the retry loads at once, case 1 was 19 s. The win card text wraps awkwardly ("Next case" breaks onto two lines) but it is fast.
5. v1: cases 1-18 are the same 4x5 board with different names; the only change is statement types (pairs, rows) creeping in. v2: a new clue family per case (rows, columns, neighbours, jobs, pairs, parity), a HARD flag, and Liars in world 3 (I saw case 21). Good ideas, but within the 11-13 cases I played nothing random happened: no golden target, no bonus room, no twist mid-case. The streak counter climbs to x15 for free because careful play cannot break it.
6. v1 shows time, points and nothing else, so I cannot tell I am better. v2 has 3 stars per case (clean = 3, slips cost stars), a time, a best streak, ranks (Rookie to Detective in 13 cases) with a bar and "2 stars to Inspector". Visible, though "best streak" is meaningless when guessing is refused.
7. v1 offers only the daily card. v2 has the case map with next case pulsing, a Case of the Day, 30 locked cases, rank bar nearly full (Detective, 2 stars to Inspector at the end of my session), hints earned by clean play. A clear unfinished thing. No streak-keeping hook after a missed day was visible.

## First 2 minutes of v2, beat by beat (case 1, "The Missing Pie")
- 0:00 Page loads straight into the board. No menu, no splash. 3x3 grid of cartoon suspects (Abel the baker, Gus the pilot...), three empty mistake rings, a trophy chip top left, a 3-hint lightbulb.
- 0:00-0:02 A big serif "CASE 1 / The Missing Pie" title fades over the grid, with a pointing-hand emoji parked right on the title text (hand and title collide). Yuki the doctor is already green "INNOCENT" with a clue "Yuki: Mae is innocent".
- 0:02-0:04 The hand slides to Mae. I tap Mae: a small dark sheet asks "Is Mae the pilot innocent or a criminal?", with big green and red buttons.
- 0:04-0:06 I tap Innocent: card flips green, sparkle ring, a chime, and Mae's own clue ("Mae: Otis is a criminal") slides into the clue list in a yellow highlight. That is the first real hit.
- 0:06-0:12 Otis (criminal) and Gus (innocent) follow in a chain; "SHARP x3" pops red across the middle of the board and the timer shows 0:06 with a fire x3 combo. If I try an unproven card, the card wobbles and a toast says "Right, maybe, but not proven yet".
- 0:12-0:19 The rest of the 3x3 clears, the streak reaches x8, and it ends in two criminals caught.
- 0:19-0:22 Win card: three big stars, a "New evidence" key sticker, "+1 hint for a clean solve", rank bar "2 stars to Constable". Buttons: map, retry, Next case.
- 0:22-0:25 I tap Next case. Case 2 begins at once. By 1:30 I am on case 3 with a larger board and a new clue kind. By 2:00 I have solved cases 1-3 with three stars each.
It is smooth and very legible. It is also slow-ish per mark (reading clues) and unusually quiet in the middle: between flips there is nothing to look at.

## What the best app-store game in this genre does that this one still doesn't
The best logic-deduction games (Tiny Sudoku and Logic-grid apps, "Zachtronics-style" clue puzzles, and the genre leaders for minesweeper-style deduction) get a tangible reward every few seconds without reading a paragraph: a cascade that opens a whole region, a "domino" of forced moves lighting up in sequence, an instant undo, and a hint that points at the forced move and explains why. In its first two minutes the best game gives you a board-wide cascade on mark 3-4, then a surprise (a second mechanic, a locked cell, a rare "perfect" bonus) in minute 2, and ends each puzzle with a share-worthy summary. Ours: one card pays off at a time, nothing cascades (a proven mark does not auto-light the next provable card or draw an arrow from clue to deduction), there is no undo, no auto-mark of the obvious, no variable reward, no daily-streak hook in the first minute, and the clue text wall competes with the grid for attention.

## 5 biggest fixes, in order
1. Surprise (lowest score, 6): add variable rewards and mid-case twists inside cases 1-13. A golden suspect with a 1-in-N jackpot, a "perfect chain" bonus that triggers a short cascade, and one scripted twist per world (a liar teaser, a locked card, a timed cold-case clue). Right now minute 10 feels like minute 1 with new wording.
2. Make the streak and combo mean something. Careful play can never break it (x15 in one case), so "UNSTOPPABLE" cannot be earned. Tie it to speed or to chains (deduction N depends on deduction N-1), or reset it when you pause too long, so a fast chain is a visible skill.
3. Cascade and chain feedback: when a mark makes the next card provable, draw a thread from the clue to the newly provable card, pulse it and play a rising run. Also let a clue tap point to the cards it resolves. This makes forced chains feel like dominoes, not paperwork.
4. First-ten-seconds polish: move the pointer hand off the title, drop the case-title overlay to under a second, and cut the ask sheet into a single swipe or long-press so the core action is one gesture (card tap plus two giant buttons is slow to repeat 20 times).
5. Tomorrow and loss polish: add undo for a wrong mark (or a "spend a hint to take it back" option), a visible next-day hook on the win card (daily streak count, tomorrow's case teaser), and fix the layered UI on the case map (the kit level bar and a "Play next case" pill overlap the rank panel in my screenshot). Also fix the wrapped "Next case" button text.

Verdict: TEST
