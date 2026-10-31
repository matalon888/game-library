# Putt Isles: FUN_REVIEW (critic lane 58, 2026-10-31)

Method: Chrome (Playwright, 390x780 touch viewport, software WebGL, non-local hosts blocked). v1 (`index.html`) and v2 (`?deep=1`) each played cold for 10.5 minutes, run one after the other. Play was by a drag-bot (random aim and power, retries after every loss, taps NEXT on win), plus manual screenshots and reading the win/lose cards. The bot is blind to the aim line, so it is a harsher player than a human. Treat the clear counts as a floor, not a score.

## FPS (requestAnimationFrame, 1.5-2 s windows, load low)
| | idle | during drag | rolling |
|---|---|---|---|
| v1 | 43.1 | 38.2 | 45.4 |
| v2 | 39.7-40.8 | 40.9 | 42.2 |

Both are above 30 fps, so the run is valid. This is software GL; a real phone GPU will be better. An earlier run with two sessions in parallel dipped to about 30, so the numbers above are from sequential runs.

## Seven fun tests (0-10)
| Test | v1 | v2 | Why (v2) |
|---|---|---|---|
| 1. 10-second | 6 | 8 | The ball is on a lit floating island with a flag, racers (Kai/Nora/Bo) and coins. A "Drag back to putt" hint appears at once and there is no title card in the way. The first putt gives a trail, a coin pop and "+1". v1 opens with a title and a self-playing demo putt that is too soft to sink. |
| 2. Toy | 6 | 7 | Drag gives a ring, a dotted aim line, a coloured trail, hit-stop and slow-mo, and bumpers squash. It is pleasant, but there is no real "thock" weight. v2 also lost the v1 power-% readout in my drag screenshot. |
| 3. Almost | 5 | 7 | Out of strokes shows "18 m from the cup · par 3", which is clear and honest. A 45 s timer and a stroke cap sit on top of racers, so some losses are the clock rather than the shot. The First Leap jump gives no hint of how hard to hit, so the bot lost about 340 s on it. Fixable but a bit blind. |
| 4. One-more | 7 | 8 | "Tap to retry" is instant, with no screen between tries. v1 is also instant but loses on the same hole. |
| 5. Surprise | 3 | 7 | v2 brings a new idea every 1-2 holes: bumpers, sliding blocks, spinners, jumps, then sand, boost and ice worlds. Holes 1-4 still look and feel alike, and there is no rare golden coin or jackpot beat. In v1 hole 2 already looks like hole 3, with only a re-skin. |
| 6. Mastery | 3 | 7 | Par, 3 stars per hole (par and all coins) and a coin count give a visible target. There is no "best stroke count" memory and no skill shot such as an ace bonus. v1 has only place and strokes. |
| 7. Tomorrow | 2 | 7 | The map shows stars out of 90, "N to a new ball", ball skins, a daily hole with a streak, and a "Next: <hole name>" teaser. Nothing is at 9/10 yet, so the pull comes from the 90-star bar. v1 has just "level N+1". |
| **Average** | **4.6** | **7.3** | Minimum is 7 in v2. v2 is above v1 on all seven. |

Bot result: in 10.5 min v2 cleared holes 1-4 and 6-8 (7 wins, 8 holes opened, 244 shots, lots of time stuck on the jump hole). v1 cleared 2 holes in 250 shots and sat on hole 3's neighbour, hole 2, for 8 minutes.

## First 2 minutes of v2, beat by beat
1. 0 s: the island loads straight into play. Snow clouds, pine islets, red flag, three bot balls beside mine, a ticking 45 s clock, "1st". It looks like a mobile game on the first frame.
2. 1 s: a "Drag back to putt" pop. No menu, no tutorial text wall.
3. 3-6 s: I drag, which gives an aim line and a ring. I release, the ball rolls with a trail, and I pick up a coin with "+1".
4. 8-15 s: the racers putt in real time. The place changes (1st to 4th), which creates pressure.
5. 15-25 s: sink the ball. "IN THE HOLE!" shows 3 stars animating in, strokes vs par, coins 1/2, "5 more stars for a new ball" and "Next: Turn Left". Big NEXT button.
6. 30-50 s: hole 2 bends left. This is the first real aim decision. A miss costs a stroke, not the round.
7. 60-90 s: hole 3 has bumpers, the first new element. The win card keeps showing the next goal.
8. 90-120 s: hole 4 (S Curve), then hole 5, a jump with a gap. This is the first wall: power is a guess, the camera shows the far platform but no landing hint, and "OUT OF STROKES" arrives.

## What the best app-store golf game does in its first 2 minutes that this still doesn't
Golf Battle and Mini Golf King style games give a clear, physical shot feel. They have a crisp power meter with a sweet-spot band, a camera that frames the whole shot, and a "thock" sound with haptics. Every hit has a distinct sound and a visible ball spin. The first 2 minutes are a stream of tiny, quick wins (long putt, bounce-off-wall bank shot, hole-in-one celebration with fireworks) plus a clear, near-immediate unlock such as a new ball or club after only 2-3 holes. They also let you see the whole hole, wall bounce prediction lines for the first shot, and replays of the best moment. This game has the look and a good rhythm, but it still lacks a power sweet-spot skill layer, per-hit sound and haptic weight, a wall-bank preview, spectacle at each milestone (hole-in-one, combo) and an unlock inside the first 2 minutes.

## 5 biggest fixes, in order
1. Make power readable on jumps. Add a visible landing marker or a "full power" mark on ramp holes. Show the power % in v2 as v1 does. Give a one-time hint after the first lost jump. (Almost test, and the bot sat 340 s on hole 5.)
2. Add skill to the verb. A sweet-spot band or a perfect-power bonus that scores a "Perfect putt" with a bigger pop, so a better player visibly does better on hole 1. (Toy and Mastery.)
3. Add variable reward and spectacle. A rare golden coin or a bonus hole, a hole-in-one fireworks card, and a streak "Birdie x3" fever. Holes 1-4 currently look the same. (Surprise.)
4. Give an unlock inside the first 2 minutes. The first new ball should come after 3 stars, not 5-6 holes, then show the progress bar on the lose card too, and remember best strokes per hole. (Mastery and Tomorrow.)
5. Feel and fairness of the timer. Add a hit sound and haptic per putt and per bumper, pause or relax the 45 s timer when the ball is still rolling, and keep the stroke cap from ending the round with "OUT OF STROKES" before the player knows why. (Toy and Almost.)

Verdict: TEST
