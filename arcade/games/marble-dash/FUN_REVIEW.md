# Marble Dash: FUN_REVIEW (critic run, 2026-10-31)

Method: cold play on a 390x844 touch viewport (Playwright, chrome, real touch holds/drags via CDP; my reaction loop was 0.5-1 s because I read screenshots between inputs, which makes steering harder than for a live thumb). v1 = `index.html`, v2 = `?deep=1`. Bot used only to peek at v1 courses 3-5 and v2 courses 8/12/17/22. About 8.5 min hands-on v1 (plus bot peek) and about 9 min hands-on v2 (plus bot peek). FPS measured over 4 s with requestAnimationFrame during play: v1 60.7, v2 50.5-60.7 (both above 30, no rerun needed). Analytics hosts blocked. Note: the star glyph and the "Again" glyph render as tofu boxes in headless Chrome (missing emoji font); not scored against v2, but see fix 5.

## Scores (0-10)

| Test | v1 | v2 | Notes |
|---|---|---|---|
| 1. 10-second | 4 | 9 | v1: a weaving demo roll, then plain wood, no reward in 10 s. v2: 30 gems and a BOOST pad in 3 s, golden star in view, first star earned by 7 s. |
| 2. Toy | 4 | 7 | v1: rolling is okay but nothing answers the thumb. v2: gem chain, cube shatter on block hits, speed callouts feel good; steering is twitchy (small drag = big swerve) and pinning on a block gives a mushy slow-motion. |
| 3. Almost | 2 | 6 | v1: 8 game-overs at the same unexplained gap on level 2 (24%), a wall at minute 2. v2: free first fall, adaptive HINT chips, and "13.2 s over par" text are fair and readable; but course 5 (zigzag) killed me 8 times (best 13%) with a full reset to course start each time, and block pinning feels unfair. |
| 4. One-more | 5 | 8 | v1: tap-to-retry is instant but I did not want to retry a gap I could not read. v2: Again is under 1 s, no menus, the card says exactly what is missing ("golds without a fall . 2.5 s over par"). |
| 5. Surprise | 4 | 8 | v1: palette swap per level, a spinner at level 5, the same wood track. v2: a NEW chip per mechanic (plank, slider, zigzag), world re-skins (pink candy, dusk stone), spinners, FEVER x2, UNSTOPPABLE x20, a gold star hidden behind a slider. |
| 6. Mastery | 3 | 8 | v1: only a clear time. v2: 3 stars (clear/golds/par), par timer, NEW BEST -10.7 s on the replay of course 3, combo callouts rising. |
| 7. Tomorrow | 2 | 8 | v1: nothing. v2: map with "2 more stars -> next ball" bar, ball 1/12, "Tomorrow: 3 courses = +20 gems and the streak grows", Today 2/3, locked worlds. |
| **Average** | **3.4** | **7.7** | |

v2 beats v1 on every test. Lowest v2 test is Almost (6). Average is under 8 and one test is under 7, so this is not PASS.

## First 2 minutes of v2, beat by beat

1. 0:00 Title card over a pretty sky course; a "NEW COURSE" chip is drawn on top of the MARBLE DASH title (overlap, clutter). Gems and a gold star are already visible down the track.
2. 0:03 First touch rolls at once, card gone, no menu. Gems stream into the counter (30 in 3 s), cube sparks, "BOOST!" chevrons: a reward inside 3 s.
3. 0:07 "SAVED" checkpoint callout, golden star 1/3, a stomach-light rush down the finish arch with confetti cubes. Course 1 cleared at 11 s with zero steering; card shows PERFECT and 3 stars.
4. 0:20 NEXT is a fat green button under the thumb; course 2 "Wobble Walk" starts in under a second. A stray "NICE JUMP!" fires at the spawn, which is not true.
5. 0:30 Course 2 clears in 18 s with a still thumb. The card adds par, Today 2/3, the star bar and a "Tomorrow" hook. Nice, but I have not had to steer yet.
6. 0:50 Course 3 "NEW: SLIDER, dodge the red block". First real challenge: the red block shoves me back, I get pinned against it, the clock runs in slow motion while pinned, then I fall and lose a heart. An adaptive HINT ("wait for the block to swing away") appears after the second fall. Good design.
7. 1:20 I clear course 3 on the third heart with a 13 s over-par grade. The card tells me exactly what I missed; I tap Again and I am rolling in under a second.
8. 1:45 Second run is faster (NEW BEST -10.7 s, one star short). Visible mastery.
9. 2:00 Course 4 "Gap Year" is a straight line I clear at 20 s of par 32 without touching the screen: PERFECT. Then course 5 "Zig and Zag" arrives with no ramp-up and takes all 3 hearts in 20 s. That is the cliff.

## What the best app-store ball-roller (Rolling Sky, Going Balls, Sky Rolling Balls) does in 2 minutes that this still does not

- Constant speed with a one-finger slide, so the thumb is always doing something; ours coasts on a held thumb and courses 1, 2, 4 clear with no steering at all.
- A difficulty ramp with no cliff: one new idea per 20-30 s, each cleared before it is combined. Ours goes from "hold still" (course 4) to a railless zigzag (course 5) that also gates worlds 2+ behind it.
- Short loops: a fall puts you back 3-5 s (frequent checkpoints). Ours resets to the course start (zigzag has no checkpoint before 13%+).
- Speed you can feel: the world and camera react (FOV kick, speed ramp, rhythm cues). Ours has chevrons and callouts but the camera sits low, the blocks cover the ball, and there is no per-obstacle rhythm.
- Obstacle sequences that look like a deliberate pattern to read and then perform; ours has single blocks.

## Top 5 fixes, in order

1. Fix the course-5 cliff and its respawn cost. `buildTrack()` case 'z' (deep.js line 126: `d = +-2.2` over 6-long segments at the narrow width, no rails) is too sharp for a first zig: make the first two zigs `d = 1.3` or add `rails: true` on them, and put an early `C` checkpoint in the 'Zig and Zag' string (levels.js line 20) because `fell()` sends you back to `cpZ` (the start). Add a mild lane-centring assist in `step()` when `holding`: `B.vx += (cx(sg,B.p.z) - B.p.x) * 0.6 * s` only on 'z' segments. Insert a gentle in-between course 4.5 (one soft zig with rails) so course 4 -> 5 is not a cliff.
2. Remove the pinned slow-motion. `bump()` sets `stopT = 0.05` on every contact, and `frame()` (deep.js line 454: `if (stopT > 0) { stopT -= left; left = 0; }`) eats the whole frame, so pressing into a slider runs the sim at about a quarter speed (game clock advanced 0.25 s per real second at the block). Rate-limit it: `bumpCd`, set `stopT` only if `bumpCd <= 0` then `bumpCd = 0.3`. In `collide()` for 'slide' also add a larger `nx * 3` push so you cannot sit pinned, and a ledge-side bias so the block never pushes you off the plank.
3. Make courses 1-4 ask for the thumb. They are clearable with a still thumb (PERFECT with no input). In levels.js put the golds on risky lines ('R'/'L' marks) from course 1, set par on 2-4 about 20 percent tighter, and call `placeGems()` so the gem lane weaves instead of running dead straight, so the 3rd star needs steering. This also shrinks the 4->5 cliff.
4. Make the callouts truthful and the HUD clean. In `handle()` 'land' (deep.js ~440, `e[2] > 0.45` -> NICE JUMP/AIR TIME/WHOOSH) fires on every respawn drop (I saw NICE JUMP at each spawn); gate it on `airT > 0.35 && !justSpawned`. The `chip()`/`ui.pop('TIP...')` text overflowed as a huge clipped ticker across the screen ("P: wait for the block to swing away"); cap the width and use `chip` only. The 'NEW COURSE' chip overlaps the title card on load: delay it to `ui.hideStart()`.
5. Almost and readability. (a) The red slider covers the ball at a low camera: in `frame()` raise the follow height/pitch by about 0.4 and set the block material to `transparent, opacity 0.75` when `|o.zc - B.p.z| < 3`. (b) Show a "SO CLOSE" pop plus a ghost marker where you fell (`fallZs` already stores it) so each loss reads as "one bounce off". (c) Replace the font-glyph stars (`starsHtml()`, the 3-slot HUD, `ui.pop` star text) with CSS/SVG stars; they showed as empty boxes in headless Chrome and will on any phone missing the glyph.

Verdict: TEST
