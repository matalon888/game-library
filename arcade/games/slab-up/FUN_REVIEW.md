# Slab Up - FUN REVIEW (critic pass 2, 2026-10-31)

Method: Chrome (Playwright, channel chrome), 390x844 touch viewport, DPR 1, video on, every non-127.0.0.1 request aborted.
v1 and v2 (`?deep=1`) each played 650 s (10.8 min) in real time, both at once.
- 0-125 s: real touchscreen taps from a clueless new player (random rhythm, no aiming). Every lose/win card was also cleared with real taps.
- 125-330 s: `__game.auto(2.0)` (sloppy, about a human). 330-420 s: `auto(0)` for long perfect streaks. 420-650 s: `auto(1.0)`.
- Honest limit: I cannot read the slab position from outside the page, so the mid-run "perfect streaks" are the in-page helper (it calls drop() directly), not finger taps.
- Playwright's Chrome is silent. I did NOT hear audio. Sound is judged from the code (rising chime scale, fever arpeggio, buzz tone) and scores lean on that.
- Source for the seven tests: /home/studio/agentpark-studio/PLAYBOOK.md section 0.

**FPS (rAF, whole run, with video and a screenshot every 5-20 s):** v1 60.0 avg (p95 16.7 ms); v2 59.6 avg (p95 16.8 ms). Both over 30 fps, so the run is valid.
Note: my FIRST attempt at DPR 2 (780x1688 software-rendered frames) measured 27 and 25 fps. That was the headless GPU-less harness, not the game (a 15 s solo probe at DPR 1 gave 59 fps; at DPR 2 it gave 28-36). I threw that run away and replayed at DPR 1.
If a real low-end phone renders at DPR 2-3 without a GPU-class chip, the full-screen tall tower could cost more; I could not test that. Page errors: none; one console 'Failed to load resource' (unidentified, probably an aborted non-local request).
Tofu note: in headless Chrome every star glyph in the HUD pill, level tag and win/lose text prints as an empty box ("▫▫▫ 0/2", "2 -> ▫▫", "1▫ to unlock Mint"). Likely a missing font on this box, but a bare Android could show it too. The win-card star shapes use clip-path and are fine.

## Scores (0-10)

| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 5 | 8 |
| 2. Toy | 6 | 7 |
| 3. Almost | 5 | 7 |
| 4. One-more | 7 | 8 |
| 5. Surprise | 3 | 7 |
| 6. Mastery | 5 | 7 |
| 7. Tomorrow | 2 | 6 |
| **Average** | **4.7** | **7.1** |

v2 beats v1 strictly on all seven, but only by one point on Toy and One-more. v2's lowest is 6 (Tomorrow). Average 7.1 is TEST territory, not PASS (needs 8+, none under 7).

Why these numbers:
- v1 10-second 5: the self-playing demo drops two slabs, then the first real tap by a clueless player lost at score 0-1 over and over (sampled scores were 0-5 through the first two minutes, BEST 6 at 20 s; the first 21 came only at 2:35 when the sloppy helper took over). No cheering, only a tumbling slab and a number.
- v1 Toy 6: squash, falling offcut, rising chime scale (from code) are pleasant for 20 taps, but nothing escalates. Combo x4 and x8 show only "PERFECT x4" in the same text style; GROW at x6 is the only reward.
- v1 Surprise 3: LEVEL N! every 20 slabs (7 seen by score 122) is the only event. Minute 10 is minute 1 with a bigger number.
- v1 One-more 7: restart is instant, but a round is a few seconds and has no target except BEST.
- v2 Toy 7: same drop feel, plus escalation that works: rings, flash, camera push-in per perfect, FEVER (rainbow slab, wider window), NICE at x4, UNSTOPPABLE at x8, LEGEND at x12. Seen 4x each in the auto(0) block. Still the same single gesture, and I couldn't hear it.
- v2 Almost 7: the lose card says "SO CLOSE: 2 LEFT" / "Missed to the left. Wait for the middle.", the window widens after 1 and 3 fails, and "-65%" shows how much you lost. That reads as fixable. But see the tower-3 cliff below.

## v2 first 2 minutes, beat by beat (real taps, new player)

- 0:00-0:02 Title card "SLAB UP", a tall mint tower, a floating slab, hand icon with "Tap to drop the slab". Pastel gradient, white motes. Clean and instantly readable. HUD shows level badge 1 -> 2, bar, trophy.
- 0:02-0:03 My first tap starts Tower 1 straight away (no menu, no map). A "TAP TO DROP" pop appears, "TOWER 1" under the score, pill "▫▫▫ 0/2".
- 0:03-0:11 Tower 1 (7 slabs, wide, slow, cannot be lost: a miss still leaves a 0.9 stub). The demo bot drops the first two slabs for you, then my sloppy taps stack the rest. Big cut chunks show "-65%". Camera climbs. I did 0 perfects and still won.
- 0:11 Win beat: octahedron topper on the tower, confetti x2, 5-note rising fanfare, "TOWER DONE!", 1.1 s later the card: star row, "0 perfects · 2 -> ★★", "1★ to unlock Mint", green Next, Again, map, "Tomorrow: Daily Tower · 1-day streak". Rich but the 1.1 s pause plus card is the one dead spot in the loop.
- 0:12-0:20 Tower 2 (9 slabs, a GOLD slab at 5 with "GOLD ✦" pop). Won again with 0 perfects at 0:19. Card: "NEW PALETTE: Mint!" - the first reward lands at 20 seconds. Good pull.
- 0:22-0:30 Tower 3: first lose-able tower. Wide cut after one drop; stack is 7 slabs with a narrower start.
- 0:26-2:05 Stuck on Tower 3 with blind taps: 70+ fast losses (score 0-2, best 2 of 7). The loss card (dark gradient, "5 TO THE TOP", hint line, big Retry) clears with a tap anywhere and a new try starts in well under a second, so there is no dead time, but a player who does not aim never learns. The window widens (x1.25 after 1 fail, x1.5 after 3) and the speed drops (x0.92, x0.85), but a random-rhythm player never felt it.
- 2:05-2:30 First 1 perfect, Tower 3 clears and Tower 4 (rhythm: slabs slow at the ends) opens.
- Note: with auto(2.0) in the next block the bot reached Tower 27 in 10.8 min (27 win cards, 71 lose cards, through the HARD boss at 9 and the wind/ghost/diagonal worlds), total 47 stars, 8 palettes unlocked. A real person will be much slower, so the 10-minute depth is real, I just could not play it all by hand.

## What the best app-store stacker does that this still does not

The best stackers (one-tap tower builders with a tower that grows under a ball/blocks, level maps, themes) do these things:
1. A rhythm you can feel with your ear, not only the eye: the pitch climbs per perfect and the music/beat locks to the slab speed. Here the chime is a rising scale but there is no beat, so there is no "groove".
2. A first perfect inside 10 seconds that the player caused. Here the demo bot and the safe stub give the first win to a player who did nothing; they have a win with 0 perfects and the stars don't care. The first tower is an animation, not a skill moment.
3. A progression with surprise rewards that are visible from level 1: a gift/chest every N levels, a random skin or pet, a rare golden outcome. Here there are 12 palettes on a fixed star ladder: predictable and cosmetic. There is no variable reward.
4. A "feel the stack" physical read: a tower that sways, a tilt as it grows, a skyline that changes with height (clouds, sun, birds, stars) so height itself is the spectacle. Here only the gradient hue shifts and the motes drift.
5. Meta that survives the close: missions (3 daily goals), a visible chest at 9/10, a friends/ghost run to beat. Here only the Daily Tower and a streak counter, which is a good start, but the one unfinished thing on the lose card is "N LEFT" in this run, not something that lasts until tomorrow.

## The 5 biggest fixes

1. Tower 3 is a cliff for a new player. Towers 1-2 cannot be lost and need 0 skill, then tower 3 cut the blind-tapping player 70 times in 100 s with nothing teaching rhythm. Make towers 1-3 safe, or add a one-time ghost "aim here" marker/slow-mo on the first two misses. Pay the first star for a perfect, not for completing.
2. The first win must be earned. Remove the demo bot from the clear path of tower 1 (or let the player's tap override at the first touch), and show a "PERFECT" on tower 1 by widening tol to about 0.35 on the first 3 slabs so a first-time tap sometimes lands. A hollow win ("0 perfects") weakens the star system.
3. Cut the dead time between towers: the win card shows after 1.1 s and star animation takes about 1 s. Skip the card for non-milestone wins (a quick "TOWER 4 ★★" banner that auto-starts the next tower), keep the full card every 5th tower or a new palette.
4. Add one variable reward: a mystery gift every 3 towers (random palette piece, golden slab skin, extra-star hint), a rare "GOLD SLAB rain" 1-in-15 jackpot. Also 12 palettes are only star thresholds; make 3 of them random drops.
5. Make height the spectacle and make the tomorrow hook concrete: change the sky and backdrop by height (clouds at 10, stars at 20), swap the background per world, and put a persistent "chest 7/10 ★" meter and "Tomorrow: Daily Tower (new twist: wind)" on the lose card, not only on the win card. Also fix the star glyph (draw it with clip-path like the win card does, or use an inline SVG) so the HUD never shows empty boxes on a phone without the font.

Verdict: TEST
