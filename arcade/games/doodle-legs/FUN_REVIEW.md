# doodle-legs FUN REVIEW (critic run 2, cold play, 2026-11-01, after the deep.js update of 00:18)

Setup: Playwright Chrome (channel chrome, headless), 390x844, touch, DPR 2, video + screenshots in /tmp (deleted afterwards), every non-127.0.0.1 host aborted. v1 = `/doodle-legs/index.html`, v2 = `?deep=1`. 10.5 min of real time per version. The player was a script: it reads the on-screen hint text, draws a small circle for "small / roof / tunnel" and a big loop otherwise, clicks Next / Again on cards, and redraws every ~1.2 s. It is dumber than a human (it never thinks about the shape, never aims at gems), so loss counts are pessimistic. Sound cannot be judged headless and is not scored. I judged from the text/event log and 30 screenshots per version, not from the videos. (Two earlier v2 runs were thrown away because my bot clicked the wrong card button; this review uses the clean third run. v1 ran at the same time as the first v2 run, so its slow stretches are partly host load.)

**FPS (requestAnimationFrame count over 5 s, headless software-rendered Chrome on a shared box, load avg 16-35):**
- v1 title 26.4, v1 mid-race 8.8 (measured while a second browser ran, so not a fair number).
- v2 title 31.6 / 21.4 (two solo runs), v2 mid-race 29.6 / 28.8 (solo runs).
- No clean, equal-load comparison of v1 and v2 was possible. v2 was never below 21 fps and never ran above 32. Nothing here proves a phone will hit 60. Check on a real mid-range phone. No page errors in either version.

## First 2 minutes, beat by beat

**v1**
1. 0 s: pastel title, checker track, "Tap the pad for legs, or draw your own. Race!" and a dashed pad. Nothing moves.
2. ~5 s: tap, three rival cubes (Ava, Sky, Kai) and a "3rd" tag, countdown, GO. Legs sprout as a scribble. First satisfying moment is about 8 s in (cube lurches off).
3. 12-22 s: cube climbs steps, "TAKE THE LEAD" style tag, flag, "LEVEL 1 CLEARED! Race won, 1 total. Tap to continue". No stars, gems, par, best time or reward.
4. 27-55 s: Level 2, same look. A "TAKE THE LEAD!" shows once, then I fall to 4th.
5. 55-120 s: "TOO SLOW! Ava reached the flag first. Tap to retry" (3 times in 2 minutes). No reason is given. Level 2 took 307 s to clear, L3 at 346 s, L4 still unfinished at 10 min. Nothing new appears for 10 minutes except a wall.

**v2**
1. 0 s: same title plus a small "any legs climb" chip.
2. 7 s: tap, countdown, GO, legs spin, "HUGE" live size label with a check, "AHEAD", cyan gem and "TAKE THE LEAD!" at 13 s. Something to chase within 8 s.
3. 18-24 s: "1st PLACE", "LEVEL 1 CLEARED" with three stars, "3/3 gems", "7.1 s / 14 s" par, "Kai was 4.7 s behind", "next hat 3/4" bar, a big Next button and a Daily Race button.
4. 26-43 s: Level 2 starts at once after Next, cleared with three stars and "NEW HAT! cap" at 43 s. A reward within the first minute.
5. 43-120 s: Level 3 ("draw a BIG loop" chip, PERFECT FIT, new hat "party" at 54 s), Level 4 (new hat "bow" at 69 s, "Tom was right behind!"), a loss on L5 with an auto-retry (card "Ava wins ... redraw your legs when you stall", about 2 s later back on the line), L5 cleared at 119 s. A hat, a gem or a call-out lands every 15-30 s.
6. Later in the 10 min: L6 hat (antenna), L7 (tophat), L8 (halo), L9 is a BOSS RACE (crown tag, 7 retries, 150 s) ending in "ALL 3 GEMS!" and "BOSS CHEST +3" plus horns hat at 379 s, L10 climb, L11 a tunnel level ("draw a SMALL circle", 4th place for ~3 min, cleared at 484 s with "Be 15% quicker for 3 stars"), L12 reached.

## Seven fun tests (0-10; a 6 is a 6)

| # | Test | v1 | v2 | Why |
|---|------|----|----|-----|
| 1 | 10-second | 5 | 8 | v1: the cube walks and climbs, but nothing pops, no gem, no reward by 20 s. v2: gem, "AHEAD", "TAKE THE LEAD!" at 13 s, three stars and par card by 24 s. A real hit inside 10 s would be a 9. |
| 2 | Toy | 6 | 7 | Same legs-on-a-cube toy in both and it is a good one: a loop becomes a wheel and rolls. v1 gives no feedback on the shape and is silent in the log. v2 adds a live "HUGE / BIG / TOO SMALL" label, dust puffs and gem bubbles. Frame rate (21-30 here) makes the legs stutter in both. |
| 3 | Almost | 3 | 6 | v1: "TOO SLOW!" with no cause and a surprise wall. v2: "1 m from the flag", "gems 3/3 so far", "right behind!", and on wall levels the chip and tip now say "draw a BIG loop". But the lose tip is still the generic "redraw your legs when you stall" half of the time, the chip on L1-2 says "any legs climb", and the boss and the tunnel level each ate 2.5-3 min of retries. |
| 4 | One-more | 4 | 7 | v1: "Tap to retry" card, slow cycle (a lose took ~6 s to be back racing). v2: lose card auto-restarts in ~2 s, Next is a big button, the next race starts instantly after Next (~1.5 s). Not under 1 s on a loss. |
| 5 | Surprise | 2 | 7 | v1: one idea (steps, then a wall) for 10 min, no new element. v2: a new hat on most levels, gold turbo, overtake and photo-finish call-outs, a boss race with a chest, a tunnel/small-circle level at L11, PERFECT FIT combo. No rare jackpot or fever seen in 10 min. |
| 6 | Mastery | 2 | 7 | v1: no stars, best, par or count. v2: stars, par time, "PERFECT FIT xN", "Be 15% quicker for 3 stars", gems; I got 3 stars on 10 of 11 clears. Shape skill is shown by a live label, so I can see myself improving. |
| 7 | Tomorrow | 1 | 7 | v1: a level counter. v2: hat progress bar "3/4" on every card, Daily Race with streak, a map with worlds and 44-star milestones, boss chest. I closed with a hat one star away and a world half done. |

**v1 average: 3.3** (min 1). **v2 average: 7.0** (min 6). v2 beats v1 on all 7 tests.

## What the best app-store game in this genre does in its first 2 minutes that ours still doesn't

The top draw-and-race games (Draw Climber style) make the first five or six levels un-loseable and show the lesson instead of writing it: a ghost hand draws the exact loop over the obstacle and the cube fails with a wobble until you copy it, a coin shower plays on every clear with a growing combo, and the player has seen a new skin, a new obstacle type and a character unlock by minute two. Fails always answer "what to change" by showing the shape you drew next to the one that works. Ours still has: (a) a lose tip that is often the generic sentence, (b) a boss and a tunnel level that cost 2.5-3 minutes of blind retries with no help after N failures, (c) no coin or currency shower and no combo that grows over several clears, (d) a title screen that starts silent and still, and (e) first-time clears that are 7-10 s each but not yet 15 clears in 2 minutes.

## 5 biggest fixes, in order

1. **Rescue after repeated losses.** After 2 failed tries on one level show a visible aid (the ghost loop drawn at the right size, or auto-bigger/smaller legs for 5 s, or a skip with 1 star). The boss (L9) and the tunnel level (L11) each took ~3 min; no new player should sit on one level longer than ~60 s.
2. **Make every lose tip specific and every hint show its answer.** Kill the "redraw your legs when you stall" fallback, show the real cause ("loop too small for the wall", "too big for the roof") and the shape that works as a ghost next to the pad. Fix the chip wording on L1-2 ("any legs climb") to something that teaches.
3. **Get a loss back on the start line in under 1 s.** Auto-restart now takes ~1.9 s behind a full card. Replace the card with a toast on loss and start the countdown immediately; keep the full card only on wins.
4. **Raise the ceiling of surprise.** Add a rare golden gem / chest cube (1 in 8 races) with a jackpot burst, a gem-combo that gets louder across a streak, and a fever state after 3 clean clears in a row. Right now the biggest moment is a hat on level 2.
5. **Confirm frame rate on a real phone and trim particles if under 50 fps.** Headless software rendering here gave 21-32 fps for v2 (and the stutter shows in the legs at that rate). Also add the coin/gem shower and a sound on every draw (could not be judged here).

Verdict basis: v2 average 7.0, lowest test 6 (Almost), v2 beats v1 on every test. That meets the TEST bar (avg 7.0+, none under 6, beats v1 on all) but not PASS (avg 8+, none under 7). Fix 1 and 2 lift Almost first.

v1 average: 3.3
v2 average: 7.0
Verdict: TEST
