# Smash Dummy FUN_REVIEW (critic run, cold play, 2026-11-01)

Method: Playwright + Chrome, 390x844, analytics blocked, real mouse taps and flicks (random but human-paced, one throw every 4-6 s,
no state reading), about 10.5 min each for v1 (?deep=0) and v2 (?deep=1). Video and screenshots in /tmp/sd.
FPS (in-page rAF): v1 48.9 mean, v2 50.7 mean (p95 frame 33 ms; both runs shared one machine). Both over 30: run valid.
v1: 126 throws, cleared 2 levels, stuck on the car level 3-4 (17 "NOT BROKEN" screens). v2: 105 throws, reached level 27 (3 worlds).

## Scores
| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 7 | 8 |
| 2. Toy | 6 | 7 |
| 3. Almost | 3 | 7 |
| 4. One-more | 6 | 8 |
| 5. Surprise | 2 | 7 |
| 6. Mastery | 2 | 7 |
| 7. Tomorrow | 1 | 6 |
| **Average** | **3.9** | **7.1** |

## First 2 minutes, v1
1. 0-2 s: "SMASH DUMMY" title, a lone dummy on empty green, "Tap where to fling him". Calm, no hook.
2. 2-6 s: it auto-demos a throw. Ragdoll tumbles, hit-stop and shake are decent. First satisfying beat at about 6 s.
3. 6-20 s: three throws vs "GOAL 100". Level 1 clears at 140 and the round ends the instant the goal is passed: no reason to throw well.
4. 20-45 s: levels 2-3 go by fast. Goal jumps 100 > 170 > 240.
5. 45-120 s: level 3-4 is a long car road. Random flicks do 4-150 of 190-240 damage and the card says "NOT BROKEN! 9 / 210". It
   feels random and unfair, and the same level repeats forever. No stars, no combo, no variety. A new player is bored by minute 2.

## First 2 minutes, v2
1. 0-2 s: same title but with a star track and MAP button. TARGET 70.
2. 2-8 s: first throw, combo counter and x1.4 multiplier appear, stars light up. First reward arrives sooner and louder than v1.
3. 8-25 s: target passed but the round keeps going ("keep smashing for 3 stars", BANK IT). Good: the goal is now "do better".
4. 25-65 s: win card with stars, "Minty at 14 stars" progress bar, NEXT / RETRY FOR 2 STARS. Retry is one tap. Levels 3-5 teach
   with a one-line tip.
5. 65-120 s: FEVER x1.8 at combo 6, SO CLOSE cards ("only 24 damage from a star") with a hint ("Walk under the crate").
   Levels change shape every one or two. Clearly better than v1, but the combo/fever is the same banner each time.

## Notes by test
- v1: 10 s fine; toy fine but flat (one hit sound/shake); loss is a number with no "why"; retry is tap-anywhere (good);
  nothing new after 6 setpieces, no stars, no best, nothing unfinished.
- v2: toy still only OK (no sound variety/pitch ladder that I noticed; a tap feels the same each time); surprise has worlds, TNT, glass,
  fan, golden target, but random flicking cleared 26 levels in 10 min, so difficulty is too soft early and the stars were
  barely contested (the 3-star line was almost never reached, and nobody told me how). Mastery is visible in stars/combo but
  tuning is loose. Tomorrow: dummy-unlock bar, map and daily level exist but felt like labels, not a pull.

## What the best app-store ragdoll/launch game does in its first 2 minutes that this one does not
It makes the throw itself the toy: you see a big, readable aim (slingshot arc) and a launch with huge weight, then every
impact has stacked feedback (slow-mo on the biggest hit, each bone-crunch with its own pitch, coin/cash numbers flying into a
counter, screen flash), and you earn currency immediately that buys a visible upgrade you can apply to the very next throw
("more power" stat, new launcher). It also hides a skill lever early (release timing/power meter, or steer mid-air), so
level 2 is won by a better throw and the player can tell why. Ours has damage counters and stars but no spending, no mid-air
control, and our wins are often chance.

## 5 biggest fixes, in order
1. Make a throw skill-readable: a short aim arc with power on the first flick, plus one mid-air action (tap to tuck/spin or boost), so
   a better player does clearly better and a loss is "my aim".
2. Raise early difficulty and make 3 stars a real goal from level 3: show the 3-star line on the bar and cut free clears (random
   flicks should not reach level 27).
3. Escalate spectacle: slow-mo and zoom on the biggest hit, a different banner/sound per combo tier, a pitch ladder per hit, a jackpot
   moment (golden/TNT chain) at least every 2-3 levels.
4. Spend what you earn: stars buy something that changes the next throw (power, a launcher, a ball), not just hats; show "1 star to
   Minty" on the map and in the retry button.
5. Tomorrow hook: a visible daily level with a streak and a chest that is almost full when a session ends; a world one level from
   done on the map as the last thing seen.

Verdict: TEST
