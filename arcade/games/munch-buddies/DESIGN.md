# Munch Buddies: DESIGN (deep v2, lane 90, 2026-10-31)

Rhythm duet: two kittens, snacks fall to the beat, tap each side as a snack reaches its kitten, hold for long treats,
never munch a bomb. Every munch plays the next melody note. Same name, same toys, same pastel art in v2.

## Numbers (db copy, 12 plays in 7 days, 12 players)
Median ~21 s; 3 of 12 quit at 6-7 s after 1 tap (all landing on a saved level 8: "lost|8"); only 1 run past 40 s. v1 jumps
straight to the saved level (difficulty by song length only), no map, no stars, no reason for tomorrow.

## Five layers (0-3) today -> v2
| Layer | v1 | v2 |
|---|---|---|
| Core verb | 2 (timing, perfect window, hold) | 3: twins (two thumbs), traps (wait), fog (trust the beat) |
| Core loop | 1 (survive song, 3 hearts) | 2-3: goals per level, golden snacks, fever x2 after 8 in a row, near-miss line |
| Level design | 1 (levelPlan: song order, longer + faster) | 3: 30 authored stages in 3 worlds, purpose line each (levels.js), sawtooth with bosses at 10/20/30 |
| Meta | 0 | 3: stars (3 per stage), level map, treat box every 6 stars -> 12 stickers, Daily Duet + day streak |
| Feel | 2 | 3: gold burst, fever glow, ON FIRE / UNSTOPPABLE / LEGEND, star card, hearts |

## Mechanic plan
1 tap (L1) -> 2 two kittens alternate (L2) -> 3 bombs (L3) -> 4 hold treats (L4) -> W2: 5 twin snacks (L11), 6 golden
snack (L13), 7 trap bomb (L16) -> W3: 8 fog (L21), 9 rush tempo climb (L24), 10 everything (L25-30).
Boss = L10 Mountain King, L20 Rondo alla Turca, L30 finale. Breather level opens each world.

## First 3 levels
L1 12 s, 9 hearts (cannot be lost), the kittens even munch the first four by themselves (v1 demo). L2 forgiving, alternating.
L3 first bombs only.

## Stars
1 = cleared, 2 = at most one miss, 3 = no miss and perfect rate >= the level's par. Treat box every 6 stars (random
unowned sticker). Daily Duet: one song per UTC day from a date hash, same chart for every player, stars + streak.

## Fairness
flow.k() still scales lookahead, snack gap and bomb chance as before; no other difficulty input. Board score unchanged
(levels cleared per day, B.submit(1) per clear).

## Status
deep v2: shipped 2026-10-31 (Verdict: TEST, critic avg 7.0)
