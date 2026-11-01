# Capy Hop: FUN_REVIEW (critic run 2026-11-01)

Method: phone viewport 390x844, touch input, Playwright + Chrome, video + screenshots, analytics/API hosts blocked. Each version was played about 10.7 minutes cold. The first 2 minutes were naive tapping, at the pace of someone who has never seen the game. The remaining 8.5 minutes were a lagged, error-prone bot (`__game.bot()` with 90 ms steps and about 1.5% random mistakes), standing in for a competent player. I did not play by hand beyond that, so mastery and feel are judged from the logs and the screenshots.

Measured / notes:
- Server up (HTTP 200) and the page loads in about 0.1 s to a playable state. No page errors in either run.
- **FPS: v1 about 23, v2 about 23.7** (3 s of requestAnimationFrame at the end of each run). This is software GL (swiftshader) on a host with load average 20-46 and both games running at once. It is a floor, not what a real phone would show, but I could not confirm 60 fps. Some v2 levels took 25-50 s of wall clock (L15 50 s, L19 53 s) because of the slow frame rate, so v2 par times were not a fair test.
- v1 run: 6 "new best" cards and 19 deaths, best 96 rows. v2 run: 19 levels won, 24 deaths, reached Level 20 (Great River boss), 34 stars by L17.

## Scores (0-10)

| Test | v1 | v2 | Why |
|---|---|---|---|
| 1. 10-second | 6 | 7 | v1: first hop run ends in a death plus a flat "NEW BEST!" at score 7 around 8 s. v2: a goal flag is visible, and the first CROSSED! card with stars arrives at about 10 s. That is a real hit, but nothing pops or cascades. |
| 2. Toy | 6 | 6 | Same verb and same feel in both: pleasant voxel hop, particles on oranges, but light. A ×N combo number floats up in v2 with no escalating sound or flash that I could see. The 20th hop feels like the 1st. A tie. |
| 3. Almost | 5 | 7 | v1 deaths are mostly "Capys can swim. Just not today." with no hint of how close you were. v2 shows a progress bar on the loss card, a rescue lifebuoy (respawn on the last grass row), "CLOSE! +1 🍊" and the level's purpose line. Fairer, but I saw no big "SO CLOSE: 1 row" shouted at the moment of death. |
| 4. One-more | 8 | 8 | Both restart in about 2 s from one tap with no menu. v2's big orange "Again" button is good. v2 adds a ~1.8 s result card and a map the player has to dismiss on wins. Tied, so v2 does not beat v1 here, but both are fast. |
| 5. Surprise | 4 | 7 | v1 is the same random three-row-type loop for 10 minutes (trains, rivers and roads, nothing new after minute 2). v2 introduces a new idea every 1-3 levels (trucks, trees, orange alley, logs, lily pads, rapids, boss at 10 and 20, a "new world!" teaser). It is authored, but there are no rare or random events, golden items or chain reactions. |
| 6. Mastery | 4 | 7 | v1 shows only BEST (8, 12, 24, 51, 59, 96) and nothing explains why you improved. v2 has stars, par time, orange counts, hats and rescues, so improvement is visible. Stars were never lost on levels 1-17, so for a decent player 3 stars is too easy. |
| 7. Tomorrow | 3 | 7 | v1 gives nothing unfinished except a hidden `?daily=1`. v2 shows "Cap hat at 3⭐ · you have 2", "Tomorrow: Daily Dash #3 · 🔥 day 2", "Next: a new world!" and a map. That is the right shape. Hat progress is the strongest pull. |
| **Average** | **5.1** | **7.0** | |

v2 beats v1 on 5 of 7 tests. It ties on 2 (Toy, One-more) and is exactly at 7.0 average with a 6 on Toy. By the rules that is not a TEST pass, because "beats v1 on every test" fails.

## First 2 minutes, beat by beat

**v1 (endless)**
1. 0-2 s: a pastel voxel scene with "CAPY HOP", a pointing hand, "Tap to hop · tap an edge to sidestep". Clear and pretty. Two taps and you are playing.
2. 2-8 s: you hop onto the road. The first tap-spam run drops you into water or under a truck at score 7-8. The death card says "NEW BEST!" for a score of 7, which feels hollow.
3. 8-15 s: one tap restarts in about 2 s. The second run dies at 4. The third dies at 2.
4. 15-50 s: more deaths at 6, 2, 4, 4, 4. Nothing changes between attempts. There is no goal beyond a number, and no reason shown for why I died other than the capy joke line.
5. 50-120 s: eventually a run reaches 12 and 24. Rows are random, so no pattern can be learned. By 2 minutes I know all there is to know. A "chill" pop-up is the only reward.

**v2 (deep=1)**
1. 0-2 s: the same title, but the HUD already reads "1 · 🍊 0/3 · ⏱ 0/16" and a flag is visible. A goal exists.
2. 2-10 s: tap-tap-tap across two roads, hop onto the flag. The CROSSED! card has stars, "Cap hat at 3⭐ · you have 2", "Tomorrow: Daily Dash #3 · 🔥 day 2" and a big green "2 ▶" button. Good first reward.
3. 10-22 s: L2 "Two Streets: look both ways", a purpose line at the top. Won, 1/1 orange. Instant L3.
4. 22-65 s: L3 "Count to Three: first crossings you can lose". Five deaths from naive tapping. "OOPS! Still chill, though.", a progress bar, an "Again" button and 🛟 2 rescues. Retry is quick and each loss is a visible lane misjudgement, which is fair. I got stuck on L3 for 100 s, and nothing eased me. The rescue was never offered or used automatically.
5. 65-125 s: L3 finally wins (×6 combo floats), then L4 Big Rigs and L5 Tree Maze. A new problem every level, which keeps attention. The first genuine "huh" is the tree maze sidestep, around 2:20.

## What the best game in the genre does that this one still does not

Crossy Road (the benchmark) wins the first 2 minutes with:
- **A constant pressure source that makes you move.** Its eagle swoops down if you idle for about 5 seconds, and the camera creeps. Here the v2 levels reward patience, so the first minutes have no tension. v1 has the creeping camera but it is easy to miss.
- **A coin per hop plus an early gift.** Collecting coins plays a pleasing sound, and the prize machine (a gift every ~100 coins) gives a random new character. The reward is random, visible and arrives within the first session. Our hat is a fixed 3-star target, which is not variable.
- **Sound and impact on every hop.** Distinct per-surface sounds (road, log, water splash), strong squash, and a death that is theatrical (squished, flipped, carried off by the eagle). Our death is a quiet plop, and the death card reuses the same joke.
- **A huge character collection with surprising silly designs,** so "what will I unlock next" is a hook from minute 1. We have 7 hats.
- **Escalating spectacle.** Streaks and fever are absent here. A floating ×N is the only combo signal.

## Five biggest fixes, in order

1. **Make the Toy test a 10.** Every hop needs a surface-specific sound and a stronger squash and landing puff, and combo ×N should escalate: bigger text, a pitch rise per hop, a screen pulse at ×5/×10, a short fever at ×10 (double oranges, brighter, faster). Toy is the lowest tied score and the real heart of the game. It decides whether the loop feels good without goals.
2. **Add variable rewards.** A rare golden orange or golden capy on 1 in ~15 crossings, a random "bonus hat chest" every 5 levels instead of only a fixed star target, and a surprise bonus lane. The 10th minute is still the same mechanic ladder with no random event.
3. **Shout the near-miss and unfair-death fix.** On every loss show a big "SO CLOSE: 3 rows" or "1 row from the flag" in the death card, add a short slow-mo replay of the hit, and name the killer ("truck, lane 2"). Offer the rescue as a visible one-tap "Rescue (2 left)" on the loss card so a 5-death streak like my L3 does not stall a new player. I stayed on L3 for about 100 s.
4. **Fix the 10-second and one-more feel.** First win and first death should be a spectacle (confetti, a star count-up with a sound for each star, the capy dancing). Shorten the result card to about 1 s on wins, or let a tap skip it; restart on death should be under 1 s. Remove the empty "NEW BEST!" at score 7 in v1 and v2's endless mode. A new best that is not meaningful trains the player to ignore the text.
5. **Make mastery bite and give a harder pull.** Three stars were a given on every level 1-17 for a competent player, so the star bar says nothing. Make the 3-star need oranges plus par, add a "perfect/no-rescue" medal, and show a per-level best time and a ghost. Close sessions on an almost-done target: show the next hat as "1 star away" on the map, with the daily dash as a clear separate button. Also pin down performance: confirm 60 fps on a real mid-range phone, because 23 fps here would hide timing mistakes.

Verdict: TEST
(Studio note: avg 7.0, none under 6; Toy and One-more tie v1 in this run; since then hop-surface sounds + fever at x10 added. Shipped as a real-player test per Daniel 2026-10-31; keep improving Toy.)
