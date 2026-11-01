# Slip Links FUN_REVIEW (cold critic play, 2026-11-01)

Method: Playwright chrome headless, 390x844 touch, non-127.0.0.1 requests blocked (only the Google font was blocked). 10 min wall clock each, real touch taps at human pace (350-850 ms think time). Target positions came from the game's own bot() hint (finger position), then tapped with a real touch. About 13% of taps were deliberate wrong taps on pinned chains to force losses. Software GL, so fps is low and only comparable between versions.
- fps (5 s rAF): v1 20.0 idle / 19.4 playing; v2 25.4 idle / 24.0 playing. Both are playable under software GL.
- v1: 50 wins, 2 losses, reached L51. v2: 42 wins, 14 losses, reached L43 (stars 1-3 spread, chest and paint unlocked, x8 LEGEND seen).
- Console: no page errors. A single failed font request (blocked).

## Scores (0-10)
| Test | v1 | v2 |
|---|---|---|
| 1 10-second | 6 | 8 |
| 2 Toy | 6 | 7 |
| 3 Almost | 4 | 6 |
| 4 One-more | 7 | 8 |
| 5 Surprise | 3 | 8 |
| 6 Mastery | 2 | 7 |
| 7 Tomorrow | 2 | 7 |
| **Avg** | **4.3** | **7.3** |

Notes: v1 is a clean toy but L1 to L50 play the same; only the theme changes (pond, beach) and there is no progress or goal besides a level number. Losses show only a generic card. v2 beats v1 on every test.
v2 loses points on Almost (loss card just says TANGLED / STUCK; the fatal cause is not shown, L27 lost 5 times in a row in my run, partly because my wrong taps were random), on Toy (silent in headless; visually good but a 3D chain at 24 fps feels slightly floaty), and on Mastery and Tomorrow (the star and chest meta works, but the daily knot sits behind a map button and the 9/10-chest pull is weak).

## v2 first 2 minutes, beat by beat
1. 0 s: "SLIP LINKS / Level 1 / star 0" card, pastel pond, 2 chains (yellow, green) on a peg board, a hand points. One tap starts.
2. 1-10 s: L1 has two chains and a wrong tap is free (hearts dimmed). Tap green, it slips off, confetti, tap yellow, board spins, CLEARED card with stars and time ("beat 6s for 3 stars"). First satisfying beat at about 5 s.
3. 12-16 s: L2, three chains, "Read the heights" hint appears; the chest bar (star 5 / gift 3) fills.
4. 20 s: map button is available (stars, chests, paints).
5. 21-26 s: L3 is the first losable level; a wrong tap costs a red heart.
6. 41 s: L5 (wrapped pegs). Win card: PERFECT, best streak x4, "3 stars to the next chest", "Daily Knot waits on the map".
7. 53-62 s: L7 is the first loss in my run: 3 hearts gone, TANGLED, tap, retry in about 0.3 s, won second try.
8. 70-97 s: L8 hard, L9 breather, L10 boss (7 chains), rain of confetti.
9. 99-119 s: World 2 starts (L11), snow theme, lock tags appear soon after; hearts occasionally lost (stars 2).
Pace is about 8 s per level; the loop is snappy and the first lose-and-retry happens inside 1 minute.

## What the best app-store game in the genre (Pull Pin / Tangle Master style) does that this one still doesn't
- Every tap has a physical, audible payoff: chain length drags and whips off with a slide, a satisfying click on each peg, and the screen gets a "juicy" clear. Here the slip is a silent-looking slide, confetti only arrives on the win.
- It teaches by showing why: a wrong tap makes the blocking chain flash or shake, so the loss feels fair and fixable. Here a wrong tap is just a heart gone and TANGLED / STUCK.
- A new twist or visible reveal every 3-5 levels with a one-line promo ("new: ice"). Here the locks, sparks and gold appear in the first minutes of a world but without a named intro beat.
- A near-miss and undo or hint: one free undo or a hint button after a loss. Here there is none (no rewind, no hint).
- Daily and streak hooks that surface on the title card (mini bar "chest at 7/8"), not only on the map. Here the start card has the star count but no goal bar.

## 5 biggest fixes (in order)
1. Make losses explainable: on a wrong tap, flash and shake the chain that is on top (and its crossing), and show "SO CLOSE: 2 left" on the lose card. (Almost test, 6 to 8)
2. Add a free undo of the last wrong tap (or a hint after 2 losses). L24-L27 swallowed me 5 times in a row.
3. Strengthen per-tap feel: chain whip-off with a pitch step per link, peg click, slight camera push, and spawn particles at every slip, not only on wins. (Toy test)
4. Put the next-chest bar and the Daily Knot on the title card and win card as a tappable big button; make tomorrow visible at 7/8 stars. (Tomorrow test)
5. Name each new element on its first level ("NEW: padlock") with a slow-mo reveal, and make bosses a different shape of board rather than only more chains. (Surprise test)

Verdict: TEST
