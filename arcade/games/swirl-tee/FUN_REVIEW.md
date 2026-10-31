# Swirl Tee: fun review (critic gate, round 5, 2026-10-31)

Played cold as a new player, about 10+ minutes per version, fresh Chrome contexts (390x844 touch, real mouse down/move/up, no `__game.bot`).
Non-127.0.0.1 requests got 204. Video/screens in /tmp/critic-st2 (deleted afterwards).
- v1: levels 1-3 played, 2 deliberate losses (wrong fold, half-painted), 1 sloppy spiral loss.
- v2: orders 1-7 cleared; order 3 lost twice on purpose (wrong fold/scribble, then "so close"), order 5 (rings) lost once, order 7 (burst) lost once, free-dye order 6, new BURST fold at order 7 seen, order 8 (4 folds) seen.

## FPS (software GL)
v1 about 25 fps, v2 about 24-27 fps (rAF count over 5 s; dropped to 17 with both browsers open). Under 30 on both. Box has no GPU, so it is not a phone number.

## Scores (0-10)
| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 5 | 8 |
| 2. Toy | 6 | 8 |
| 3. Almost | 4 | 7 |
| 4. One-more | 5 | 8 |
| 5. Surprise | 4 | 7 |
| 6. Mastery | 3 | 7 |
| 7. Tomorrow | 4 | 7 |
| **Average** | **4.4** | **7.4** |

v2 beats v1 on every test, average 7.4, lowest 7.

## Did the changes land?
- Thin-ring aim help: mostly. A sloppy yellow ring stroke 3-5 px off landed. But my first rings attempt on order 5 still missed the inner blue ("middle only 29%"); thin centre rings are still the hardest part, though now a fair miss and the second try cleared.
- Live chip under the target card: yes, the best addition. "50/65% CLEAN" -> "92/65% CLEAN", "13/89% SPILL 27%". It teaches while you dye and I used it to decide when to press the green check.
- Par x1.8: yes. Order 1 (9s/22s) and 2 (14s/22s) gave 3 stars. Order 3 (77% sharp, 5s) gave 1 star: stars now depend on SHARP, not on time, which is readable. Order 5 showed 32s/23s, over par, but I never felt cheated.
- Three win-card chips (SHARP / time / CLEAN or SPILL): yes, readable and it tells you which star you missed.
- Retry straight to the dye step: yes, under 1 s, same fold kept. v1 sends you back to fold choice, which kills momentum.
- Loss honesty: v2 "SO CLOSE! 3% short" only at 3% short, "NOT YET" at 12-13%. v1 still says "SO CLOSE" at 51 vs 65 and 59 vs 81, which is a lie.

## Remaining problems
- NEED falls silently after a loss: order 3 went 89% -> 69% after one loss, order 5 83% -> 82%. A 20 point drop is not hidden, and it reads as a glitch.
- Order 1 (and a sloppy order 2, 92%) hands out 3 stars for almost nothing. Early stars feel unearned.
- Fold button taps right after the level card sometimes did nothing for several seconds (fold stays highlighted, nothing happens; seen in both versions at 24 fps, 3 times). A new player would tap again and maybe pick a different fold.
- Order 3 first loss reported "0% MATCH" when I had painted 13%: harsh.
- Free dye (order 6) is a delight but you can 3-star it by barely touching the shirt.

## First 2 minutes of v2, beat by beat
1. 0:00 Title SWIRL TEE over the yellow stall table, shirt, pink and blue bottles, target card "NEED 60%". Tap.
2. 0:04 One pulsing STRIPES button, "Tap STRIPES below". No thinking.
3. 0:06 "RUB THE SHIRT!": circle the thumb, the cloth bunches into a tight bundle with a centre seam.
4. 0:10 Dye screen: pink and blue bottles, sponge, water drop (2), green check, 21 s timer, chip "0/60% CLEAN". One pink swipe fills a whole half with fuzzy dye (50%).
5. 0:14 Blue swipe, shirt unfolds: pink over blue with a white seam, "CLEARED!", 3 stars, "100% MATCH", chips 100% SHARP, 9s/22s, CLEAN. Very satisfying.
6. 0:20 Order 2: customer with red hair, two folds (SPIRAL, RINGS), a gold circle in a purple shirt on the card.
7. 0:35 Rub, dye step with ring outline, yellow center, chip jumps to 92/65% CLEAN, tap green check.
8. 0:45 Reveal: gold sun in purple, 3 stars at 92%. Chest bar 6/8 stars.
9. 1:05 Order 3: three folds, NEED 89%, spiral with three wedges. I fill wedges sloppily, blue spills into red, "13/89% SPILL 27%". Press done.
10. 1:30 "NOT YET! 89% short, wedge 2 only 0%". Tap: straight back to dye with the same fold (NEED now 69%).
11. 1:55 Second try 66/69%: "SO CLOSE! 3% short, red wedge only 29%". Tap again, fill red, win with 77% and 1 star.

## What the best tie-dye app does in the first 2 minutes that this one still doesn't
The best app (CrazyLabs-style tie-dye) lets the player make a design with no target in the first 30 s, with real squirting and multiple colours mixing, and the reward is a shirt you keep, wear on a character and show. New tools (glitter, bottles, patterns) arrive every minute and the shelf of your shirts is the home screen. Here the first minutes are on rails (one fold, two colours, a rub that mostly plays itself), the keepsake is a thumbnail on a tiny strip, and the hard target percent still drives every round; no sound or haptic hook was testable here.

## 5 biggest fixes in order
1. Fold buttons must always respond: debounce/ignore-lag bug after the level card (taps swallowed, fold stuck highlighted).
2. Make NEED honest: show a visible "easier: NEED 69%" with an animation, and cap the drop at 3-5 points; never 20.
3. Give order 1-2 something to earn: make 3 stars need a decent time/clean, and let the first rub not paint half the shirt.
4. Make a shirt a keepsake: save/share a finished shirt, a shelf/wall you can open, with the nearest empty slot shown after a loss.
5. Keep thin rings fair: highlight the target ring on the bundle while dyeing, and stop showing "0% MATCH" when I painted 13%.

Verdict: TEST
