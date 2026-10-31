# Core Crusher FUN_REVIEW (critic gate, 2026-10-31, fourth pass, overwrites earlier ones)

## Numbers
| Measure | v1 | v2 (?deep=1) |
|---|---|---|
| fps (rAF count, 5 s, at start, load avg ~0.5) | 7.3 | 6.3 (second run 7.5) |

Software GL (swiftshader), 390x844, so far below 60. v1 and v2 are about equal here; nothing measured on a real phone. At 7 fps I cannot judge hit timing, sound or true feel; feel scores come from the video, screenshots and the on-screen callouts. Judged as it would play at 60 fps.

## How I played
New player, Chrome, phone viewport, touch (CDP touch events), Playwright video, every non-127.0.0.1 host blocked, nothing posted. About 10 min per version. First 110 s: random hold/release with a finger. After that the in-game `__game.bot()` with 15% of decisions skipped, standing in for a learning player (a real human cannot be timed at 7 fps). Win rates after 110 s flatter both versions. No page errors in either run.

v1 reached level 11 (the run won 1-5, then lost 6 five times in a row, lost 9 and 10 twice). v2 random-finger phase cleared L1 four times in a row (about 25 s each, never lost); the bot then cleared L1-9 and lost the L10 boss three times (one attempt ran about 3 min, 92% down).

## First 2 minutes, v1 (beat by beat)
0 s: teal screen, blue tower, "CORE CRUSHER" title, hand "Hold to smash". No menu. 9 s: first press, rings shatter, score ticks, the ball catches fire at long holds. 16 s: first death, a black slice arrives with no warning, "CRASHED! 34% crushed, Tap to retry". 23 s: retry in one tap. 36 s: L1 won, new colour. 58 s: L2 won, 79 s: L3 won. 88 s: L4 first loss at 9% (reads as unfair, black slices look the same as the ones before). 2:00: L5 reached. Same tower, new palette and slice shape, no goal beyond the next number. Quick and clean, but nothing new is ever asked of you.

## First 2 minutes, v2 (beat by beat)
0 s: opens inside L1 with the tower already there, "CANDY HILL - Warm-up", gold rings, a hint "HOLD to smash - LET GO at black". No menu. 9 s: finger down, speed lines, rings break, score and par timer ("9s - 3 star 9s") run. First black slice: "PHEW! SAVED" mercy bounce instead of a death. 25 s: CLEARED card with 2 stars, "chest 2/3 stars", "DAILY DIVE ready", big NEXT button. 30 s: next try. 2:00: L1 to L2 to L3 to L4 (flame), each tower introduces one thing, bigger rewards on the card. By 5 min: L7 "Fast hands" with reversals, L10 boss "CANDY KING" with a dense black tower and a "SO CLOSE - 92% down - A black slice came round" card. The 10th minute is not the 1st.

## Seven fun tests (0-10)
| Test | v1 | v2 | Why |
|---|---|---|---|
| 1. 10-second | 6 | 8 | v1: first smash around 9 s but no reward beat. v2: smash plus gold rings, par timer and callouts at once. |
| 2. Toy | 6 | 6 | Same verb. v2 adds speed lines and camera work, but I could not hear or feel it at 7 fps, and holding a button is still a thin toy. |
| 3. Almost | 4 | 8 | v1 deaths can come at 9% with no cause shown. v2 names the cause, shows SO CLOSE %, early mercy bounces. |
| 4. One-more | 8 | 7 | v1 tap anywhere to retry. v2 has a result card and a button each time (fast, but one more tap and more reading). |
| 5. Surprise | 3 | 7 | v1 only recolours. v2 adds gold, flame, reversals, boss. Holes, blinkers and steel were not reached by my run (L11+). |
| 6. Mastery | 3 | 7 | v1 shows only best score. v2 has stars, par time, no-crash star, chest progress. A random finger 3-starred nothing but cleared L1 four times, so L1 has no skill gap. |
| 7. Tomorrow | 2 | 7 | v1 nothing. v2 has chest at 2/3, Daily Dive, map, skins. No streak pressure seen yet. |
| Average | 4.6 | 7.1 | |

## What the best app-store game in this genre does that this one still doesn't
The top stack-tower drop game (hold to smash coloured rings) wins its first 2 minutes with feel, not content. The ball is a toy: every ring has a loud, pitched crunch, the combo counter climbs on screen with the tower, a streak turns the ball to fire and the screen explodes, and failure is a sliver of black the player clearly saw coming. Levels feel handmade because the black slices form readable patterns (a gap you can aim for), not walls. And the camera and tower rhythm are tuned so a 3-second hold is always a decision. Ours: black reads as noise from above (v1 especially, and the v2 boss is a wall of black), the fire state lacks a loud payoff in the first minute, the fever/combo escalation is not visible until combo 10, and nothing in L1-3 asks a decision a skilled player does better than a random one.

## 5 biggest fixes, in order
1. Make L1-3 reward skill: a random finger cleared L1 four times in a row. Add a 3-star condition that a random player cannot reach (perfect streak, fire ring count) so the first stars mean something. (Mastery, Toy)
2. Make the toy louder: a pitched, rising crunch per ring, a visible combo counter from combo 2, a fire burst at ignition. Verify on a real phone at 60 fps; I could not. (Toy, 10-second)
3. Tame the boss and late towers: L10 is a near-solid black wall; one attempt ran about 3 minutes and ended at 92%. Cut black density or add a checkpoint so a loss is "one slice off", not a 3-minute reset. (Almost, One-more)
4. Cut dead time between tries: the result card should auto-dismiss or accept a tap anywhere, as v1 does; keep the cause line and SO CLOSE but retry in under 1 s. (One-more)
5. Show the tomorrow hook at the moment of loss and win: chest "1 star away" on the crash card, and a Daily Dive streak count. Also measure fps on a real mid-range phone before READY. (Tomorrow, Surprise)

Verdict: TEST
