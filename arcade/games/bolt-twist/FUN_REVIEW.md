# Bolt Twist — fun review (critic run, 2026-11-01)

Method: Playwright + Chrome (swiftshader), 390x844 touch phone, ~11 min wall-clock per version, cold start (new player, empty storage).
Input was real touchscreen taps and touch-drags on bolts. The tap targets were picked by a small "casual" script, not by the solver bot:
it prefers a bolt that matches an open box (88%), otherwise taps a random free bolt, spins the toy by dragging when nothing is in view,
waits 0.5-1.2 s between taps, and taps the Next/Retry control on result screens. It is a rougher, less thoughtful player than a real
human, so loss counts are pessimistic and my "almost" score leans on the lose screen text and on the screenshots rather than on the loss counts.
Only 127.0.0.1 requests were allowed. Load average at start 17 (under 24). FPS measured with requestAnimationFrame over the whole run:
v2 avg 44.6 (min 25.7), v1 avg 35.1 (min 24.2). Both averages are 30 or higher, so the run is trusted.

Session outcome: v2 cleared toys 1-14 in 11 min (250 taps, 7 trays-full, reached toy 15, stars 1-3 each, 1 paint + 1 sticker + daily gift seen).
v1 cleared levels 1-11 in 11 min (345 taps, about 14 trays-full, ended on level 12). v1 had no stars, no map and no unlock on the way.

## Scores (0-10)
| # | Test | v1 | v2 |
|---|---|---|---|
| 1 | 10-second test | 6 | 8 |
| 2 | Toy test | 6 | 7 |
| 3 | Almost test | 5 | 6 |
| 4 | One-more test | 7 | 8 |
| 5 | Surprise test | 3 | 7 |
| 6 | Mastery test | 3 | 7 |
| 7 | Tomorrow test | 2 | 7 |
| | **Average** | **4.6** | **7.1** |

Reasons, short:
1. v1: level 1 is 6 bolts and a clear in 6 s with a "Nice!" and a soft pop, fine but flat. v2: same toy, plus a x-combo word, confetti, and a 3-star card in 5 s.
2. Both have the same pleasant fly-to-box arc and box swap. v2 adds streak words (x3!, x6 WOW!), colored bolt paints and key/lock/thaw pops. Still no strong per-tap tactile weight: the unscrew is a quick lift and fly, the sound is thin, and the bolt does not visibly spin out or thunk into the box.
3. v2 lose card names the cause ("pink + purple had no box open: spin for a bolt that matches") and the star chip tells you how many parks you can afford. That is the right idea. But the loss still often feels like the toy's fault: the tray fills at 4 slots with up to 4 colors and the next box colour is hidden except a 2-3 dot "NEXT" preview, so a casual player cannot see the dead end coming. Three trays-full in a row on toy 14 and on toy 5 and 10. A human would do better than my script, but not by a lot on the early toys. v1 just says tray full.
4. Retry is a tap anywhere and the toy is up in about 1 s in both. v2 shows "next 2 ▶" and replay side by side. The 3-star card and daily gift row slow the win to next-toy path by 3-4 s (each win screen waited for the star animation), so v2 loses a point there, but it is still above v1 because it has a reason to replay (stars).
5. v1 is toy 1 repeated with a bigger count of bolts: by minute 10 it is the same crate with more colors. v2 changes the toy theme every few levels (crate, house, robot, gift), brings in a gold key and padlock on toy 11, a "NEXT" preview, a daily gift, and sticker/paint pops. The new mechanic arrives later than minute 1-3 for some stretches: toys 1-10 have no new rule beyond parking and trays, so toys 6-10 are about 3 minutes of "more of it".
6. v2 shows a live star chip ("park 2 or less"), final star count with a near-miss line, par per toy, best star rank on the map. I got 1 star on toys 5, 9 and 10 and could see why. v1 shows nothing about skill.
7. v2: gift bar 1/3, "paint at 8 ★", toy map with the next node pulsing, daily gift day 1. Decent Zeigarnik hooks, but the gift bar and paints are shallow (a colour change on bolts, no collection slot that matters). v1: nothing at all after closing.

## First 2 minutes of v2, beat by beat (first-time player)
- 0:00 Page loads straight into toy 1, no menu, no splash. Header: trophy, "1 ► 2" progress bar, map button. Two boxes (green, blue) drop in on top, a 5-slot tray under them.
- 0:01 A speech bubble "Match the box colours!" and a pulsing hand on one green bolt. A wooden crate with 5 bolts on its front, one board plate.
- 0:02 First tap: the green bolt lifts, arcs into the green box, a soft "Nice!" fades in. The count falls 5 left to 4.
- 0:04 I clear the rest, the blue box swaps in as soon as it fills, a "x6" word.
- 0:05 "TOY CLEARED!" with 3 stars that stamp in, "Perfect: not one bolt parked!", gift bar 1/3, "Daily gift day 1", new sticker "Toy Crate 1", new paint "Candy!" and a green "2 ▶" button. That is a lot of cards stacked in the first 5 seconds of the first win: nice reward, but the screen is crowded and I read none of it.
- 0:10 Toy 2: 6 bolts, two layers, first plate to remove. A "Spin" nudge. Clear at 0:17 with 3 stars.
- 0:22 Toy 3: first time I park a bolt (2 parks). 2 stars. The tray finally matters.
- 0:34 Toy 4: a house, 9 bolts, par 1, the "park N or less" line is now under the bolt count. I park 4 and get 2 stars. A "NEXT" preview of upcoming box colours appears at the top right. This is the first moment where I feel I should have thought.
- 0:49 Toy 5: 4-slot tray and 9 bolts, my first TRAY FULL at 0:59 ("pink + purple had no box open: spin for a bolt that matches"). Tap to retry in 1 s. Second loss at 1:17. First win at 1:57 with 1 star.
- 2:00 Toy 6 (robot) starts. By now I understand: match, or park carefully, spin for the colour I need.

## What the best app-store game in the genre does in the first 2 minutes that this still does not
Screw Jam-class games (Screw Jam, Pin Out, Wood Nuts and Bolts) hand you a one-shot satisfaction loop with a physical, audible bolt: each tap
unscrews with a spinning rise, a metal click, a thunk into the box, the whole 3D toy shakes a little and the plank falls with a rumble and
a shower of debris. Level 3 is already a surprise (a new hardware type, a chained plank), and by level 5 there is a bomb/ads-free "boost" (undo
or extra slot) that rescues you from a near-loss and makes a loss feel like a choice. They also show you why you are about to lose (the tray
fills with a red warning pulse before the last slot) and let you pull a bolt back out. Bolt Twist's tap is nice to look at but not heavy to hear
or feel, plank falls are quiet, nothing rescues a near-loss, and the first 10 toys are all the same rule.

## 5 biggest fixes, in order
1. Make the loss avoidable and visible: pulse the tray at 1 slot left and 2 slots left, show on the tray which parked colours still have no box coming, and give one free "pop one parked bolt back out" rescue per toy. This is the lowest test (Almost 6).
2. Give the tap weight: bolt spins out with a small rise and a metal click, the toy shakes on every bolt, the plank fall gets a thud + debris, plus a distinct, rising pitch per chain so the first 20 taps feel physical. (Toy 7)
3. Put a new rule into toys 3-10, not toy 11: first plank chain, first spin-needed toy and first locked bolt by toy 6, so World 1 stops being "more of it" for 3 minutes. (Surprise 7)
4. Slim the win card: stars and one reward line, and auto-advance with a "next" ring on the button after 2 s; fold daily gift, sticker, paint into a single chest that opens on tap. First win should take 3 s to leave, not 6. (One-more 8, and clarity)
5. Make the meta pull harder: show "1 star from the 5-star world gift" on the lose card and on the map, give the sticker book a visible empty slot with a silhouette, and add a second daily goal ("clear 3 toys without parking"). Make the gift bar's 3rd tick open something worth looking at. (Tomorrow 7)

Verdict: TEST
