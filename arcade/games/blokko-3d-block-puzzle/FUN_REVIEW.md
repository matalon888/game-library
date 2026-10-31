# Blokko FUN_REVIEW (critic lane 13, 2026-10-31, second cold replay)

Method: Playwright chrome headless, 390x844, v1 (index.html) and v2 (?deep=1) played at the same time, 10.5 minutes each as a
new player. Non-127.0.0.1 hosts aborted. About 12% of v2 taps were real mouse taps at random spots near the shape (94 of them,
so some losses are my sloppy input, not the design); the rest used the free-cube helper (`__game.bot()`), which also gives the
shape a random spin now and then. v1 used the same helper (no real-tap losses, so I saw no v1 loss card). v2 went from level 1
to level 24 on its own (world 1 and 2 played through, Boss of world 2 reached). World 3 (stone cubes, bombs) I could only reach by
jumping with `__game.load(25/30/36)` because World 3 is locked until level 24 is cleared; I saw it, I did not earn it.
No sound heard (headless): sound judged from code only. Screens read from screenshots, not video.

**FPS: v1 averaged about 32 fps (range 19-58, mostly 25-40); v2 averaged about 39 fps (range 25-53).** Both are 30+ on average on
a loaded shared machine (load average 45 at the start), so no frame-rate defect. Provisional only where a 10-s window dipped to
19-25 (v1 more often than v2).

## Scores (0-10)
| Test | v1 | v2 |
|---|---|---|
| 1 10-second | 6 | 8 |
| 2 Toy | 5 | 7 |
| 3 Almost | 4 | 7 |
| 4 One-more | 5 | 8 |
| 5 Surprise | 3 | 7 |
| 6 Mastery | 2 | 7 |
| 7 Tomorrow | 3 | 7 |
| **Average** | **4.0** | **7.3** |

Why, briefly:
- v1: start screen "BLOKKO / Tap a cube to slide it out", then a bare score counter and three hearts. Win card is "CLEARED! /
  72 cubes cleared / Share / Tap to continue". Level 16 after 10 min is level 1 with more cubes. No stars, no goal beyond the next
  number, nothing to want tomorrow except a leaderboard trophy. A fine toy for 2 minutes, then flat.
- v2 10-second: no menu, a pink 8-cube shape with arrows, hint "Tap a cube whose arrow points to open air", first slide within
  2 s, whole level cleared with confetti and a "BRILLIANT!" at about 8-10 s. Real payoff inside 10 s. 8.
- v2 toy: slide-out, rising note per clear, coin tick, a visible bump on a wrong tap. Still no squash or per-tap puff I could see
  between the big bursts, and the helper cannot tell me about haptics. Good, not addictive on its own. 7.
- v2 almost: the loss card now says "OUT OF HEARTS / 15 of 27 cubes cleared" with a progress bar and "The glowing cube was free to
  slide", and the cube it means really glows. Fair and fixable. Hearts are now 5 on levels 2+ (3 on world-2 levels), which stopped
  the old level-11 wall: I passed level 11 (36 cubes) and 12 with 1-2 hearts left. The big "SO CLOSE" only appears when 65%+ is
  cleared, so my 15/27 loss got the quiet card. 7.
- v2 one-more: Retry is now the big green button, "Keep going 8 coins" and "Levels" are small under it. One tap, restart under a
  second, no loading. A lost level 5 was back in play 2 s later. 8.
- v2 surprise: level 4 gold cubes, level 13 "Who is that?" (hidden `?` arrows, new colour world, dark navy cubes with yellow
  arrows), a HARD tag on 17, a BOSS gold-framed level 24 (48 cubes, lost to it 3 times in a row), stone and bombs in world 3 by
  jump. Real new ideas arrive at levels 4, 13, 17, 24. But levels 5-12 (8 levels, about 3 minutes) are just bigger shapes with
  names (Steps, Donut, Archway, Zigzag, Checker). First surprise after the gold cube is a 2.5-minute gap, then a 5-minute gap. 7.
- v2 mastery: par per level and a live "TAPS 20/27" counter, a 3-star preview that drops with mistakes, "Again for 3 stars" on the
  win card, per-level star rows on the map, a total star bar (55/108 at 10 min) and skin unlocks. A better player visibly gets
  more. Real skill ceiling is still low: finding the free arrow is a read, not an order puzzle, on most early levels. 7.
- v2 tomorrow: map with 3 world tabs, World 3 shown "locked", level 17 and 24 marked HARD/BOSS with stars missing, "13 more stars
  for the Rainbow cubes" bar (about 25% full, not close), daily shape with streak text, coins 375 and 2 hints. Plenty
  unfinished. The skin bar is the weak one: far from done at minute 10. 7.

## The first 2 minutes of v2, beat by beat
- 0:00 Opens straight into level 1 (no menu). Pastel pink gradient, 2x2x2 cube of pink arrow cubes, "First slide / Tap a cube
  whose arrow points to open air", 3 hearts, TAPS 0/8, PAR 8 with 3 stars, bulb badge "2", coins 3.
- 0:02 First tap slides a cube out with a note. The shape drifts so it reads as 3D.
- 0:03-0:09 Eight taps, no decisions, each a clean slide. A tap every second or so with the helper; a human is slower.
- 0:10 Last cube, confetti of coloured cubes, "BRILLIANT!" fades in. The strongest early beat. Card: "PERFECT!", 3 stars, "8 taps ·
  par 8", coins up, "N more stars for the Mint Fizz cubes" bar, big green Next.
- 0:12 Level 2 "Spin it": 12 cubes, hearts jump to 5. First time you must drag to find an arrow. Cleared at 0:23.
- 0:25 Level 3: 12 cubes, cleared at 0:35 with no mistakes. 0:38 level 4 "Gold dust": gold cubes sparkle, +coins; 1 mistake;
  cleared at 0:49. First real new element, at 49 s.
- 0:52 Level 5 "Steps": 27 cubes. At 1:12 out of hearts, 15 of 27 cleared (my blind taps): card with Retry, glowing hint cube.
- 1:14 Retry, back in play in about 2 s. 1:41 cleared with 1 mistake, 1-2 stars. 1:58 level 6 begins.
  By minute 2 a new player has seen: a win burst, stars, a new cube type, a fair loss and a one-tap retry. That is a good opening.

## What the best app-store game in this genre does that this one still doesn't
- Its first 2 minutes are 10+ levels of 5-10 seconds, with a combo or chain feel on EVERY tap (a rising pitch, a squash, a
  flying-out arc that lands on camera, a haptic tick), so the 8th tap of level 1 is the satisfying moment, not the confetti at the
  end. Ours is a calm one-note slide; the shape is 8 cubes and the finale is 90% of the thrill.
- The best game makes the puzzle an ORDER puzzle from early on: the arrow that is free now blocks one that was free a moment ago, so
  you plan three taps ahead and the near-miss "I should have taken that first" is the loss. Here, levels 1-12 are mostly "find any
  free arrow", and the helper that taps random free cubes cleared levels 1-23 nearly perfectly (par on most). If a random bot
  gets 3 stars, there is no skill ceiling yet.
- It pays the player in a way that grows the thing they stare at: a theme or a scene being built, a pet or a room, new shape
  silhouettes (a heart, an animal) that reveal as you clear. Ours pays coins and a skin bar that is a quarter full after 10 min.
- A mistake there is a soft shake and a lost star, never a run-ending state with a card. Ours still ends the level at 0 hearts
  and asks for a Retry (fast, but still a fail wall; the boss lost 3 times in a row for the bot).
- Spectacle ramps (chain of 5 clears flings the whole stack with slow-mo, camera push). Ours has a burst on win and no
  mid-level crescendo I could see.

## The 5 biggest fixes, in order
1. Add real order to levels 1-12: from level 3 on, make the shape so that at least one early free cube blocks a later one (and so
   a random free-cube bot does not 3-star it). Par should be hard for a bot. This is the mastery and almost fix together.
2. Fill the gap at levels 5-12: put a new element (a moving arrow, a two-hit cube, a rare golden jackpot cube worth 20 coins)
   at about level 6 and 9, so a new thing appears every 1-2 minutes, not 2.5 then 5.
3. Weight every tap: squash, a small puff, a rising chain number "x3 x4 x5" from the third tap of ANY level, and a slow-mo plus
   camera push on the last 3 cubes. Level 1's 8th tap should be the best moment, not the confetti.
4. Make the loss softer and louder at once: show "SO CLOSE: N left" at 50%+ cleared (not only 65%), and let the 0-heart state
   cost a star and hand back 1 heart once per level so the player is not thrown out of a 48-cube Boss for a third mistake.
5. Make the skin/cube-collection bar visibly almost done at the end of the first session (first skin at 6 stars instead of
   about 20, so the player closes the app one level from a reward), and show tomorrow's daily with a preview shape on the win card.

v2 average: 7.3
v1 average: 4.0
Verdict: TEST
