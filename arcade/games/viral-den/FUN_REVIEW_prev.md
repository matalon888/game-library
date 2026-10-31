# Viral Den: cold-play critic review (v1 vs v2), second pass

Critic run, 2026-10-31. Played as a new player on a 390x844 touch viewport (Playwright + Chrome, real CDP touch events, DPR 1, video
and screenshots recorded). Sources served from `hc-games`. Analytics/API hosts blocked. `__game.auto` was **not** used.

- **v1** (`index.html`): 10.5 min of tap-spam with occasional shop taps. Ended on video 5 (about 189K followers, camera/lights/room/gear
  all upgraded at least 3 steps).
- **v2** (`?deep=1`): 10.8 min, 23 videos played in order by real touch events timed off `__game.notes`/`songT`
  (taps, holds and flicks; bias +10 to +80 ms, 35 ms jitter, 6% skipped notes). Then one short extra session: video 3 played badly on
  purpose to see the fail sheet and the retry.
- Not heard: headless, so **audio is not scored from experience**. The tofu boxes in some labels (the "7 [] to fan mail" line) are
  a headless font gap, not a game bug.

## Frame rate (read this first)

Rig: headless Chrome on a 48-core Linux host with **software GL (SwiftShader, no GPU)** and a host load average of 55-64. So absolute
numbers are pessimistic, and the run is **PROVISIONAL** for the reason below.
- v2: median **39.5 fps** (23 samples, range 34-44). At DPR 2 the same page measured 16.8 fps on this rig, so I played at DPR 1.
  Never under 30 at DPR 1.
- v1: median 41 fps over 30 samples (34-60), but **from about 7:40 on v1 sat at 19-21 fps for the last 2.5 min** (8 samples in a
  row under 30, while the room was maxed and the score was in the 100Ks). I cannot tell game from host load here (v2 ran first, under
  the same host), so **v1's run is provisional and v1's late-game frame rate is a flag**, not a proven bug.
- v2 with DPR 2 under 30 fps is a rig artifact (software rendering); a real phone GPU is needed to confirm.

---

## Scores (0-10, honest)

| # | Test | v1 | v2 | Why |
|---|------|----|----|-----|
| 1 | 10-second | 9 | 8 | v1: the first tap pops "+4", an emoji and a number at once, no waiting. v2: one tap on the title, a short lead-in, and the **ghost taps are gone** (my first real tap landed 2 s after "tap to start": "PERFECT +82ms", x2, thumbs-up emoji, a pointing hand shows where to tap). Much better than last time, but v1 is still one beat quicker. |
| 2 | Toy | 6 | 7 | v1: bubble wrap with floating numbers and a hype bar, but 10 minutes of the same tap anywhere; it is a clicker. v2: every hit has a pitch, "PERFECT +Nms", sparks, an emoji over Kai, "N combo" text, "10 COMBO NICE!" banners. Good. But a tap 80 ms late still says PERFECT, so a sloppy tap and a clean tap feel the same. |
| 3 | Almost | 3 | 8 | v1: nothing to lose, a 40 s timer vs a goal. v2: I played video 3 badly on purpose and got "TREND OVER, 91% short, 7 taps off the beat, missed at bar 1, 2, 3, 4, you tap 99 ms late: tap a hair sooner" with the red miss strip. It was my fault and I knew why. I never saw a true "SO CLOSE" (<=20%) because my good runs won every time. |
| 4 | One-more | 5 | 7 | v1: no rounds; levels roll on a timer, so there is no retry moment. v2: retry/next to play in **0.2 s** (median 0.23 s over 22 presses; two loaded outliers at 1.4 s). Big green button. **But the win sheet is taller than 66 vh and scrolls inside itself: on 6 of 23 videos the NEXT button's centre was at y=831-865 on an 844 px screen, so the button was half cut off and I had to scroll the sheet to press it.** A real thumb hits the cut-off edge, or gets annoyed. The fail sheet fits (RETRY bottom at y=828). |
| 5 | Surprise | 6 | 8 | v1: the den rebuilds as you buy (desk, red chair, sofa, plant, LIVE neon, camera on tripod) and that is lovely, but it is bought with taps by me and by video 5 it is maxed. v2: **the room now changes by itself**: string lights and a lamp by video 3, a rug and a pink bean-bag by video 5-7, a new set at world 2 (brown walls, posters, speakers, bed) and a different palette every video; new note types arrive on a schedule (golden at 8, holds at 11, trolls at 14, a HARD video at 16, swipes at 21). I never opened the shop and the room still grew. |
| 6 | Mastery | 2 | 7 | v1: skill is irrelevant. v2: ms on every hit, % perfect, 1-3 stars, NEW BEST, a miss strip, an average-bias line. My (bot) accuracy was nearly flat across 23 videos, so I cannot say I "got better". The bias line says "tap a hair sooner" every time, which is true for my bot but means nothing as feedback loop. A 90 ms perfect window caps how much improvement can show. Swipe videos (21-23) gave my flicks only 1 star each, so the flick has a skill gap the game does not explain. |
| 7 | Tomorrow | 4 | 7 | v1: red-dot upgrade cards ($2.5K, $8.9K), nothing else. v2: "DAY 1 STREAK +20, come back tomorrow for 40", "7 stars to fan mail" bar, "N more followers for the next star", a 10K plaque. Good Zeigarnik hooks, sitting inside an end sheet that is too crowded. |
| | **Average** | **5.0** | **7.4** | |

v2 avg 7.4 (>= 7.0), nothing under 6 (lowest 7), and it beats v1 on tests 2-7. **It does not beat v1 on test 1 (v1 9 vs v2 8)**, so
by the gate it is not a TEST yet.

---

## Look-fors

**Does the room change by itself across the run?** Yes, a clear step up from last review. Videos 1-2: bare grey room. By 3: string lights,
a floor lamp. 5-7: a rug, bean-bag/bed colour, the pink pillow. World 2 (11+): warm pink walls, window posters, speakers, a stage rug.
Video 15-20: more speakers and a red/yellow/pink poster wall. The backdrop colour also changes every video (pink, mint, lilac,
orange, sky). Still missing: no reaction to combo (at 47 combo the room looks like it did at 3 combo), and the sheet hides the room
while the new prop appears.

**ms on hits.** Works and is readable ("PERFECT +82ms", "LATE +91ms"). Timing is lenient: +82 ms still reads PERFECT in the live
shot. There is a "TOO EARLY" and a "SLOW DOWN" lockout for tap spam (new, good).

**Fail sheet / miss strip / bias line.** Better than before: "missed at bar 1, 2, 3, 4" names the bars; "tap a hair sooner/later" advises;
the shop is hidden on a fail. Still no "retry from bar N". On a win the sheet carries stars + 5 chips + daily + fan-mail + strip + bias +
den tiles + buttons: too much, and the button is cut off (see test 4).

**Juice on combo/viral.** Lane turns purple and notes turn gold at x5 (seen on video 1 already), confetti, emoji over Kai, big combo
banners. Fine. The 3D room is still a static backdrop for the show.

---

## v2's first 2 minutes, beat by beat

1. 0:00 Title: "VIRAL DEN", Kai in a bare room, a pointing hand, "Tap to film content". Clear.
2. 0:02 One tap: the bottom lane slides up, a ring and pink discs scroll toward it, "HYPE x1", a hand icon on the ring. Short lead-in.
3. 0:04 My first tap on the first disc: "PERFECT +82ms", score 20, x2, a thumbs-up over Kai. No ghost taps now.
4. 0:06-0:09 4 combo, flame, laughing emoji, hype x3. The pitch of each tap climbs along a hook (inferred; not heard).
5. 0:12 12 combo, x5, the lane goes purple and the discs go gold stars, hearts over Kai. The best 5 s.
6. 0:16 Video 1 ends after about 14 s: "VIDEO POSTED!", stars, +562 followers, 94% perfect, 16 combo, "DAY 1 STREAK +20", fan mail bar, a 4-tile
   shop, and the NEXT button peeking half-hidden at the bottom edge.
7. 0:19 I scrolled the sheet and pressed NEXT; video 2 started in 0.2 s (mint world, "Morning routine").
8. 0:46 Video 3 "Room tour": lilac sky, a string of coloured lights and a lamp have appeared in the room. First "LATE +91ms" shows.
9. 1:12 Video 4 "Trying the trend", orange sky, a 27-combo run, hype x4.
10. 1:30-2:00 Videos 5 and 6, cyan sky, a pink rug/bean-bag, "10 COMBO NICE!". Two 2-star finishes; both gave "N more followers for the next star".
    Still one lane, tap anywhere: by 2:00 the verb has not changed.

---

## What the best app-store rhythm game does in its first 2 minutes that this still does not

1. **A real song you play along to**: the notes ARE the melody and the backing track swells with your combo. Ours is a short synth hook per
   world; you are not playing a track, you are tapping on a clip.
2. **Multiple lanes or positions**: every tap is a decision (left/right/both). Ours is one lane and a tap anywhere counts. 23 videos in,
   the thumb does the same thing. Holds and flicks (video 11 and 21) add shapes, not decisions.
3. **A tight perfect window you can feel** (+/-40 ms) with different looks for early and late. A +82 ms tap is "PERFECT" here.
4. **The whole screen is the instrument**: background pulses on the beat, scenery changes with combo, fever changes the world. Our room
   is a backdrop; it does not move to the music.
5. **An unlock every 60-90 s that you did not buy**: a new venue, character, song. We now have prop-per-video, which is a good start, but there is
   no named, collectable thing ("new outfit unlocked").

---

## The 5 biggest fixes, in order

1. **Fix the end sheet so the thumb button is always on screen** (`finish()` in `deep.js`; CSS `.vd2-sheet` max-height 66vh).
   Pin the NEXT/RETRY row (position: sticky; bottom: 0) outside the scrolling area, and cut the win sheet to: stars, 3 chips, one hook
   line (next star / streak), the strip. Move the shop tiles behind the 📺 map button. This is the One-more test and the first thing
   a player feels at the end of each video.
2. **Make the perfect window mean something** (`WIN` in `chart.js`; `judge()` in `deep.js`): about +/-50 ms on perfect, ramping tighter
   after world 1, and colour early vs late differently, so +82 ms is "GOOD" and a clean tap feels earned. Lifts Toy and Mastery together.
3. **Add a second decision to the verb** (`mk()`/`melody()` in `deep.js`, `levels.js` charts, `down()`): two lanes from video 4 or so.
   One lane with tap-anywhere is the biggest gap against the genre.
4. **Let the room react to play** (`stageFx()` in `game.js`, `onViral()` in `deep.js`): light pulse on the beat, neon on at x5, crowd
   silhouettes or props that bounce at 30 combo, and show the new prop appearing (a pop and a name) instead of silently between videos.
5. **Check frame rate in the late game and make the first hit even faster**: v1 dropped to about 20 fps after minute 7 in my rig, so look
   for a particle/emoji/mesh leak that grows with the score; for v2, confirm on a real phone at DPR 2 (16.8 fps on my software GL). And
   let the very first tap on the title be a note (start the lane immediately under the thumb), to match v1's instant pop.

---

Verdict: FAIL
