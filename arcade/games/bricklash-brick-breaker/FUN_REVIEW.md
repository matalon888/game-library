# Bricklash FUN_REVIEW (critic run 2026-11-01 ~14:35-14:57, cold replay, game.js of 2026-11-01 10:05, levels2.js of 13:22)

**FPS: valid run, nothing under 30.** requestAnimationFrame counter, 5 s windows, about 123 samples per version:
v1 avg 59.6 (min 57.3), v2 avg 60.0 (min 57.3). No page errors in either.

Method: Chrome (Playwright, channel chrome, headless), 390x844 touch context, DPR 2, every non-127.0.0.1 request aborted, video plus a
screenshot every 30 s, 10.5 min per version (v1 = `index.html`, v2 = `?deep=1`), fresh save. Start, NEXT and TRY AGAIN were real touch
taps. The paddle was steered by the game's own `__game.bot()` (default error rate, so a clumsy newcomer: worse than a human on aim,
quicker on reaction, never plans around power-ups). Sound cannot be heard headless, so audio judgments come from the code and visuals.
A first v2 harness pass got stuck on the win card (my script, not the game) and was discarded; the numbers below are from the clean rerun.
Game code not edited.

Run facts.
- v1: 18 runs in 10.5 min, every one lost; best 490, typical 30-290, runs 11-80 s, 35-71 of ~68-76 bricks always left. No board is ever cleared.
- v2: L1 cleared at 1:30 (2 stars), L2 lost once (2 bricks left) then cleared at 3:52 (2 stars), L3 lost once (6 left) then cleared at 6:05
  (1 star), L4 lost 3 times (13, 2, 12 left) then cleared at 7:43 (2 stars), L5 lost twice (6, 3 left) by 10:00. 4 levels cleared and a
  fifth almost, in 10.5 min. Near-misses ("2 left", "3 left", "6 left") are frequent and feel earned.

## Scores (0-10)

| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 6 | 7 |
| 2. Toy | 5 | 6 |
| 3. Almost | 4 | 7 |
| 4. One-more | 6 | 8 |
| 5. Surprise | 3 | 7 |
| 6. Mastery | 3 | 7 |
| 7. Tomorrow | 2 | 8 |
| **Average** | **4.1** | **7.1** |

Why: v1 is an endless wall of ~70 bricks with 3 balls, so every run dies with 35-70 bricks left. Nothing is ever "almost", nothing changes,
nothing is left over. v2 has authored levels (sparse 16-29 brick shapes, metal 2-hit bricks, star bricks, moving bricks, lasers), a
"SO CLOSE" loss card with the bricks-left number, a 1-tap TRY AGAIN, stars, a chest every 10 stars, a map and a Daily Lash.
The toy feel (test 2) is the weakest part in both: ball, trail and paddle are clean but the hit is not weighty; I could not hear sound, and
the bricks do not squash or ripple. That is a 6 for v2, not higher.

## The first 2 minutes of v2, beat by beat
1. 0:00 Dark title card, "BRICKLASH", one line of instruction, "Tap to play". Clear, but static: nothing moves on it.
2. 0:02 Tap: straight into Level 1 "First Light", a small bold cluster of ~26 bricks, ball stuck to the paddle, "TAP TO LAUNCH" hint. No tutorial wall.
3. 0:03-0:10 Launch, first brick breaks within seconds, score ticks, capsules (3x, F) drop. Satisfying but quiet: small particles, no shake.
4. 0:10-0:50 Catch a capsule (multi-ball, fire, laser), balls multiply, a short chain pop-up. Best stretch of the first minute.
5. 0:50-1:30 Last bricks are the slow bit: a lone ball hunts leftovers for ~30 s. The "last brick" tension is there but the pacing sags.
6. 1:30 Level clear: confetti, flash, 2 stars, score, "+2 stars, 8 stars to the next chest", a teaser for level 2 ("grey-white frame = 2 hits").
   This is the strongest beat: it teaches and sets a goal in one card.
7. 1:32 NEXT, Level 2 "Two Hits" starts at once with metal bricks, a new idea. Still no loading, no menu in the way.
8. 2:00 Level 2 mid-run, second ball up, "LAST BALL!" warnings start to appear on harder levels.

v1 first 2 minutes: title card, tap, a full wall of 70 bricks, a few pops, ball lost by 0:17, "tap to play again", repeat. By minute 2 you
have lost 3 times with 46-62 bricks standing. The 2-minute experience is the same as the 20-second one.

## What the best brick-breaker on the store does in its first 2 minutes that this one still doesn't
- **Weight and sound.** Every brick hit has a distinct, rising-pitch tone and a visible kick (brick wobble, paddle recoil, ball squash); the
  combo ladder gets louder. Here the hits feel light and the combo escalation is mostly text.
- **A guaranteed big moment in minute 1.** The best games give a scripted power-up or an explosive brick in the first level, then a
  screen-filling cascade. Ours gives capsules at random and the first big moment is the clear card at 1:30.
- **Never a slow end.** They steer the last few bricks (magnet, auto-aim, a finisher ball). Ours leaves one ball hunting for 30 s.
- **A fresh visual world every few levels** (new palette, background, brick art). Ours is the same dark grid and neon bricks at level 5 as at level 1.
- **A sense of the player's own skill.** Angle control from where the ball meets the paddle is shown (aim guide on launch). Ours shows
  only a hint, so a new player has no idea why a shot went where it did.

## The 5 biggest fixes, in order
1. **Hit feel and sound (test 2, the lowest v2 score).** Pitch-rising brick tones, brick wobble/ripple, paddle recoil, a small screen
   kick on 3+ chains, a short hit-stop on metal bricks. This lifts every test.
2. **Speed up the end of a level.** When 3 or fewer bricks remain, add a gentle ball magnet toward them or a one-time "finisher" ball, and a
   "LAST 3!" call-out. Removes the 30 s sag in minute 1.
3. **Smooth the difficulty wall.** Levels 3-5 cost 1-3 retries each; L4 cost 3. Fine for a clumsy bot, but a new human may bounce
   off. Give a free extra ball or wider paddle after 2 losses on the same level, and tell the player so.
4. **Guarantee one spectacle early.** Put an explosive or star-burst brick in level 2 or 3 and a guaranteed capsule in the first 10 s of
   level 1 so test 1 and test 5 both reach 8-9.
5. **Change the look by world.** New background colour and brick style per world, plus the first aim-guide line on launch, so minute 10 is
   visibly not minute 1 and the player can learn the angle.

Note on v1: it is a clean shell but a dead end; do not keep it as the A/B control without at least starting it with a smaller, clearable board.

Verdict: TEST
