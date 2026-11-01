# Bloop Stack: fun review (cold critic run, 2026-11-01)

Method: Playwright chrome, 390x780 touch, every non-127.0.0.1 request aborted, empty localStorage per version, real taps (no bot, no
level skipping). `__game` was used only at the end to read the map/progress. About 11 min on v1 (levels 1-3 reached, best 103) and
about 10 min on v2 (levels 1-3 cleared, level 4 reached, 74% best on 1-4). No game code edited.

Honest limits of this run: I am an LLM with 5-10 s between looks at the screen, so I played in pre-planned tap bursts and many
bonks were my reaction latency, not the game. I cannot hear audio in headless Chrome, so sound claims are NOT scored from ears; the
toy score below is motion/visual only. The browser died once at minute 8 of v2 (machine load average 25-68, shared box); v2 save was
lost, so I replayed levels 1-2 and kept going (that is why v2 time is split).

## FPS (5 s rAF count, solo, headless software GL on a loaded shared box, load avg about 25)
- v1: 22.6 fps
- v2: 28.8 fps  -> UNDER 30, provisional. v1 (the simpler scene) was lower than v2 in the same conditions, so the box is the likely
  limit, but I cannot prove v2 holds 30 on a real phone. Re-measure on a quiet machine or real device.

## Scores (0-10)
| # | Test | v1 | v2 |
|---|---|---|---|
| 1 | 10-second test | 6 | 8 |
| 2 | Toy test | 6 | 7 |
| 3 | Almost test | 4 | 9 |
| 4 | One-more test | 7 | 8 |
| 5 | Surprise test | 3 | 6 |
| 6 | Mastery test | 4 | 7 |
| 7 | Tomorrow test | 2 | 7 |
| | Average | 4.6 | 7.4 |

Why:
1. v1 6 / v2 8. v1: first tap pops a coloured jelly block under Bloop, fine but quiet; the first wall kills you before anything
   bigger happens. v2: by second 6-8 a FLUSH word, confetti blocks, a gem and a colour change on Bloop all fire.
2. Toy. v1: 20 fast taps build a tower and shed cubes, pleasant but then you simply die (nothing rewards the spam). v2: same squeeze
   plus +N pop-ups, FLUSH/LUCKY words, Bloop changing colour per gem, hat unlock. Nice, but spamming still just builds a silly tall
   tower with no cost, so the toy has no tension. (Audio not heard.)
3. Almost. v1 says only "BONK! 12% of the way": no why, no fix. v2 says "BONK! 1 block short" (or "2 blocks short") and every wall
   carries white triangles / "+3" tags with the exact height. Every one of my ~15 bonks was my own fault and I knew the fix.
   Best part of the game. Docked 1: a "+2" tag does not say that a wall scrapes your lowest blocks, so I twice arrived with 1 block
   and thought I had 2.
4. One-more. v1: any tap after BONK restarts at once, level 1 is the same every time so retry feels good. v2: "Again" is one tap,
   restarts in under 0.5 s with the level already running. Docked 2: the restart button sits low-centre and a stray tap on the
   win/lose card is ignored, and every restart replays the same 5-15 s of easy opening before the hard part.
5. Surprise. v1: levels 1->3 are the same terrain at a different height, only the sky colour changes; nothing new in 11 min. v2:
   level title + one-line lesson per level (1-3 drops, 1-4 carry a gem), a hat unlock at 3 levels, the helper line "hint next try",
   Bloop recolours per gem. But levels 1-4 all feel like the same wall with a different number; by minute 8 I had seen no spring,
   no crusher, no rare golden anything. It is a slow drip.
6. Mastery. v1: BEST number only, no way to tell if you got better. v2: flush counter (0/5 -> 4/5 as I learned to carry the exact
   number of blocks), gems n/N, 3 stars, "Again for 2 stars", "2 more stars -> Red cap". I went from flush 0 to flush 4/5 on 1-3
   in about 6 tries and it showed. Docked: stars hide the rule (1 star for clearing, how I get 2 is only "all gems").
7. Tomorrow. v1: nothing (a progress bar 1->2). v2: 36-level map in 3 worlds with locked tabs, HARD flags, hat at the next star,
   a Daily chest card ("level 2, +2 stars") that I could not finish in 10 min, 2/108 stars. Real hooks, but there is no near-full
   bar the game pushes at you when you close it.

Verified new items from the last changes: helper after repeated fails: I failed 1-3 four times and the text said "helper next try",
but I never saw a ghost/helper on screen in the next try (could be hidden by my fast taps; unverified). Wall-height tags: work, big
win. Daily chest: shown on the card and map; I did not reach it, so jingle/confetti NOT verified. Tap-streak toy: not noticed.

## First 2 minutes of v2, beat by beat (fresh save)
- 0:00 Title tint, level chip "1 -> 2", a map button, "1-1 First wall, tap once per step", and a big "TAP to stack!". Bloop (a
  teal blob with a sprout) already waiting. No menu, no login.
- 0:03 First tap: a yellow block squeezes out under Bloop, small shake of cubes. A cyan gem shows on the next ledge. Instantly clear.
- 0:08 Second block, "FLUSH 1/4" pops as the wall is cleared with zero spare. Bloop turns blue-green after taking a gem. Good.
- 0:14 I over-stack a little and miss a gem I wanted; no penalty, no scolding.
- 0:20 Flag. Confetti, win card: "CLEARED! 1 star, 1/6 gems, flush 3/4, 2nd star: all gems" and "Again for 2 stars".
- 0:25 Next level. "1-2 Two high: a step of 2, tap twice" with white triangles over the wall. Two taps -> "LUCKY!".
- 0:50 I miss the 2-wall once: "BONK! 1 block short, 12% of the way, helper next try", one tap to "Again".
- 1:20 Level 1-3 "Down and up": first drop, then a +3 wall, FLUSH, a big FLUSH word on the 3-high clear, gem arcs.
- 2:00 Stuck on 1-3 (the second wall), four bonks in a row, still tapping Again because each bonk teaches the number.

## First 2 minutes of v1 (for contrast)
Title "BLOOP STACK", sprout Bloop, "Tap to stack a jelly block". Tap pops a block. By 0:10 you die at a wall ("BONK! 12% of the way").
Retry is instant, PERFECT! pops on a clean wall, best 15 -> 35 -> 103 by minute 3 as the level number ticks 1 -> 2 -> 3 on a thin
bar. After that every run is the same: wall, wall, roof, bonk. Fine toy, no reason to stay.

## What the best app-store game of this genre does in the first 2 minutes that this one still doesn't
Think of the stack-and-run kind of hit (grow a tower, pass gates, a boss at the end of the world). In the first 2 minutes it:
- Gives a new, bigger payoff every 20-30 s: a different gate type (multiplier, enemy, ramp), a rainbow trail at the best streak, a
  mini boss, coins raining. Bloop's first 2 minutes are one trick (walls) at four heights.
- Makes the tower itself the spectacle: the stack gets tall, wobbles, and a big combo number climbs with each clean pass and a
  rising pitch/haptic. Here a 6-block tower just sits there and the count only shows as +N.
- Pays out a visible currency at once (coins fly to a counter, shop/skin progress bar fills) so something is "almost bought" from
  minute 1. Here stars/gems/hats are a thin text row on a win card.
- Never kills the first-time player in the first minute: a forgiving first world with auto-assist, hard stuff later. Here the
  wall-height tags are great, but I still bonked 4 times on 1-3 in minute 2.
- Has a rare random jackpot: a golden gem or chest that fires in 1 of 5 runs. Here nothing is random, so run 6 of 1-3 equals run 1.

## Five biggest fixes, in order
1. Surprise (6): put a new thing in the first 3 minutes: a golden rare gem/bonus chest in a random slot of level 1-2, a spring pad
   or bonus block by level 1-5, and make the world look different every 3 levels. The first 8 minutes are one wall, 4 heights.
2. Make the tower the show: a wobble, a rising chime and a big combo number on consecutive flushes, a fever state after 3 flushes in
   a row (blocks worth double, speed-up), and a cost for spamming (a roof or "too tall" spot in 1-2) so the toy has tension.
3. Tomorrow and Mastery: show a near-full bar on exit ("1 star to Red cap"); say in the first win card what the 2nd/3rd star needs
   in one icon each (gems? flush all?); show the daily chest openly on the home/title and fire the jingle on the win card.
4. Make the early-fail fix visible and soft: the "helper next try" line promises a ghost; show it (a translucent Bloop doing the taps
   with tap-dots) and say on the card that a wall scrapes the lowest blocks ("wall takes 1; keep 3 for a +3 wall").
5. FPS: v2 is 28.8 fps on a loaded box and the browser crashed once in a long session. Re-measure on a quiet device; if still under
   30 cut shadows/particle count on low-end (it is the same scene as v1 but busier). Also move "Again" up to where the thumb is.

Verdict: TEST
(fps note: v2 28.8-29.8 fps vs v1 22.6-23 on a loaded software-GL box, load 25-50; v2 is faster than v1 and the low fps can only have lowered its scores, so the scores stand.)
