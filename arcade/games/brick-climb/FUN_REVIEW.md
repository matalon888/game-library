# Brick Climb: FUN_REVIEW (critic gate, run 3, 2026-11-01)

Method: Playwright + system Chrome, 390x844 touch, video + screenshots, non-127.0.0.1 aborted. v2 (`?deep=1`) ~11.5 min, v1 ~2.5 min (v1 scores from run 2 stand; re-checked: it still shows the false "So close! Grab more bricks." on a 0-brick loss).
v2: ~70 s of CDP touch drags/taps by me, then `__game.bot()` with a harness that clicked only Next/Play buttons. Retry never tapped; after a loss I called `__game.go(level)` after a 4 s dwell (manual restart, not an auto-Retry tap).
Honesty notes: (a) my blind hand drags collected 0-1 bricks and lost L1 (2nd place) both runs, so hand-play evidence is thin; (b) no audio heard, so Toy/10-second rest on visuals; (c) per-pick camera kick is a few frames, I judged it from stills and motion, not feel on a real phone; (d) the 0.6 s card-text capture missed two loss cards' text, I read them from screenshots.
Progression: bot cleared v2 levels 1-14 (stars 2-3, 12 cards with "Next" auto-advance countdown), lost L8 twice and the L10 boss twice before beating it (2 stars). New since last run seen: sweeper bars (L11-12), bombs (L13-14), second world map, CHEST pops incl. "JACKPOT!" at L7, a "1 STAR FROM A CHEST!" meter on win cards.

## FPS
rAF over 5 s, headless Chrome software GL (swiftshader): v2 28.0 (hand) / 25.4 (bot); v1 31.4 / 23.8. **Under 30 on v2: noted.** Not a phone number, but v2 is not proven 30+. No page errors.

## Scores (0-10)
| # | Test | v1 | v2 |
|---|---|---|---|
| 1 | 10-second | 5 | 7 |
| 2 | Toy | 5 | 7 |
| 3 | Almost | 3 | 7 |
| 4 | One-more | 5 | 7 |
| 5 | Surprise | 2 | 8 |
| 6 | Mastery | 2 | 8 |
| 7 | Tomorrow | 3 | 7 |
| | **Average** | **3.6** | **7.3** |

Why (v2):
- 10-second 7: GO plus bricks around you, streak bar and callouts come fast for a player who aims, but a new player who doesn't aim gets 0 bricks and "NEED BRICKS!" for 30 s: no reward at all. A first pick is guaranteed only if you move right.
- Toy 7: stack on the back is chunky and grows visibly (a 15+ stack towers over the runner), pop and kick make picks readable. Still no brick-flight arc into the stack, and the pickup size on a stack of 3 is modest.
- Almost 7: the loss card now names the cause: "knocked 5x on the way: dodge the red ones", "carried only 0 bricks: grab more", plus steps-from-top. Real improvement, and v1's lie is gone. But "24 steps from the top" or "carried only 0" does not feel "close", and two hint lines can stack awkwardly (rival faster + carried 0). The "Nearly!" branch I never saw.
- One-more 7: Again is a big green button, win cards count down "Next 4" and auto-advance. Loss still needs a tap, and the card sits ~0.6-1 s before buttons are usable; Map button beside Again adds a choice.
- Surprise 8: new element every 1-3 levels (gold, bump, 3 floors, hoarder, head start, boss, sweepers, bombs, minefield, jackpot chest). 10th minute is clearly not the 1st.
- Mastery 8: 1-3 stars with a named third-star goal, best streak, time, "(0/1)" progress on the missed goal.
- Tomorrow 7: chest meter ("1 STAR FROM A CHEST!"), daily #2 with a day streak on every card, locked world 2. Nothing is a session goal and no near-full collection nag beyond the chest.

v2 beats v1 on every test; v2 average 7.3, lowest 7.

## First 2 minutes, beat by beat (v2)
0-2 s title with no promo wall. Tap: GO, 0/8 pill, goal line with star condition. 5-35 s my hand drags: runner moves, joystick-free, a few picks at best, "NEED BRICKS!" nag, rivals already building stairs. ~36 s 2nd place loss card: "RED WON, 8 steps from the top, carried only 0 bricks". Restart; bot wins L1 in 7 s with x8 streak, win card with 3 stars, chest meter, "Next 4" countdown. L2 two floors, chest "Plum" colour unlock. L4 GOLD RUSH. By minute 2 the player has seen a chest, a new colour and three level rules.

## What the best app-store game in this genre still does that this one doesn't
(1) The first touch is always rewarded: a trail of bricks right under the thumb so nobody loses level 1 with 0. (2) Brick fly-in arcs and a crowd/stack that becomes absurd, with x2/+10 gates as a bold risk choice. (3) Win finish is spectacle (confetti, climb to a gold platform, coin rain); ours is a flat card plus stars. (4) A loss that replays or highlights the exact moment ("you were hit here"). (5) A rewarded variety beat and a real near-complete collection on the end card.

## 5 biggest remaining fixes
1. Guarantee a first-pick payoff: spawn a short brick trail in front of the start position on L1-2 (and show an arrow/hint when 0 bricks after 5 s instead of only "NEED BRICKS!"). Fixes 10-second and the hand-player's first loss.
2. Make losses feel close: show "X bricks short" or "N steps behind" as a gap to the winner and a single best action; drop the "24 steps from the top" framing when it is not near. Merge the two hint lines into one.
3. Brick fly-in arcs to the stack and escalate camera kick/stack pop at streak 5/10 (slow-mo + flash at FEVER) so Toy reaches 8.
4. Put real spectacle on win (confetti, star slam, coin rain ~1 s) and make loss Again usable instantly (buttons live at 0 s, same pixel as Next).
5. Prove 30 fps on a real phone or 4x throttle (28/25 in software GL, v1 31/24); add 3 session-goal chips ("2 knock-offs today") feeding the chest to lift Tomorrow to 8.

Verdict: TEST
