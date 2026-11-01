# Beatbuds FUN_REVIEW (fresh cold play, r4)

Method: Playwright + Chrome, 390x844 touch viewport, real mouse down/move/up drags from tiles onto buds, a screenshot after nearly every step, Playwright video recorded, googleapis/gstatic/agentpark.co/analytics/workers.dev/amazonaws aborted, nothing posted. Fresh localStorage for each build. I did not read the game code. About 11 minutes of wall-clock on v2 (Gigs 1-5, map, Free Jam) and about 11 minutes on v1 (two sessions, hidden combos 1 and 2, mashing). My scripted drags are more precise than a thumb. Mid-run my first browser pair closed unexpectedly, so I restarted both on fresh storage. No page errors were reported.
**Sound cannot be heard. Everything below is judged from motion and visuals only.**

## Performance (requestAnimationFrame over 3 s)
- v1: 60.3 fps. v2: 60.3 fps. Both are above 30, so the feel scores are reliable on motion.

## The four changes since r3, judged fresh
- Used tiles stay draggable and are less grey: confirmed. In gigs a used tile is a dimmed glass tile with a corner dot, and I could drag the drum a second time onto another bud. In Free Jam tiles do not dim at all (the same drum on 3+ buds). Good for Toy.
- Beat pulse every beat: present but subtle. Buds bob and blink, light beams shift hue, a dot row at the top steps along. In still frames I could not point to a clear glow ring tied to the beat. It reads as "the room is alive", not as a bar line.
- FULL STAGE chorus: real but short. When the stage fills there is confetti, a spotlight sweep and all buds light up; in Jam a big faded banner sits behind the buds for about 1 s; in gig 3 the full stage showed "HIDDEN COMBO! Quiet Please" with confetti and 3 stars. It is the best moment in the build and it is over in a blink. I did not see the literal words "FULL STAGE!" crisply in any frame.
- "N buds still silent" warning: confirmed. Play with 3 of 4 buds shows "1 bud is still silent" and the button becomes "Play anyway". Clear and kind.
- Tofu glyphs: gone. Play it, Retry, Next and the map button all render cleanly.
- New friction I found: drops onto buds fail silently a lot. In v2 Free Jam my first 7 drags, and many later ones onto the back row and outer buds, did nothing, with no wiggle and no feedback. In a fresh v1 session 10 drags in a row were ignored, then it worked, then ignored more (the explosion tile would not drop). Hit zones seem narrow and odd (front row accepted y=470 but not y=450; back row accepted y=215-255 but not 300-320). A thumb will hit this too. It cost me about 2 minutes.

## Scores (0-10)

| Test | v1 | v2 | Why |
|---|---|---|---|
| 1. 10-second | 7 | 8 | v1: tap, drag a tile to a grey bud, it wakes with a cap, open eyes, sparkles, tile greys. Fine, no goal. v2: the same wake plus a pointing hand on the first tile, a star popping on the top bar and a goal chip that ticks. A new player has a reason at second 6. |
| 2. Toy | 6 | 7 | v1: 7 buds, any tile on any bud, each bud changes look, but used tiles go grey, and in my fresh session many drags were swallowed. v2: gigs are 3-4 buds with goals, so a puzzle board; Free Jam is the real toy (7 buds, tiles never dim, full-stage confetti) but it sits behind a small button on the map and shares the flaky drop zones. 7, not higher, because of the dead drags. |
| 3. Almost | 3 | 7 | v1: hidden combos give no reason when wrong; there is no loss to feel close to. v2: per-slot tick/question mark ("drum ok, mic ?"), a riddle, and the silent-bud warning before Play. It tells me which SLOT is wrong, not which of my sounds, so 7. |
| 4. One-more | 4 | 7 | v1: nothing to retry. v2: result card about 3 s after Play, Retry is now a white pill the same weight as Next, and a retry-to-clean-set cycle is about 10 s of drags. Retry empties the stage, so I re-drag everything; no "same setup" option. |
| 5. Surprise | 5 | 7 | v1: new costume per drop, a "Hint!" toast, same by minute 5. v2: rules change by gig (gig 3 bans mics plus hearts, gig 4 energy, gig 5 stacks both), hats at gig 2 and 5, "Encore!" confetti, a full-stage chorus. The verb never changes, so 7. |
| 6. Mastery | 2 | 6 | v1: nothing measures improvement. v2: stars, "CLEAN SET . 3 drops", a hat bar; I solved by try 2 on gig 3 and the game said so. But the grade is a badge, not a ladder (no S rank, best, tempo or score), and gig 5 gave 2 stars without telling me what to improve. |
| 7. Tomorrow | 4 | 7 | v1: "tap for the next hidden combo" is a thin pull. v2: "6 stars to a new hat" bar at 14/90 stars, gig 6 locked behind gig 5 at 2 stars, secret sets 4/30, combos 0/8, Daily and Free Jam buttons. |
| **Average** | **4.4** | **7.0** | |

v2 beats v1 on all 7 tests (smallest gaps: Toy +1, Mastery +4 from a low base, 10-second +1). v2 lands exactly on 7.0 with a lowest test of 6, so it is at the edge of the TEST gate, not clear of it.

## First 2 minutes of v2, beat by beat
1. 0:00 Title "Beatbuds / Band Tour . 30 gigs" over a blurred stage. One tap to wake.
2. 0:03 Stage lights up: "Garage . Gig 1 Soundcheck", goal chips (drum 1+, mic 1+), 3 star slots, 3 grey sleeping buds, 20 tiles with small dots, a pointing hand on the drum.
3. 0:08 Drag the drum onto bud 1: it wakes with a cap and sparkles, the first star pops on the top bar and a "Play it" button slides up. Clearly satisfying.
4. 0:15 Tap Play with only 1 of 3 buds filled: instead of a silent 1 star, "2 buds are still silent" appears and the button becomes "Play anyway". New and good.
5. 0:22 Drag the same drum again onto bud 3: the tile is still usable and bud 3 becomes a second drummer. (In r3 this was blocked.)
6. 0:30 Fill all 3 buds: confetti burst, spotlight sweep, the whole stage bounces on the beat (the chorus). Fun, but about 1 s long.
7. 0:40 Tap Play: all buds sing with music notes; about 3 s later a "Nice gig" card with 2 stars and "Secret set: drum ok, mic ?". Retry and Next are equal white pills.
8. 1:00 Retry, put a different voice on bud 2: "Encore!", 3 stars, confetti, "You found the secret set", "CLEAN SET . 3 drops", a hat bar. The high point.
9. 1:30 Next: Gig 2 "Two Chords" (drum, piano, mic). First try 2 stars with a "?" and the riddle "snap, shine, sing"; second try 3 stars and a free cap.
10. 2:00 Gig 3 "Quiet Please": four sleeping buds, mics banned, a heart meter. The rules change and I am hooked on solving it.

## What the best app-store game in this genre does that this one still does not
Incredibox and Sprunki-likes start a loop at the first drop and every later drop audibly and visibly layers onto that loop, so within 30 seconds you are conducting a song with a clear bar line, buds that dance their own part, and a held "drop" that builds when the stage is full and just keeps going. The thing you made is the reward and it never stops: no Play button, no result card, no retry. Beatbuds still makes me press Play to hear my song, throws a card in the way, empties the board on Retry and holds the full-stage moment for about a second. The beat pulse exists but is quiet; I never felt a loop build. The best games also never eat a drag: a missed drop snaps to the nearest bud, so no gesture feels dead, while here a miss is silent. And the best gig/puzzle music casuals show a skill ladder (S rank, combo, tempo) so minute 10 feels earned; here a CLEAN SET badge is the only mastery signal.

## 5 biggest fixes, in order
1. Never lose a drag: snap drops to the nearest bud and wiggle or bounce a tile that misses. About 1 in 3 of my drags did nothing (front, back and outer buds, in Jam and in v1). It hits Toy and the first impression for every new player.
2. Make the loop start at the first drop and keep running: layer the song as buds fill, make the full-stage chorus a held 3-4 s "drop" (not 1 s), and turn Play into a "grade my set" step. Lifts Toy, One-more and the beat feel.
3. Make Retry keep the last setup (ghost placements) and trim the result-card delay so one more try is a single tap; put Free Jam on the map as an equal-weight button from the first visit.
4. Add a real mastery ladder: S/A/B rank beyond CLEAN SET (drops, time, streak), a best per gig, and a "SO CLOSE" line naming the wrong slot's sound family ("something that shakes"). Almost and Mastery are the lowest tests.
5. Make the beat pulse legible and escalating: a ring/glow on each bud on its own beat plus a bar counter, and rarer big moments (golden bud, bonus stage every few gigs) so minute 10 is bigger than minute 1. Also fix v1: hidden combos need to say why a try failed.

Average v2: 7.0
Lowest: Mastery 6
Verdict: TEST
