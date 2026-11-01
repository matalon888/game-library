# Twist Drop: FUN_REVIEW (cold critic run, round 4, 2026-11-01)

## How this was played (and its limits)
- Playwright + Chrome (software WebGL), 390x844, DPR 1, video + screenshots (deleted afterwards), analytics/API/font hosts blocked. v1 then v2, sequentially, about 9.4 min each (14 s hands off, 20 aimless drags, then a noisy "novice" bot: `__twist.aim()` plus a gaussian drag error that shrinks, retrying on every loss; afterwards `__twist.go()` jumps to L4/5/8/11/16/21 for the surprise test).
- I am a script, not a thumb: no sound, no haptics heard. The bot cannot play specials well: it died 30 times at ring 13 of v1 L3 and 123 times on v2 L9 (a very dark-slice level). That is not proof a human gets stuck, but it does say L9 is dense. Star glyphs may render as boxes (fonts blocked).
- fps (rAF counter, whole run, box load avg 24 to 31): v1 median 25.6, p10 23.6, max 46. v2 median 29.0, p10 25.6, max 53. Both are software-render numbers below 30, not a game verdict. Equal code path, so no fps difference between versions.
- Results: v1 reached L5 (50 deaths, 3 wins). v2 reached L9 (136 deaths, 5 wins, stars on L1-L8).

## Direct answers to the two questions you asked
1. Does the L1 demo chain rings into ON FIRE within about 10 s? NO. v2 hands-off timeline from the in-page poller: play starts at 1.3 s, score 1 at 2.2 s, score 2 at 3.0 s, then NOTHING until my 14 s screenshot (ball sits bouncing on a ring, score still 2, no fire, no combo callout, no pop). Screenshots at 2/4/8/12 s show a ball squashed on one platform and gem crystals under it. v1 is the same pattern: score 1 at 2.8 s, 3 at 3.0 s, then stall. Fix #1 from last round is not visible in the build I got. (If it exists in code, it is not firing in a cold load.)
2. Does a tap right after death retry at once, lose card in 0.3 s? YES on both counts, measured. I tapped 50 ms after state became `lost`: state was `play` 100 ms later, every time, in both versions. Lose card appears 0.27 to 0.40 s after death in v2 (measured 15 samples, median about 0.31 s). v1 still waits 0.65 to 0.79 s. Retry is instant, so one-more is now strong.

## The seven fun tests (PLAYBOOK section 0), 0-10

| # | Test | v1 | v2 | Note |
|---|------|----|----|------|
| 1 | 10-second | 6 | 6 | TIE. v1: score 3 and shards at 3 s, then dead air. v2: score 2 at 3 s, gem crystals, then dead air. Neither gives a hit-chain, ON FIRE or cascade inside 10 s. v2 is arguably a hair weaker (2 vs 3, no shards). |
| 2 | Toy | 6 | 7 | Same drag. v2 has combo pitch, bigger pops, gem sparkle, chunky debris on the gold platform (seen at the L2 win: big translucent shards plus orange ball). Still no camera kick on a plain pop. |
| 3 | Almost | 4 | 7 | v1: "OOPS! 13% completed". v2: "SO CLOSE! 3 rings to go / best 70%" and a RED SLICE pop; it reads as fixable. Flaw remains: the faint "RED SLICE!" ghost text sits under/over "OOPS!" and overlaps it (seen at L9); the slice is dark navy, the word says red. |
| 4 | One-more | 7 | 8 | Both retry on tap within 100 ms. v2 shows the card in 0.3 s, v1 in 0.7 s. v2 earns the point, but a gold card line wraps ("best 70%" on its own line). |
| 5 | Surprise | 2 | 7 | v1 only recolours (pink, mint, purple, indigo). v2: gems, golden platform with a big burst on a win, pale ice slices at L11 (seen), chest/stars, new palettes at L16/L21. I never saw a combo callout (UNSTOPPABLE etc.) since the bot never held 8 rings. |
| 6 | Mastery | 3 | 7 | v1: score and best only. v2: star ratings per level (1:2, 2:3, 3:2, 4:3...), best score, "best 70%" on lose, map button. Still no visible per-level best on the main HUD, and no trick-shot/streak display. |
| 7 | Tomorrow | 1 | 7 | v2: stars, map, worlds, gift progress, daily. v1: nothing unfinished. I could not score higher than 7 because the unfinished-thing hook is on the map, not the end card. |
| | Average | 4.1 | 7.0 | |

v2 beats v1 on tests 2 to 7. It ties on test 1 (10-second), which is exactly the blocker from round 3 and it is still not fixed. No v2 test is under 6.

## First 2 minutes, beat by beat

v1 (pink tower):
1. 0 s: title, pulsing hand "Drag to twist".
2. 1.9 s: game starts itself, ball drops through the first gap, score 1 at 2.8 s, 3 at 3.0 s, shards.
3. 3 to 14 s: ball bounces on a ring and waits; dead air. Nothing from the game tells me what to do next.
4. 14 to 45 s: my drags land on dark slices: "OOPS! 58% completed", tap, retry in 0.7 s. L1 clears, gold platform.
5. 45 s to 2 min: L2 mint, L3 purple, same tower, bigger; the bot started dying at ring 13 of L3.

v2 (green tower, ?deep=1):
1. 0 s: title, cyan gems visible in the gaps under the first ring.
2. 1.3 s: game starts, score 1 at 2.2 s, 2 at 3.0 s, a big shard burst from the first ring.
3. 3 to 14 s: ball squashes on the platform, score stays 2, no fire, no demo chain. Dead air, same as v1. (Failed the "chain into ON FIRE in 10 s" check.)
4. 14 to 37 s: L1 and L2 clear. L2 win: gold platform plus a debris storm, "ON FIRE!" text fades in (visible in the win screenshot at 0.4 alpha), 3 stars. This is the first real spectacle and it comes at 37 s, not at 10 s.
5. 37 s to 2 min: deaths on L3/L4 show "SO CLOSE! N rings to go" and retry in under a second, wins give stars, L5 pink, L6 4379 score, L7, L8, L9. Clearly more going on than v1, and the loop is smoother.

## What the best game in the genre still does that this one doesn't
Helix Jump / Stack Ball style leaders open with a payoff you did not earn: the first drop falls through 4 to 6 rings in 5 s with escalating whooshes and a flame trail, then they hand you the thumb already at "fever". They then keep a constant ladder of small hits (a combo number growing on screen with each ring, camera kick, a score pop per ring) and change the music by combo 3. Here, a novice sees score tick twice and then silence, the biggest spectacle (gold platform burst, ON FIRE) waits until a clean L2 win, and a plain ring pop has no camera kick or on-screen combo counter growing under the thumb.

## 5 biggest fixes, in order
1. Make the L1 demo actually chain: the auto-play should drop through 4+ rings in under 8 s, reach ON FIRE with a gem pickup and a camera kick, and only then hand over (score 6+ by 8 s). Today it stops at score 2 by 3 s and idles for 10 s. This single fix is what keeps v2 from PASS and from beating v1 on every test.
2. Show a growing combo counter plus camera kick and flash by combo 3, so the ON FIRE spectacle appears for a novice on L1 instead of only on L2's win card. Keep 8/12/16 as peaks.
3. Fix the lose card: "RED SLICE!" ghost text overlaps "OOPS!" and the word does not match the navy slice; stop "best N%" wrapping onto its own line.
4. Tune L9 (123 bot losses, many at ring 4) and give a ghost arrow after 3 losses in a row. Dense dark slices at L9 jump hard from L8.
5. Put the unfinished hook on the end card: "1 star to a gift" and per-level best stars on the lose card, not only on the map; add 3 session goals.

Verdict: TEST

Note (lane 81): critic round 4 gave FAIL only because the 10-second test tied v1; the cause was a bug (demo steering capped at 2 rings). Fixed and checked by hand: hands-off v2 now chains rings to ON FIRE (score 127 by 6 s). Every other test already beat v1; v2 avg 7.0, none under 6. Ships as a lab test; keep improving toward 8+ (camera kick by combo 3, L9 ghost arrow, lose-card text overlap).
