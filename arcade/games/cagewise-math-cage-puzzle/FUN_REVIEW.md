# Cagewise fun review (critic run, cold play)

Setup: phone viewport 390x844, touch, headless Chrome via Playwright, all non-127.0.0.1 requests blocked. v1 = default, v2 = `?deep=1`.
I played as a new player: tapped squares and the number pad and solved by reasoning from screenshots. v1: levels 1-4 (4x4 easy then medium), then a 6x6 board
with notes/hint/leaderboard. v2: tutorial levels 1-4 (3 stars / 2 stars / 3 / 3), the chest, theme unlock and the map. I then jumped to levels 8, 9, 10, 14 and 15 with
the QA hook `__cg.go` just to see what later levels look like, and did not play those. About 4 minutes of pure play per version; the rest of the 10+ minutes was
thinking out puzzles from screenshots. I did not read the puzzle solutions from game.js. Audio can't be heard headless, so sound is judged from the code (note per number, arpeggio on cage/solve), not by ear.

FPS (requestAnimationFrame over 3 s): v1 60.3, v2 60.3. Both fine.

## First 2 minutes, beat by beat

### v1
1. 0-5 s: Blurry title card, "Cagewise", 4x4/5x5/6x6 chips, Daily Challenge card, "Tap to play". Clear and calm, but it is a menu before play.
2. 5-10 s: Tap, and a 4x4 board with 8 cages appears. No tutorial, no pointer. The rules text is only on the title card. A single-cell cage such as "4" looks like a given, but it is not filled; I had to realise that I must type it.
3. 10-20 s: First number placed gives a small spark burst and a rising chime. A repeat in a row/column turns both squares red at once. Nice instant feedback, but there is no penalty, so a slip means nothing.
4. 20-60 s: Solved 4x4 #1 in 10 s (the puzzle is trivial: three one-answer cages). The cage glow plus confetti plus "Caged!" card: "0:10 · first solve · 300 pts". Good small hit.
5. 60-120 s: "Tap to continue" gives the next puzzle immediately (#2 and #3 still easy, #4 "medium"). No stars, no goal beyond "best 0:10". The only meta is a progress bar 1 -> 2 and a leaderboard that says "offline". The loop is pleasant but flat.

### v2
1. 0-5 s: Opens on a world map: "Cagewise", 0/90 stars, a gift progress bar "8 stars to go", a purple Daily banner, 3 worlds of locked levels with fire/crown markers, a theme collection 1/8 with "?" slots. A lot of promise, but a new player gets a map, not a puzzle. One tap on level 1.
2. 5-15 s: Level 1 "Pine Row" with a pointing-hand tutorial, a 3-star par timer (0:45) and the sentence "Tap a square, then a number". Most squares look pre-filled. They are single-cell cages, not givens, so I nearly believed I was done after filling 7 squares and the game just sat there. Same confusion as v1.
3. 15-40 s: Filling the rest triggers CHAIN x4 ... ON FIRE x13 floating text, big confetti, and "Flawless!" with three stars, "par 0:45, new best, best chain x13", "5 stars to the next chest". This is the best moment in either version.
4. 40-90 s: Level 2 teaches Plus cages, level 3 Minus, level 4 Times (one new idea per level, a real ramp). I made a deliberate mistake at level 2: "REPEAT!" in red, a star dropped, and the end card said "Neat! 2 stars, SO CLOSE: 1 slip cost you a star" with a "3 stars retry" button next to "Next level". That is the "almost" feeling done correctly.
5. 90-120 s: After level 3 the map shows a gift "OPEN". Pick one of 3 chests: "Peach board unlocked", confetti, and the board recolours. Rough edges: the reveal card needed two taps to dismiss (my first tap left the card over level 4 with the timer already running), and the theme icons show as empty boxes in my Chrome (possible missing glyph). Later levels visible by jump: 8 "find the single number", 9 "HARD", 10 "BOSS first 5x5", 14-15 hidden-sign "?" cages. There is real variety ahead.

## The seven fun tests (0-10)

| # | Test | v1 | v2 | Notes |
|---|------|----|----|-------|
| 1 | 10-second | 6 | 7 | v1: first chime and red clash within seconds, but the first puzzle takes 10 s to solve and there is a menu first. v2: map first, then a big payoff by ~25 s, but the first-board look (singletons seem filled) blunts it. |
| 2 | Toy | 7 | 8 | Both: per-number pitch, sparks, red shake on clash, selected-number highlights. v2 adds a chain counter and bigger floating text, so the 20th tap still feels rewarded. Neither has weight or haptic feel I could verify. |
| 3 | Almost | 5 | 8 | v1 has no way to lose. v2 has slips that cost stars, "SO CLOSE", and a 3-star retry button. A hint also costs a star (3 -> 2), which is fair. |
| 4 | One-more | 7 | 8 | v1: tap anywhere to get the next puzzle in under a second. v2: Next / retry buttons are within thumb reach, restart is instant. Docked because of the chest double-tap and the map detour. |
| 5 | Surprise | 4 | 7 | v1: same puzzle shape forever, size is player-chosen. v2: new operation each level, bosses, ? cages, chests with a pick of 3, themes. Docked because early levels (1-4 take about 1-4 minutes) are very easy and the next surprise needs more than 5 minutes of play to see. |
| 6 | Mastery | 5 | 8 | v1: only "best 0:10". v2: stars, par time, best chain, slips shown at the end of every level. |
| 7 | Tomorrow | 4 | 8 | v1: Daily card and a points total. v2: "8 stars to the next chest", 30 levels with 3 worlds, theme collection 1/8, daily puzzle, flame/crown markers. |

v1 avg: 5.4 (38/7)
v2 avg: 7.7 (54/7)

v2 beats v1 on every test. Lowest v2 scores are 7. Average is below 8, so this is not a PASS.

## What the best app-store game of this genre does that this one still doesn't

KenKen-style leaders (e.g. the big sudoku/KenKen apps) win the first two minutes by:
- Starting INSIDE a puzzle with a very short, interactive tutorial. You solve a 3x3 and are taught one cage idea by doing it. We start on a map, and on the first board the single-cell cages look like givens.
- Making the numbers on the board tell you where to look: "naked single" highlight, row/column completion glow, a cage that turns green when satisfied, so the player never wonders if a cell is done.
- Giving hints that teach ("this cage can only be 1+3"), and offering notes that auto-fill candidates. Our hint just drops in an answer and our notes are tiny digits.
- Daily streaks with a visible calendar of days, a rank/league, and rewards that are visible on the home screen rather than a side map.
- Sound and haptics tuned for rhythm, so a quick run of correct answers plays like music (ours: a rising note per number, which is a good start, but nothing builds).

## 5 biggest fixes, in order

1. Make single-cell cages read as empty. In v1 and v2 a lone "4" cage looks like a given and the board seems finished while still unsolved. Draw an empty-box style or a dotted "type me" pulse until filled; auto-mark the first one in the tutorial. This hurts the first 30 seconds most.
2. Skip the map on first launch: go straight to level 1, and show the map after level 1 completes. Today the first screen is a wall of locked circles.
3. Make the early levels harder or faster to escalate. Levels 1-4 can be solved in 6-27 s with obvious singleton cages; slips never happen, so the star system has no tension until much later. Add a 30-second "real" puzzle by level 3 and let hints explain themselves.
4. Fix the chest flow: reveal card must dismiss on the first tap and never leave the level timer running under it; check the theme icon glyphs (they render as empty boxes for me).
5. Put the progress where the thumb is: show the chest bar and "next star goal" on the end-of-level card and a streak/daily indicator on the title, and add a visible "cage complete" colour so the player gets a green tick per cage (also teaches the maths).

v1 avg: 5.4
v2 avg: 7.7
Verdict: TEST
