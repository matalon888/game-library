# Pose Rush: FUN_REVIEW (critic run 6, 2026-11-01)

Played cold as a new player on a 390x844 touch viewport (Chrome, software GL, Playwright, touch taps, mouse-drag for limbs, analytics/API
hosts blocked, video + screenshots). v1: 10.5 min (plus a 2.3 min re-run for fps). v2 (?deep=1): 10.5 min, level 1 to 21, 310 beats,
51 level clears, 5 losses. Input was a human-like bot: 0.3-0.7 s reaction delay after the slow-mo starts, taps at random spots, and on
every 2nd v2 "HIT" beat a real drag of the nearest limb ring onto the gold target ring (82 drags, re-aiming at the live ring position).
I cannot judge sound or haptics (muted headless), so no credit or blame there. No game code was edited.
deep.js changed after the last review (run 5), so this is a fresh replay, not a recheck.

Two of my own scripting mistakes, for honesty: (1) v1 needs a tap on its "LEVEL CLEARED" screen and my first bot did not tap, so I threw
that run away and replayed; (2) my first v2 drags used stale ring positions, so they counted as taps ("0 with style"). Fixed, replayed. All
numbers below are from the clean runs.

## Measured fps (requestAnimationFrame, 3 s windows about every 45 s; software rendering, read as relative, not phone numbers)
- v1 (re-run, machine load about 15): 51, 48, 49 fps.
- v1 (full 10 min run): 20-24 fps the whole time. NOT the game: the shared box was at load average 48-62 (other critics' browsers on
  the same 48 cores) and the same build did 45-51 when I measured it at load 8-20. Reported because it is under 30; I do not blame v1.
- v2 (10 min, level 1 to 21, load about 20): 43-52 fps, mean about 48, low 43 at 9.8 min. No downward trend. Nothing under 30.
- No page errors in either clean run. Two earlier runs died with "page/browser closed" (box contention or someone else's cleanup); not
  reproducible, not counted.

## Scores (0-10)

| # | Test | v1 | v2 |
|---|------|----|----|
| 1 | 10-second test | 7 | 8 |
| 2 | Toy test | 4 | 6 |
| 3 | Almost test | 1 | 6 |
| 4 | One-more test | 3 | 8 |
| 5 | Surprise test | 2 | 7 |
| 6 | Mastery test | 1 | 7 |
| 7 | Tomorrow test | 1 | 7 |
| | **Average** | **2.7** | **7.0** |

### Why
1. 10 s. Both: title, one tap, slow-mo at about 3.5 s ("TAP TO HIT!", rings on every limb, gold ring on the thug), a hit at about 5 s
   (v1 100 points, v2 125 + PERFECT). In both, the very first strike is thrown by a demo, so it is a watched hit, not mine. v2 is
   crisper (score pop, PERFECT) and the title no longer has a cut-off goal line (fixed since run 5). 7 / 8.
2. Toy. The kick in slow-mo with the camera swing is pleasant for about 5 reps, then it is the same animation. v2 has a second toy, the
   limb drag (the ring grows and a tick plays), which is the only thing that feels like playing instead of watching, and it is only
   explained by the small title hint and by the result card. A tap anywhere still triggers the same auto move. v1 is the tap only. 4 / 6.
3. Almost. v1: it hardly has losses, it has a soft-lock (below). When it did kill me (4 times in 9 levels) the score reset to 0 and I did
   not see why: a 1. v2: 5 real losses in 56 attempts, all from my deliberate late taps. The card says "SO CLOSE! A TAP EARLIER" with a
   Retry. Problems: it says "SO CLOSE!" even for "0 of 5 thugs down" (L10), so the copy lies; there is no visible window bar or timer, so
   the loss is a card, not a picture of a fist an inch away. Fair and fixable, not yet "ouch, one frame". 6.
4. One-more. v1: a loss throws you to score 0 behind a "tap to continue"; no Retry, and a soft-lock needs a page reload that also
   resets the level: 3. v2: Retry / Next / Again / Map on one card, back in play in about 1.5 s; I replayed L17 five times for the 3rd
   star without thinking. 8.
5. Surprise. v1: the same kick plus the same dodge for 10 min (the dodge is in from L2). v2: new element about every 20-40 s: lean-back
   bullet L3, cluster L5, hop barrel, shield thug, swaying target (L13), a sunset palette from L13, FEVER and x3..x6 combo, a yellow thug
   skin, a bald boss with a bat. Mostly rule changes rather than spectacle, and the 10th minute still looks like the street of the
   1st (a different colour). 2 / 7.
6. Mastery. v1: a score and BEST, and the score resets: 1. v2: this is the real improvement since run 5. The card now says "DRAG a limb
   by hand = 2 stars (taps alone stay at 1)", and it is true: my tap-only clears at 4/4 perfect got 1 star, and drags at 6/6 perfect with
   style got the full 3. So the player's skill (dragging onto a moving ring) is rewarded and visible (PERFECT x/y, styled count,
   x-combo, score 125 on the first level and over 6000 by L20). Still: a tap-only player can clear all of it, so mastery is optional. 7.
7. Tomorrow. v1: nothing. v2: a bar to the next outfit ("1 star to the Red Hero outfit", "3 to the Sunny outfit"), outfits unlock every
   2-3 levels (Violet, Red Hero, Sunny, Ninja, Teal Racer, Pink Punk), "Again for more stars", and "Daily Gauntlet is waiting on the map".
   The pull is real. But the daily line is small text under the card and I never see a streak or a chest at 9/10. 7.

## The first 2 minutes, beat by beat

### v1 (a real new player, no reloads)
- 0:00 Title "POSE RUSH" over the running purple hero and a pointing hand, hint "Tap in slow-mo to strike or drag limbs".
- 0:02 Tap; a red thug is a few strides ahead. 0:04 slow-mo, rings on every limb, "TAP TO HIT!". 0:05 BANG, 100 (a demo hit).
- 0:10 second kick, 250 points. 0:15 "LEVEL 1 CLEARED!" under an orange arch, "Tap to continue" on a checkered floor.
- 0:17 Level 2, kick, then at 0:22 "TAP TO DODGE!": a first bullet. It works the first 2-3 times.
- 0:59 Level 4: at 1:04 the dodge pose fires, the hero falls down, the thug stays pointing at him, "TAP TO DODGE!" stays on screen
  forever, slow-mo never ends, taps do nothing. At 1:16 I reload (the level restarts at its start). 13 such soft-locks in 10 min,
  1 in the 140 s re-run, almost every level from L4 on. A new player quits here, at about 1:15.
- 1:20-2:00 After the reload: level 4 again, the same kick and the same bullet; level 5 at 1:47.

### v2
- 0:00 Title: "POSE RUSH", goal line "one big win: kick two thugs" (fits now), hint "Tap in slow-mo to strike or drag limbs".
- 0:02 Tap. 0:03.5 slow-mo, rings on all four limbs and a gold ring on the thug. 0:05 BOOM, 125 and PERFECT (a demo hit).
- 0:10 second kick. 0:13 "LEVEL 1 CLEARED!" card: a star, "2/2 perfect", the 3-star recipe, "NEW OUTFIT: Violet!", a bar "1 to the Red
  Hero outfit", Next / Again for more stars / Map. A real reward moment at 13 s.
- 0:15-0:30 Level 1 again or level 2 ("high and low targets"): my first drags land (ring grows, "styled" count shows on the card).
- 0:30 "NEW OUTFIT: Red Hero!" after L2 (3/3). 0:45 L3, "first bullet: tap to lean back", the hero leans, then the thug is hit; 725.
- 0:48 L3 card shows ONE star at 4/4 perfect: "DRAG a limb by hand = 2 stars (taps alone stay at 1)". That is the best moment of the
  first 2 minutes: the game tells me what to do better, and I want the star.
- 1:10 L4 card: 4/5 perfect, 2 with style, 1388, "NEW OUTFIT: Sunny!". 1:25 L5 cluster fight. 1:40 L5 again for stars, 788. 1:57 L6.
- Something new every 15-30 s and an outfit every 40 s: the 2-minute mark clearly differs from the 10-second mark.

## What the best app-store game in this genre does that this one still doesn't
(Genre: one-finger slow-motion / timing fighter, the Fruit-Ninja-meets-Mr-Bullet kind.) In the first two minutes the best game of this type:
- Shows the danger, not a card about it. You see the blade or the bullet cross the screen in a readable arc, and a miss freezes on the
  inch you missed by. Here the near miss is text ("A TAP EARLIER") with no picture and no number, and it says SO CLOSE at 0 of 5.
- Makes my choice change the move. Each action produces a different animation, sound and payoff. Here the drag only changes a
  counter (stars). The kick looks the same whether I drag the foot or tap, so the skill part is invisible on screen.
- Pays out in the moment. Every kill drops coins or gems that fly to a counter I can spend (a new weapon, hero or skin, shown on
  the hero immediately). Here a kill pays a score I cannot spend, and an outfit shows up on a card but not on the hero when I am
  next playing (I saw only the purple default hero in all 21 levels).
- Changes the scene and the enemy within the first minute (a new location, a different silhouette, a signature boss finisher with a
  big freeze-frame). Here levels 1-12 are the same sunny street and two thug skins; the sunset is a recolour. Camera on L20 even leaves
  the hero half off-screen at the left.
- Has zero dead steps: no result card between consecutive wins in the early levels. Here a card with 3 buttons stops every 12-20 s.

## The 5 biggest fixes, in order

1. Fix v1's dodge soft-lock, or retire v1 from the A/B (READY is false, so nobody sees v2 yet and v1 is what real players get). 13
   soft-locks in 10 min, on every "TAP TO DODGE!" beat from L4: the hero falls, the tip stays, the slow-mo never ends, only a reload
   (which restarts the level) helps. Checked again in a re-run: it reproduces. v2 never hit it in 310 beats.
2. Make the skill visible and the loss visible (Almost + Toy). Show a window bar in slow-mo; on a loss, freeze on the fist/bullet and
   print the gap ("0.2 s late"); never say "SO CLOSE" below 60%. Give a drag-kick a different, bigger animation and a "STYLE" pop
   than a tap-kick so the drag feels like a toy and a skill, and teach it in L1 with a ghost finger (now only the hint line).
3. Pay in the moment, with something I can see on the hero. Coins or gems from every kill flying to a counter; the unlocked outfit
   worn by the hero in the next level and in the kill-cam, and a "wear it now" button on the unlock card. Today the outfits are a
   text line.
4. Different set pieces, not recolours: a rooftop, a train and a market with their own thug silhouettes, a golden thug with a chest
   pop (1 in 15), and a boss with a unique finisher and freeze-frame. Levels 1-12 are one street. Fix the camera that leaves the hero
   half off-screen (L20).
5. Cut the dead steps and sharpen tomorrow: auto-advance after a 3-star win (a 1 s banner instead of the card), put the Daily
   Gauntlet and the streak on the first card ("day 1, come back tomorrow for x2"), and show a chest at 9/10 stars on the card at
   the moment I would quit.

Verdict: TEST (v2 average 7.0, no test under 6, beats v1 on every test; it is not at the 8.0 ship gate, and Toy 6 and Almost 6 are the
lowest). Do not turn on READY for v1 users unless fix 1 lands.
