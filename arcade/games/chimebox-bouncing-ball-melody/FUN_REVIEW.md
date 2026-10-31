# Chimebox FUN_REVIEW (critic run, 2026-10-31)

Method: Chrome (software GL), 390x844 touch phone, two 10.3-minute sessions (v1 = `?deep=0`, v2 = `?deep=1`) with real touch taps
(randomized 0.6-1.3 s rhythm, like a casual new player; card buttons tapped by position), screenshots every 6 s for 2 min then every 30 s, video recorded.
All non-127.0.0.1 requests aborted. No game code edited. Caveat: I tapped with a rhythm, not with frame-by-frame aiming, so skill-ceiling claims are inference.

## Measured fps (software GL, load avg ~14)
| | idle-ish tapping | during 10-min play |
|---|---|---|
| v1 | 57.8 | 44-60, median ~57 (dips to ~49 at 3 balls + particles) |
| v2 | 58.4 | 44-60, median ~57 (first 7 s ~44 while warming up) |
Both are smooth even without a GPU; no perf concern. One benign console error: a blocked external request.

## Scores (0-10)
| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 8 | 8 |
| 2. Toy | 6 | 7 |
| 3. Almost | 4 | 8 |
| 4. One-more | 6 | 8 |
| 5. Surprise | 4 | 7 |
| 6. Mastery | 3 | 6 |
| 7. Tomorrow | 3 | 6 |
| **Average** | **4.9** | **7.1** |

Why: v1 is a pretty, pleasant music toy, but with sloppy tapping I cleared 28 songs in 10 minutes and basically never lost: there is no tension, no stars,
no best, nothing unfinished (level counter only; songs repeat after ~8 levels; only the shape/colour changes). v2 adds a real loss state with "FULL! SO CLOSE: 1 note left",
one-tap Again, a new rule every 1-3 levels (second ball, waltz, pegs, sour wall, self-spinning box, boss, moon gravity, stars), GOLD xN chain pops and FEVER.
Weak spots in v2: early levels are too generous (random tapping got 3 stars on L1-3, FEVER on L1-2, so stars do not show improvement early); mastery feedback is
just stars; the map shows locked nodes as blank squares (no numbers, no preview of what is ahead); "tomorrow" is a Daily button and "7 stars to the next ball skin", which is a mild pull.
v2 beats v1 on all seven, but the toy margin (7 vs 6) and the 6s are thin.

## First 2 minutes, beat by beat
v1
1. 0 s: pink ring, blue ball already bouncing, sheet-music strip at the bottom, "Twinkle Twinkle". No title screen, no tutorial: good.
2. 1-3 s: first wall hits ring a note each, ball grows, little note particles. Pleasant, but nothing tells me what to tap for.
3. ~10 s: tapping turns the ring; golden arcs catch the ball, "SHRINK!" pops. First understanding of the verb arrives by accident.
4. ~20 s: Level 1 ends with a plain "Level 2 cleared / Tap to continue" card and a Share button. Level 2 = hexagon, new song, 3 balls.
5. 30-60 s: levels 4-6 (shape changes: pentagon/triangle), "+1 BALL" mid-song. Never in danger; score pops are the only reward.
6. 60-120 s: levels 7-8 (Can-Can, Mountain King) feel like level 1 with a new colour. Cleared level 8 at ~2 min having lost nothing.
v2
1. 0 s: same look, plus a "Tap, hear it. Cannot lose." hint, GOLD x2 pop at 7 s. Level 1 is a 12-note verse: finished in ~11 s.
2. 11 s: "SONG DONE!" card, 3 stars, "7 stars to the next ball skin", big green Next, small Again/Map, "Tomorrow: a new Daily box". Fast, clear, rewarding.
3. 13-40 s: levels 2-3: FEVER banner, screen glow, the staff strip turns gold; hint line "Gold walls shrink the ball" overlaps the FEVER title text (visual bug).
4. 46-60 s: level 4 (round box, whole tune) is the first loss: "FULL! SO CLOSE: 1 note left of Ode to Joy". I tapped Again within 2 s and won with 141 pts: the one-more loop works.
5. 80-120 s: L5 second ball, L6 five walls, L7 waltz, L8 three balls with one gold each. Each level has a one-line purpose; stars 3/3/1/3/3/1/2/2 show variation.
6. ~2 min: still playing at level 8; map button top right shows three worlds of 10 nodes, a mostly dark roadmap.

## What the best app-store game in this genre does that this one still doesn't
The genre leaders (Tiles Hop, Magic Tiles, Beat Hopper, and the viral "ball plays a song" toys in Ballz/Marble-run style) hook you with the user's own song:
the very first minute is a recognizable pop hit you feel you are performing, the screen reacts in time with the beat (camera pulses, lights, background rotating), and
progress is a song library with a visible shelf of covers, with 3 stars per song, a "your best / 98%" number and daily songs to unlock. Chimebox still:
- plays a public-domain classical tune whose rhythm is set by physics, not the beat, so it often sounds like random notes; the player is not performing the song;
- has no strong beat-synced visuals (no camera pulse, background change or light show per note), so the audio-visual reward is smaller than the competition's;
- has a flat first minute: no big first cascade, no jackpot/rare event, no "perfect" tier; the first two levels cannot be lost, so nothing builds;
- shows locked content as blank boxes instead of teasers (song covers, a skin silhouette, a boss portrait), so "tomorrow" has little pull;
- has no personal-best number per song and no visible "you are better now" feedback (accuracy %, time, combo record).

## Five biggest fixes, in order
1. Raise early difficulty/star thresholds so random tapping does not give 3 stars and FEVER on L1-3 (mastery and almost tests); show best combo / best score per level on the star card.
2. Make the staff strip, camera, background and ring pulse on the beat of each note (and bigger on gold chains) so every tap is a show; add a distinct audio sting for chains x3+ and FEVER.
3. Give the map a hook: numbered locked nodes with a preview of the next rule (peg, sour wall, moon), a "1 star from the next ball skin" progress bar, and the Daily box visible on the result card as a button, not text.
4. Add a rare variable reward: a golden-ball / bonus-room level that appears on about 1 in 8 songs, or a chest pick every 10 stars; the 10th minute needs to differ from the 1st.
5. Fix UI polish: the hint text over the FEVER title, the lost card's Again button over the ring (cramped), unused Share button on win in v1, and add a nearly-there bar on the star card.

Verdict: TEST
(avg 7.1, none under 6, beats v1 on all seven. This is a narrow pass: mastery and tomorrow sit at 6, so keep improving items 1-3 while the A/B runs.)
