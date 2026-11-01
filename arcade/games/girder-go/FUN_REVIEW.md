# Girder Go: cold-play FUN REVIEW (critic run, 2026-11-01)

Played as a new player on a 390x844 phone viewport, real pointer drags, software GL (SwiftShader), analytics/API hosts blocked.
v1 = default (`?deep=0`): about 9 min, levels 1-2 built by hand (4 attempts), levels 3-30 by the QA bot, trophy board opened.
v2 = `?deep=1`: about 10 min, levels 1, 2, 13 and Daily Bridge by hand (8 attempts, brace button, steel, undo, retry), map and garage opened, 25 more levels across all 3 worlds by the QA bot.
Screens and video were deleted. No game code was edited.

**FPS (software renderer, so a floor, not a phone number):** v1 38-50 fps idle, 32-40 during the drive. v2 35-38 idle, 31-38 during the drive. Neither is under 30, but v2 sits at 31-32 in worst samples; keep an eye on real low-end phones. No page errors in either run.

## The seven fun tests

| # | Test | v1 | v2 | Notes |
|---|------|----|----|-------|
| 1 | 10-second | 4 | 8 | v1 opens on a title card and an empty gap; the first satisfying thing (car crossing) comes only after you have built a truss, or about 45 s with a first plank that splashes. v2 opens straight into build, auto-selects the anchor, says "Drag from a red anchor to the other side", one drag, "Now press GO!", car crosses, 3 stars, "NEW VEHICLE: Mint Mini!" in about 15 s. |
| 2 | Toy | 5 | 6 | Both: snapping drag with rising tone, beams glow green to red, road snapping looks nice. v2 adds a brace button (auto-triangles) and live "would not hold" red preview, which is toy-like. Still, no physical jiggle or settle when a beam is placed, and I could not hear sound in headless, so scored on the visible motion only. |
| 3 | Almost | 3 | 8 | v1 says only "SPLASH! Add triangles to stiffen it" even when the bridge is already triangulated (I got it twice). No beam shown, no %. v2 says "SO CLOSE! 68% across", names the beam type and "took 113% of its strength", rings the culprit in the water, and colours weak beams orange on retry. Progress went 61% to 78% on my second try, which read as "I'm getting it". |
| 4 | One-more | 6 | 8 | Both keep your design on retry and restart in about 0.9 s. v1 retry is "tap anywhere". v2 has a big "Fix it" button, plus "Again for more stars" on a win. Both lose a half-second to the card. |
| 5 | Surprise | 3 | 6 | v1 over 30 levels: same grass/mesa/snow theme cycle, a rock in the middle, a truck, nothing else. 10 minutes in looks like minute 2. v2 has steel (L5), trucks, step-downs, rocks, new world card (L12, L24), new vehicle toasts, hints that change per level. The boss is just a longer span with no spectacle; the gold coin is always at the same spot; no rare or random thing ever happens. |
| 6 | Mastery | 3 | 7 | v1: budget slack silently adapts (±25%), score is "levels cleared", no star, no par shown until L2+ (par $400 is shown on level 1 only in v2). I could not tell whether I was improving. v2: par, 1-3 stars (nothing snapped, cost under par), "Spend $431 less for the 3rd star", replay-for-stars. I hit 2 stars on try 2, then 3 stars with a different build. Brace button gives a lot away, which lowers the skill ceiling. |
| 7 | Tomorrow | 2 | 7 | v1: trophy board offline, nothing unfinished. v2: star bar to the next vehicle ("2 star to the Cherry Rod"), locked level grid with a pulsing next level, Daily Bridge with a day counter, garage with 8 slots. But garage vehicles look like recolored pills (cosmetic), and Daily day 1 is a 10-unit bus span with par $18,300 that a new player cannot solve, which is a bad first daily. |
| **Avg** | | **3.7** | **7.1** | |

v2 beats v1 on every test. Lowest v2 test is 6 (toy, surprise). No test under 6.

## First 2 minutes, beat by beat

**v1 (default arm)**
1. 0:00 Title card "GIRDER GO" over a pastel canyon, a hand icon, a lot of text. Tap to start.
2. 0:05 Level 1: gap of 4, $0/$2,500, three material chips (ROAD/WOOD/STEEL), "Tap a red anchor, then tap a spot", no GO emphasis. Nothing moves.
3. 0:15 I drag two planks. Nice snap, grey beams, a cost counter that climbs. No praise.
4. 0:25 GO with a flat deck: car drives, deck sags, the car falls, "SPLASH! Add triangles to stiffen it". That is a loss with no named cause.
5. 0:40 I rebuild as a truss (7 beams, $2,331). Beams glow green, car crosses, "CLEARED! $2,331 spent, nothing snapped". Satisfying, but a new player will not find the triangle on their own.
6. 1:00 Level 2: gap of 5, frozen theme, budget $9,500 (4x level 1). Warren-style truss lost twice with the same generic message, the second time at 85% across, with no clue why.
7. 2:00 Still on level 2, a bit annoyed. Progress bar and "$/budget" text are the only feedback.

**v2 (`?deep=1`)**
1. 0:00 Straight into level 1. The anchor ring is already picked. "Drag from a red anchor to the other side". Par $400 shown. Only one material chip, so no choice paralysis.
2. 0:08 One drag lays the plank. "Now press GO!" Big green button.
3. 0:12 Car (yellow) drives across, camera follows, fast-forward button shows up, 3 yellow stars pop in. "3 STARS! NEW VEHICLE: Mint Mini!", a star bar toward the next unlock, a "Daily Bridge is waiting" teaser. Next button.
4. 0:20 Level 2: the same screen, a gold coin hovering mid-gap, wood chip appears. Hint: "Two planks: the car is light". I build two planks as told and GO.
5. 0:35 The deck snaps: "SO CLOSE! 68% across, one more try! A road beam took 113% of its strength and snapped. Add triangles around it." Red ring on the splash. "Fix it" button.
6. 0:45 Retry in under 1 s, my beams are still there. I add a triangle truss; the failed beams are now orange ("Orange beams were the weak links").
7. 1:00 GO again, crossing succeeds, 2 stars, "Spend $431 less for the 3rd star". "Again for more stars" is a clear next action.
8. 1:30 I rebuild cheaper in wood. The GO button silently did nothing for me (all-wood deck, a "BUILD A ROAD FIRST" pop I missed). Mild confusion, then fixed by swapping the deck to road: 3 stars at $1,866 vs par $1,900.
9. 2:00 Map: three worlds, grid of 12, stars, 11 locked, Boss in yellow, Daily Bridge button, Garage. I feel I have a place to go.

## What the best app-store bridge builder does that this one still does not

The reference is Poly Bridge, with Bridge Constructor as the casual cousin.
- **Instant, readable cause of failure, on the thing you touched.** Poly Bridge shows a stress colour on every joint while you build and the replay slows at the exact break. v2 gets this halfway (culprit ring, orange weak links, "113%") but does not slow time or zoom at the first snap, and it tells you after, not while building. The live "would not hold" preview exists but does not mark WHICH beam is red until you press GO (it shows a verdict but I never saw a beam highlight in the build screen).
- **Drama on the break.** In the best games a snap is the reward: slow motion, camera cut, rubble, a sound you remember, a "ha" moment that makes you laugh then retry. Here the car just drops in a puff of water, and the loss card hides most of that.
- **Every level asks a different question.** Poly Bridge has a drawbridge in level 3, a hydraulic piston, a jump ramp, an unlock of a new tool every few levels. v2 has 36 gaps with rocks, steps and heavier vehicles but the verb never changes: lay beams, press GO. The boss is a wider gap.
- **A "budget puzzle" that makes you improve the same solution.** The best games show a leaderboard of cost for the same level ("you beat 62% of players"). v2 only has a fixed par.
- **A reason to share.** Short, funny failure clips and a "watch the replay" button. Here there is none.
- **Sound and haptics are hard to judge from here.** I could not hear anything; the code has tones and haptics, but I cannot vouch for the feel.

## The 5 biggest fixes, in order

1. **Make the first snap a moment.** Slow-mo plus camera push-in on the first beam to break, a hit-stop frame, bigger debris, the broken beam stays glowing red on the loss card (not only a ring in the water), and a 1-tap "watch it again". This lifts Almost, Toy and Surprise at once. Same for the win: a joyful car hop and confetti when you 3-star, not only on the card.
2. **Show the weak beam in build mode, live, before GO.** The predictor already knows. Tint beams by predicted stress as you place them (green to red), so building is a conversation. Right now the build screen says "It would not hold" without a place to look. Then lower the brace button's power (it solves too much of the puzzle and caps the skill ceiling), for example it only braces the worst beam per press.
3. **Add surprises that change the verb, one every 3 levels.** A drawbridge or movable piece, a wind gust or a falling rock that tests the bridge, a "ghost" level where the car is much heavier, a bonus level with a one-beam budget, a rare golden car that pays double stars. The 10th minute still looks like the 2nd (same car drive, same gap with a rock). Make the boss levels look and sound different (different music cue, camera swing, longer car convoy).
4. **Rework the Tomorrow hook.** The Daily Bridge on day 1 is a 10-unit bus gap with par $18,300 that a new player cannot finish, which turns the tease into a wall. Seed the daily from the player's current world, show the streak and a friend-like benchmark ("52% of players got 3 stars"), and make the garage unlocks real (different silhouettes and horns, not only recolored pills). Show a chest or collection slot at 1 star short of the next unlock on the Next card (it does this; make it the loudest thing on the card).
5. **Tidy the new-player stumbles.** (a) GO silently refuses an all-wood deck; the "BUILD A ROAD FIRST" pop is easy to miss, so tint the road chip and keep the pop on screen for 2 s. (b) The "Two planks: the car is light" hint on level 2 led me straight into a loss; reword it to "One plank holds a light car only if it is braced" or remove it. (c) The bottom bar overflows the phone on the Daily (ROAD chip clipped at x=0) and chip positions move between levels, so my thumb memory failed; keep GO fixed in place and shrink the chips. (d) Win card text and buttons overlap on L2 ("Again for more stars" and "Map" crowd the Next button) and are clipped in places.

(Also worth fixing: v1, the default arm for half the players, still has no named failure cause and no stars. If A/B continues, v1 players will churn within 2 minutes.)

## Honest scoring notes
- Scores for levels beyond what I built by hand (v1 L3-30, v2 L3-36) lean on the QA bot's runs and screenshots of each level, not on my own thumb. They show variety of setup but not how hard each one feels.
- Sound could not be heard; Toy and One-more are scored on visible motion and timing only.
- The v2 average is 7.1; at 7.0+ the rules say TEST, and it is a borderline TEST: the average is carried by Almost, 10-second, One-more and Tomorrow. Surprise is a 6 and sets the ceiling.

Verdict: TEST
