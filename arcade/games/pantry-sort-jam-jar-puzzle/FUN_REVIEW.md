# Pantry Sort: cold-play fun review (critic run, 2026-11-01)

Method: Chrome via Playwright, 390x844 DPR 1, real mouse down/up taps on the jars, screenshots read after the taps, non-127.0.0.1
requests aborted. v1 = index.html, v2 = index.html?deep=1. About 10 min of session per version, but be honest about coverage:
I hand-played level 1 of each, then used my own small solver only to choose which jar to tap next (taps stayed human paced,
about 0.6 s per pour) so I could see more levels. v1 reached level 5 (levels 1-4 cleared). v2 reached level 10 (the boss), levels
1-9 cleared. I did NOT finish the v2 boss (level 10): my helper wandered for about 3 min and ended at 105 moves, so I cannot say
whether the boss is fair; that is the one place I could not judge. fps measured with requestAnimationFrame over several
minutes of play: v1 60.0 fps (worst frame 16.8 ms), v2 60.0 fps. No fps problem in either.

## Scores (0-10)

| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 6 | 8 |
| 2. Toy | 6 | 7 |
| 3. Almost | 5 | 6 |
| 4. One-more | 6 | 7 |
| 5. Surprise | 4 | 7 |
| 6. Mastery | 5 | 7 |
| 7. Tomorrow | 6 | 7 |
| **Average** | **5.4** | **7.0** |

Why:
- 10-second: v1 is a calm shelf, you pour twice and first jam lands around 25 s. v2 level 1 is only 2 fruits, so a jam plus a
  "CHAIN x2!" banner lands inside ~15 s. Good, but not an instant pop.
- Toy: lifting and pouring is pleasant (fruit flies between jars, gingham lid snaps on, petals). The sound/weight is mild and
  quiet; after 20 pours it is nice, not craveable. v2 adds the chain banners, so it feels a bit more alive.
- Almost: a stuck board is the player's own fault, undo is free and visible, no timer. That is fair, but nothing says "1 pour
  off". v2 adds "Perfect shelf!" and a par feel on the win card, small gain.
- One-more: Next level is one tap and the board is ready in ~2 s. The win card runs a 2 s coin/star animation first and
  asks for a rewarded video before the primary button; restart is under 1 s. Fine, not instant.
- Surprise: v1 levels 1-4 are the same toy with one more fruit (4 kinds by level 3, then a 6-jar board at 4); nothing
  unexpected in 8 minutes except a new stamp each win. v2 jumps to 4 kinds at L4, five fruits at L7, a named "Breather" at L9, a
  "Shelf boss" at L10, chain x3 / x5 bonuses, a chest meter. Surprise lives in the level script, not in the moment.
- Mastery: v1 shows 1-3 stars only. v2 shows best chain, "Perfect shelf!", coins by chain and a visible star-to-chest bar.
- Tomorrow: both have the larder, 24-stamp album and daily. v2 adds a chest "4 stars to the next chest" and shelves of 10.

## First 2 minutes, beat by beat

v1:
0:00 Painted pantry home, Play Level 1 big and obvious; two empty shelves look bare.
0:03 Tap play; a ribbon "Level 1 / 3 jams to make", jars of lemon, rhubarb, blueberry appear. Tutorial sentence over the buttons.
0:10 First tap: top fruit lifts, jar gets a gold outline. First pour: rhubarb arcs across. Pleasant, no sound shout.
0:25 Lemon Curd jam: gingham lid, sparkles, "Lemon Curd!". The first real reward, a bit late.
0:35 Level done, three stars, +25 coins, "New stamp: Garden Friends", Double coins video button above Next.
0:40 Level 2 is the same shape with new fruit; one empty jar spare. Easy.
1:10 Level 3: 4 fruits, tangled. First time I had to think. Wins feel the same as the first.
1:40-2:00 Level 4: six jars. The same 3-step loop again; no new thing happened in two minutes.

v2:
0:00 Same home plus a shelf strip with 10 level dots and "0 of 30 shelves". Shows the goal at once.
0:03 Level 1 banner "Nana's Shelf / Pour, match, make jam". Only 2 fruits in 2 jars, 2 empty.
0:10 One pour. 0:15 Strawberry jam and blueberry jam finish back to back: "CHAIN x2!" and "Blueberry Jam!" with petals.
0:25 Win card: "Perfect shelf!", best chain, +31 coins, "7 stars to the next chest" bar.
0:45 Level 2: 3 fruits, 2 empty; 1:15 L3; 1:45 L4 with 4 fruits and one empty jar; the board gets harder by the minute
instead of by the level. Worry: the rightmost jar of each row is clipped by the screen edge and the decor pitcher.

## What the best app-store sort game does in its first 2 minutes that this one still doesn't

The best water/ball sort games make each pour a tiny event with a sound (a rising pitch for each same-colour pour, a liquid
glug), and a finished tube plays a chime that goes up a note as you chain them. They also give you something new at about
every 20-30 s in the first two minutes (a locked tube, a mystery colour, a bonus tube) and bring in a visible
meta bar (rooms/pets/coins to an unlock) before minute 1. Here the sound is polite, the first twelve levels use the same
verb, and the only "new thing" is a bigger board. The win card also stops the flow with an ad button and a coin counter.
The leaders also get hard fast: the first stuck board arrives by level 8 and the player feels the "I need to plan" snap.

## 5 biggest fixes, in order

1. Give every pour a sound with rising pitch inside a chain; make the jam completion a loud, satisfying thunk and a screen
   pulse (the 8-10 level toy test is capped by feel).
2. Add one new element every 3-4 levels in the first 20 (a covered jar showing "?" fruit, a locked jar, a one-way jar, a
   golden fruit that pays double), not just more fruit kinds.
3. Show the "almost": when a board dead-ends or par is missed by 1-2 moves, say "1 pour off" and offer a 1-tap rewind to the
   move that mattered; surface par on the HUD (moves vs par) from level 1.
4. Cut the win card to one beat: show stars and a chest bar for under 1.5 s, put Next level as the thumb target, and move the
   "Double coins video" below it. Stream wins into the next board.
5. Fix the layout: the 4th jar in the top row is clipped at the right edge on a 390 px phone; verify the boss (level 10,
   8 jars, 6 fruits) is solvable by hand without a tool and not a wall for a new player (I did not complete it).

Verdict: TEST
