# Bolt Out FUN_REVIEW (critic run 2, 2026-10-31)

Played cold as a new player, 390x844 touch viewport, Chrome + SwiftShader (software GL), video + screenshots recorded, all
non-127.0.0.1 requests blocked. About 10.5 min of real-tap play per version (v1: 23 levels, v2: 24 levels, all pulled by tapping the
bolt handle with real mouse/touch clicks). I also hand-played wrong-order losses on v2 levels 3, 8, 15, 25, 36, opened the map, and
timed retry. Limits: headless, so I heard no sound and felt no haptics (code has sfx and buzz calls in deep.js, so Toy and
10-second carry that uncertainty). A solver picked the right bolt in the timed runs, so my timed runs show no organic losses;
losses came from the separate wrong-order probes.

## FPS (explicit)
- **Both versions are under 30 fps in my harness.** Solo, clean runs: v1 25.5 idle / 24.0 pouring; v2 23.8 idle / 23.0 pouring.
  During the 10-minute runs (two browsers in parallel) v1 dropped to 11.6 and v2 to 16.4 while playing.
- The box was heavily loaded (load average about 92, other agents' browsers running) and rendering is software GL, so a real phone
  GPU should do much better. I cannot confirm 30+ on a device. v2 is not measurably slower than v1.

## Scores (0-10)
| Test | v1 | v2 |
|---|---|---|
| 1 10-second | 6 | 7 |
| 2 Toy | 5 | 6 |
| 3 Almost | 3 | 8 |
| 4 One-more | 5 | 8 |
| 5 Surprise | 3 | 7 |
| 6 Mastery | 2 | 7 |
| 7 Tomorrow | 2 | 7 |
| **Average** | **3.7** | **7.1** |

Why, briefly:
- **10-second.** v1: one tap empties the tray into the jar with confetti inside ~5 s, nice but one-note. v2: same pour plus a
  "PERFECT" card with coins and a Fever pour bonus by ~10 s. Satisfying, but the pour is the whole show.
- **Toy.** The verb is a single bolt pull and a pour. There is nothing to do twice in a row: one tap solves level 1, then you wait.
  Tapping 20 times is not possible in any level. This is the weakest spot (6 is generous, from the pour and the hitstop/slow-mo
  on win).
- **Almost.** v1 cannot be lost at all, so no near-miss exists. v2 loses clearly and fairly: "GREY BALL! Grey reached the jar
  before it touched colour / Think about which bolt goes first", with the grey balls visibly in the jar. Level 15 shows "Dead end:
  try again". It reads as my fault and is fixable. It does not say how close I was (no "SO CLOSE" or percent-left on the card).
- **One-more.** v2 retry is about 160 ms from the loss card to a live board, and Next is one tap; wins and losses both put the thumb
  on a big green button. The win card gates every level though (one tap per level), and a loss costs a modal.
- **Surprise.** v2 changes every few levels: grey balls (L3), bombs, two lanes (L8), goo and twin bolts (Lab, L13), locks and keys
  (Foundry, L25), a BOSS (L36), jar unlocks, "World cleared" card. In my 10 minutes I reached the Lab and Foundry only through
  the solver; the new element is introduced by a text banner, not a surprise moment. No random reward (no golden ball, chest).
  v1 is level 1 repeated.
- **Mastery.** v2 has par, 3 stars (cleared, no mistake, quick), a star-gated jar shelf, hints. It does not make the same tap
  feel better when done better (no timing or aim skill), so mastery is purely about knowing the order.
- **Tomorrow.** v2: daily vessel waiting, streak counter, "N more stars for the Strawberry jar" bar, level map with locks, hard
  levels flagged. Good hooks, but the daily streak starts at 0 and nothing is ever "one away" in the first session.

## First 2 minutes of v2, beat by beat (real-time pacing, my taps)
- 0-2 s: pink gradient, no title card, straight into LEVEL 1 with a glowing ring around the only bolt, "Tap its handle", a
  pulsing pointer. Top HUD: trophy, level 1 to 2 progress bar, coins 3, Levels button, hint (2) and retry at the bottom.
- 6 s: tap. The tray drops into the jar, percent counter ticks to 100%.
- 9 s: "PERFECT!" card, +2 coins, "Fever pour: +1 extra", "Daily vessel waiting - streak 0", "3 more stars for the Strawberry
  jar" with a progress bar, green Next button. The star row was still animating (only 1 of 3 visible at 1.5 s).
- 12-25 s: level 2 is still one bolt. First real thought arrives with grey balls in level 3 (title "Grey needs colour"). A wrong
  pull gives the GREY BALL loss card; retry is instant.
- 25-60 s: levels 2 to 4 ("Colour, grey and bombs") each take one to three pulls, about 15 s each at my pace. Each ends in the same
  card with +2 coins.
- 60-120 s: levels 5 to 7, three stars per level, coin counter climbing, the jar-unlock bar filling. No new look, new
  sound cue I could see, or random event in the first two minutes. First big moment is after about level 12 ("WORLD CLEARED",
  "The Lab is open: Goo and twin bolts", "New jar: Grape! Using it now").

## What the best game in this genre does that this one still doesn't
Pull the Pin / Pin Rescue style hits: each pull is a fresh, funny, physical moment, there is a visible "ouch/clever" consequence
(a lava or enemy kill, a chain reaction), several pins per level so you are tapping constantly, and one level costs 20-40 s with
a mid-level near-fail that you rescue. Their first two minutes already include a trick (a wrong order that looks hilarious), a
big reaction on every pour, and a "choose your reward" chest. Ours: one tap per early level, the pour looks the same every
time, and the surprise is a text banner. Missing: escalating combo spectacle on pours, golden/rare balls, a chest pick, a loud
near-miss ("SO CLOSE: 2 balls left"), and more than one decision in the first 30 s.

## 5 biggest fixes, in order
1. **Toy.** Give the pour a toy layer: balls should bounce, pop, chime in rising pitch, and the player should be able to
   re-tap or wiggle something (jar shake, bounce, pop a ball) so a tap is fun when the level is already won.
2. **Make early levels 2-3 decisions each.** Levels 1-6 should have 2-3 bolts with a visibly wrong order so the player is
   deciding in the first 30 s, not tapping one bolt four times.
3. **Surprise.** Add random rewards: a golden ball, a mid-level chest pick, a bonus pour. Show it with a full-screen moment, not a
   banner, and make combo size escalate the effects (louder, slow-mo, "UNSTOPPABLE").
4. **Loud near-miss.** On a loss show "SO CLOSE: 4 balls left" with the jar fill percent and the ball that killed you highlighted;
   on a win with 2 stars say what the third star needed.
5. **Remove card friction.** Auto-advance after a short celebration (tap to skip), animate the stars so all three show in 1 s,
   and add a session goal ("3 perfect levels") and a first-session "one level from the Strawberry jar" so something is
   unfinished when the player quits.

Verdict: TEST
