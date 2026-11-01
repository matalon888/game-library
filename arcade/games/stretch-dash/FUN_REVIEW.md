# Stretch Dash - Fun Review (critic run 6, 2026-11-01)

Method: Playwright + Chrome headless, 390x844 touch (CDP touch drags), v1 = default, v2 = `?deep=1`. One 10.5 min real-time session per version (run in parallel), video + screenshot every 15 s. Every non-127.0.0.1 request aborted. No solver and no `__game.bot`: drags are random lane wobbles, with blind taps at fixed spots when a card is up (like a thumb hunting for a button). `__game.state` was only read to log progress. A random player is a worst case for mastery. Audio not audible headless, so it is not scored. Tests from PLAYBOOK section 0. Media deleted afterwards. I looked at about 18 frames, not every moment; the lose card of v2 I read from code (cause line, "SO CLOSE", rival line) more than I saw it.

## FPS (requestAnimationFrame counts, 25 s of drags, no video, software GL in headless)
- v1: median 59.9 fps, average 49.2 fps, p95 frame 33 ms, worst frame 83 ms.
- v2: median 59.9 fps, average 46.2 fps, p95 frame 33 ms, worst frame 100 ms.
- Neither is under 30 fps. The average dips below 60 are software rendering, so real-phone fps is still unmeasured. v2 is a little heavier (worse worst-frame, 100 ms hitches when slices/particles spawn).

## What happened in the sessions
- v1: L1-L4 in 60 s, L5 took until about 3:30 (about 100 s of failed tries), L6 took from 3:36 to 10:25, with 3 losses seen at the log samples. Final: level 7, 62 gems. The 7 minutes on L6 looked the same as L1: same blue-red gate pairs, same gold-black beam, same orange jelly. Nothing taught, hinted or changed.
- v2: 1-1 to 1-10 in 5:40 (13 stars at 5:41), a new-suit gift at 2:20, world 2 (pink track, x2 gates, "Catch It" sliding gate, "Half Beam") from 6:10, level 17 at 10:20. 23 stars, 1066 gems. A random player moved on one level every 20-40 s and stuck for about 80 s at 2-5 Half Beam. This is far better than the last run (stuck 4 min on 1-5); the wall problem is gone for a casual player.

## Scores (0-10, a 6 is a 6)
| Test | v1 | v2 |
|---|---|---|
| 10-second | 5 | 8 |
| Toy | 5 | 6 |
| Almost | 3 | 7 |
| One-more | 4 | 7 |
| Surprise | 2 | 8 |
| Mastery | 2 | 6 |
| Tomorrow | 1 | 7 |
| Average | 3.1 | 7.0 |

One line each. 10-second: v2 shows a "STRETCH DASH" title over a live runner, two huge gates and a drag hint; the first gate gives a big "+30 TALLER" word and gems. v1 is a plain gate and a thin payoff. Toy: the jelly wobble, chunks, "x3 TALLER" words and slice debris feel good, but the drag is only a lane pick; it has no weight to play with when there is no goal (a 6 in both, v1 5 because it has less feedback). Almost: v2 names the cause, rows from the stairs and how much more jelly would climb; v1 says "CRUSHED" or "CRASH -37" and nothing else. One-more: both restart with one tap, but v1's retry card is a dim screen with grey "Tap to retry" and 7 minutes at the same wall make the thumb tired; v2 moves fast enough that a loss is short. Surprise: v2 gets a combo ladder, a gift, a suit, a HARD level, a world recolour and new gate types in 10 min; v1 is identical for 10 min. Mastery: v2 shows stars, combo and rival numbers, but a random player cannot tell why they get 2 stars and the star steps are not visible while playing; the HUD size readout (130/100) is the only teaching. Tomorrow: v2 has a chest bar (144/150, "1 more to a new suit"), star count, map, suits and a hard-level marker; v1 has nothing. A 7, not an 8, because the chest bar is on the win card only, not on the play HUD.

## v2 first 2 minutes, beat by beat
1. 0:00 Lands directly in 1-1 "First Stretch": orange runner, level bar 1>2, size readout 100/100, big "STRETCH DASH" title across the screen, two big gates in the distance (Taller +20, Wider +20) and a pointing hand "Drag to steer". No menu and no loading. Good.
2. 0:05 The first gate: huge floating word "+30 TALLER", pink gems, the body wobbles up. This is the first satisfying thing and it is inside 10 s.
3. 0:15 Rainbow stairs and "LEVEL 1 CLEARED", 3 stars, "x3.4 20 gems", chest bar. 1-1 cannot be lost, so it is a free 3 stars.
4. 0:30 1-2 "Pick Blue": red Thinner -20 against blue Wider +30. The right gate is obvious; the red/blue colour is the whole lesson. Cleared with 2 stars, "3 stars at x4.8" shown as the next goal and a big white "Level 3" button.
5. 0:50 1-3 "Duck": first beam, the runner ducks, "x2 COMBO" appears at the top right. Best teaching moment.
6. 1:05 1-4 "Wide Before Low": Taller +60 / Shorter -30 gates in front of a beam; slices fly off, "x2 COMBO".
7. 1:35 1-5 "Mind the Wall": a wall with a hole and hazard stripes; it is passable by chance now.
8. 1:55 1-6 "Jelly Drops": a gift box arrives (dark screen, "tap"); a new suit (purple jelly with a hat). A reward at about 2 min, which is the right time.
9. 2:00+ Moves into green jelly 1-7 with a gem line and "x3 COMBO". At 2 min the game has changed colour of runner, rows and HUD three times, which is the right pace.

## What the best gate runner (Count Masters / Mob Control / Tall Man Run) does that this still doesn't
- Crowd fantasy: every gate multiplies a visible crowd and the camera pulls back, so you feel huge. Here you are one body whose size is a small number in the corner, and the "growth" of the body is still modest on screen (130 vs 100 reads small).
- Every level ends with a rival or a boss battle with a big show, and the start-of-run upgrade shop (income, start size) is visible from the first minute. Here the rival face-off exists from level 5, but the upgrade/wardrobe loop sits behind the map and win card; there is nothing to spend gems on.
- Fail teaches by showing the two options. Here the lose card tells how many rows or how much jelly, but not which gate was the mistake.
- Rewarded "skip" or free boost after 3 fails so a stuck player never sits at one level for long. Here a stuck player gets 80 s of the same level (v2) and minutes in v1.
- Constant escalating spectacle: combo 2 to combo 10 with more crowd, screen flash and slow-mo. Here the combo text is just a corner word, "x3 COMBO" looks the same as "x2 COMBO".

## Top 5 fixes, in order
1. Mastery (6): show the star steps while playing. A mini ladder on the HUD with the current mass against the 2-star and 3-star line, and on the win card "you missed 3 stars by one gate: Taller was +60" so a player learns what to pick. Without this a random player gets stars as a lottery.
2. Toy (6): make growth and shrink physical. Taller and wider should change the body visibly (150 should look half again bigger than 100), with a camera pull-back and a squish sound on every gate, so dragging with no goal is already fun. Give the combo a ladder (x2, x5, x10) that gets louder and brighter, with a short fever state.
3. Fail card (Almost, One-more): replay or highlight the gate that decided the loss ("Wider here would have fit"), and make retry a huge button in the thumb zone (v1's is grey text). After 3 fails in a row on one level give a free +size start or glow the right gates.
4. Tomorrow (7): put the chest bar and the next suit on the play HUD and on the first screen on return ("1 more level to a new suit"), and add a daily level or a daily gift so there is a reason to come back tomorrow; today the same player never returns (0 of 115 per DESIGN.md).
5. Make the first 3 minutes less same-y and the mid-game cleaner: level 2-5 "Half Beam" is a spike (80 s) after easy levels, and 1-1 to 1-4 are the same pick-a-colour choice. Add one surprise per level (golden gate, bonus gem line) and keep difficulty a smooth ramp. Also reduce the 100 ms hitches when slices spawn on weak phones.

Scores v2: 10-second 8, Toy 6, Almost 7, One-more 7, Surprise 8, Mastery 6, Tomorrow 7. Average 7.0 (v1 average 3.1; v2 beats v1 on every test; lowest 6).
Verdict: TEST
