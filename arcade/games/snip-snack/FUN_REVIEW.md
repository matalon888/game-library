# Snip Snack FUN_REVIEW (critic run 35d, 2026-11-01)

Method: Playwright + Chrome headless, 390x844 DPR 1, software GL, real mouse down/move/up swipes, every non-127.0.0.1 host route-blocked.
fps (rAF over 3 s): v1 45, v2 46 at the title, v2 36.7 mid-level. All over 30.
Play: v1 about 25 attempts (L1 about 10 tries, L2 about 4, L3 3). v2 about 70 attempts: L1 1 (auto-win), L2 3, L3 about 7 (hint pin appeared after 3 losses), L4 about 9, L5 about 4, L6 about 6 (not cleared), plus the map, the Daily Dessert (3 ropes, not cleared), the leaderboard modal, L10 HARD (cleared 1st honest try with one wide sweep), L11 and L12.
Caveats: the headless screenshots lag 2-4 s behind the game under software GL, so several of my tries were mis-timed by my own reading, not by the game. v1 star glyphs and the v2 "x"/emoji glyphs render as boxes (missing font here). The NEW WORLD pop is a 500 ms text pop (game.js:259); I could not catch it in a screenshot, so I judge it from code plus the L10 win card, where it was not visible.

## Scores (0-10)

| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 4 | 8 |
| 2. Toy | 4 | 6 |
| 3. Almost | 3 | 7 |
| 4. One-more | 5 | 8 |
| 5. Surprise | 3 | 6 |
| 6. Mastery | 2 | 7 |
| 7. Tomorrow | 1 | 7 |
| **Average** | **3.1** | **7.0** |

v2 beats v1 on all seven. v2 average 7.0, lowest 6, so it earns a TEST, not a ship.

## v1 in a sentence
Bare strings and one sleeping hedgehog. Loss card is always "MISSED! Pip is still hungry". No restart button, no map, no stars that show, no reason to return. A 3 in a player's eyes.

## v2, first 2 minutes beat by beat
1. 0:00 Title "SNIP SNACK" over a swinging candy, Pip asleep, "1 · First Snip" under the HUD. Restart and menu buttons already there.
2. 0:02 Tap to start. The candy swings through the stars on its own: "NICE!" then "SWEET!" pop, 2 of 3 stars lit with zero input. Good hook.
3. 0:06 First swipe cuts the rope. Candy drops, Pip wakes, eyes widen (level 1 cannot be lost, Pip lunges if needed).
4. 0:09 Win card: 2 stars, chest bar, "Replay for 3", three buttons (map, replay, next).
5. 0:15 L2 "Swing Time": one rope, Pip moved to the far side. First real decision: when to cut. First loss on try 1-2.
6. 0:25 Loss card: "It dropped past Pip. Snip while it swings over him", and on retry a dotted white ghost arc of the last miss. The ghost is the best new thing: I saw at once I cut too late.
7. 0:50 L2 cleared on try 3. L3 "Two Strings": a static V, no time pressure, but which rope first? Pip looks at the candy with his eyes.
8. 1:20 After 3 losses a pulsing pin plus "CUT THE GLOWING PIN FIRST". It helps, but it only names the first rope, not the timing.
9. 1:50 L3 cleared (3 stars on replay), the chest bar fills, a new candy skin arrives. L4 "Right Order" shows next.

## What the best app-store rope cutter does in its first 2 minutes that this still does not
- The creature is the show. Om Nom reacts to every swing, opens his mouth, licks, cheers, and the first eat is a big payoff. Pip mostly sleeps, then opens his eyes; the eat is small.
- One new toy every 30-45 s (bubble, spider, air cushion, spikes), each with its own set piece. Here the first 2 minutes are strings only; the bubble arrives at L5.
- Real rope physics play: ropes stretch, the candy swings, you can cut while it is mid-arc to throw it, and star collecting asks for risky cuts. Here a single wide horizontal swipe cuts every rope at once, so L10 "HARD" fell to one sweep. The cut has no skill in it, and when it matters the candy hangs still with no time pressure.
- A map as a world: boxes, art, a path. Ours is a flat 5x2 grid with half the screen empty, the title under the trophy button, and worlds 2 and 3 only as lock tabs.

## 5 biggest fixes (in order)
1. Make the swipe matter: a stroke that crosses 3 ropes should cut only the first or follow a real blade length and speed; otherwise HARD levels are a wipe. Add a short cut recoil and snap sound so the toy test climbs from 6.
2. Pip as a character: eyes and mouth track the candy, an open mouth when close, a sad droop on a loss, a big eat animation with particles. This is the biggest gap to the genre leader.
3. Surprise earlier: bubble by L3, one spectacle per 3 levels, a rare golden candy, a combo callout when 3 stars are taken in one drop. L1-L4 feel identical.
4. Loss card precision: show the distance ("0.8 candy-widths left of his mouth", the star count you got) every time, not only under 1.5 units; the generic "dropped past Pip" came up almost every loss. Hint the timing as well as the first rope.
5. Meta polish: a real world map (path, art, world 2 and 3 previews, a visible NEW WORLD moment that lasts more than half a second), fix the title overlapping the trophy, the win-card buttons sitting on Pip and over the HUD buttons, and the close button on the leaderboard.

Verdict: TEST
