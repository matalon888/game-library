# Cube Trek: FUN_REVIEW (critic gate, 2026-10-31, cold replay)

Played on a 390x844 touch viewport (Chrome via Playwright, real CDP touch drags, non-local hosts blocked, video + screenshots).
v1 = default URL, v2 = `?deep=1` (game.js `READY=false`, so only `?deep=1` shows v2).
Time played: v1 about 12 min (7 levels cleared, lost level 7 twice); v2 about 11 min (levels 1-5 in the real flow, then jumps to
9, 10, 11, 13, 14, 15 and 20-22, 28, 30 and a deliberate loss on 22; about 17 min in total over two sessions).
Honest limits: the player was a script. It picks moves with the game's own solver/bot, then drags with a real touch, so "I lost the boss
twice" tells me the bosses are not trivial, not that they are unfair. I cannot hear audio in headless Chrome; sound is not scored down for that,
it is just unverified. Level jumps (`__game.load`) skipped the natural unlock order, so the map showed only 5 unlocked levels in my run.

## fps (requestAnimationFrame counter)

| Run | v1 | v2 |
|---|---|---|
| idle, first seconds | 10.5 | 12.5-12.7 |
| during play (2 s windows) | 10.0-13.0, avg 11.0 (9 samples) | 6.5-15.5, avg 13.1 (12 samples), 8.7 on a second, heavier run (boss levels 6.5-10.5) |

**Both are UNDER 30 fps in this test (about 10-15), and v2's boss levels dip to 6.5-8.** Caveat: headless Chrome on software GL (SwiftShader)
on a shared 48-core box under load 20-60, so the absolute number is pessimistic and says nothing about a real phone GPU. It is a three.js scene with
a glossy 3D board and instanced meshes, so mid-range Android is a real risk and must be measured on a device. No JS errors in either (only the
blocked external request).

## The seven fun tests (0-10)

| # | Test | v1 | v2 | Why (one line) |
|---|---|---|---|---|
| 1 | 10-second | 6 | 7 | v1 plays a demo drag by itself then wins L1 in about 10 s; v2 shows a glowing gap + hand and one drag clears the row, 2 gems fly to the counter, stars card |
| 2 | Toy | 6 | 7 | same chunky drag-and-drop in both; v2 adds shake, fever/on-fire bursts, ice crack and bomb blast; v1 has none of those. Pieces are still only 1-5 cells with no free-play mode |
| 3 | Almost | 5 | 8 | v2: fixed trays, move pips, "SO CLOSE!" and "2 gems + 10 ice left" so a loss is my plan's fault. v1: random trays, "1 gems left" after a jam on L7 felt luck-driven (and the grammar is wrong) |
| 4 | One-more | 7 | 8 | v1 tap-anywhere retry about 0.6 s. v2 "Try again" about 0.4 s, no wait, but the lose/win card sits on top of the board |
| 5 | Surprise | 3 | 6 | v1 is the same thing at levels 1 and 7 (more gems, bigger score). v2 adds ice (L11), bombs (L21), bosses (10/20/30), but L1-L10 are one-move puzzles and the first new thing arrives after about 4-5 min of real play; no rare or golden item, no mid-round twist |
| 6 | Mastery | 4 | 7 | v2: moves vs par, 1-3 stars, "Try for 3 stars", fewer moves is visible skill. v1 shows only a score that did not tell me if I improved |
| 7 | Tomorrow | 3 | 8 | v2: level map, "7 stars to the next crystal chest", Daily Dig banner, skins. v1: nothing waiting |
| | **Average** | **4.9** | **7.3** | v2 beats v1 on all seven; lowest v2 score is 6 |

## First 2 minutes, beat by beat

**v1 (about 2 min):**
0 s: board opens straight to level 1 with no title card, 2 gems and a gap. 0-2 s: a ghost hand and white ring show the gap, a piece
demo-drags itself. 5 s: I touch, the demo drops back. 10 s: gap filled, row bursts, gems fly, "0/2" goes to full. 12 s: the win card says
"Level 2". Tap anywhere (0.6 s). 20-40 s: L2, score 245, same thing but a few more gems. 45 s-2 min: L3 takes 75 s of looking for
spots for random pieces; nothing new has appeared by 2 min. It is a fine block puzzle with no reason to continue.

**v2 (about 2 min, real flow):**
0 s: opens straight on "First Light", 0/2 gems, 3 star pips, restart and map buttons. 1.5 s: glowing ring + hand on the gap and a
caption "one gap, one piece, two gems: cannot be lost". 6-12 s: I drag the piece; row bursts, gems fly to the counter, confetti,
"CLEARED! 3 stars, 1 move, par 1" with a bar "7 stars to the next crystal chest". About 14 s: tap "Level 2". L2 (two gaps), L3 (columns),
L4 (pick the right piece), L5 (a 5-long bar), each takes one or two drags and ends in 3 stars. By 2 min (my slow bot) I was on L3-L4: four
wins, 12 stars, "chest in 8", but I never failed once and each level lasted 15-25 s because it needs one well-aimed drop. Satisfying
but very easy; the first teaching is good, the first challenge is only L9.

## Notes from the other asked-for spots

- **Ice / bombs:** L11-15 ice (crack then clear) reads clearly (white ice, cracks, "gems fall out at once, the ice needs a second round").
  L21-22 bombs: orange bomb + blast + confetti on a single bar is the most spectacular moment in either version. Both feel like puzzles,
  not like a flow game.
- **Boss:** L10 solved quickly. L20 and L30 (Frost Boss, Summit): my solver-driven script lost both ("OUT OF MOVES, 2 gems + 10 ice
  left"). They are one-solution puzzles over fixed deals (the checker took 28 s to find L20's answer), so they are hard to brute force
  by feel; the boss moment is "bigger puzzle" with no spectacle or special intro.
- **Level map:** clean three-world grid, stars under each node, daily banner, skin shelf. Locked circles are all identical, so there is
  nothing to look forward to besides a count. Typo on the header: "chest in in 8".
- **Losing:** v2 lose card is honest and quick but overlays the board; v1 lose card is "NO SPACE!" and "Tap to retry".

## What the best app-store block-puzzle does in the first 2 minutes that this still doesn't

The best game of this genre has no levels at all in the first 2 minutes: you drop pieces into an empty board, and every drop clears or
nearly clears something, so the screen is constantly paying out (a 1-2-3 combo chain, a growing multiplier, an escalating sound ladder,
a bar that fills, a near-full board that makes your pulse go up). The surprise is in every clear, not in the 11th level. Cube Trek v2
is a series of 1-3 move logic puzzles: neat, fair, and rarely more than one payout per level, so combos, fever, near-miss and pressure
(its better juice) almost never fire. Also: no mid-round random reward (a golden gem, a chest that opens during play), no reason to
be afraid of the board, and rounds of 15 s have no rhythm.

## 5 biggest fixes, in order

1. **Make rounds longer and pressure-driven.** Levels 1-10 are 1-2 drags. Make 4-8 moves with a few real decisions from level 3 on so
   combos/fever/SO CLOSE actually fire, and so the "surprise" test sees something unexpected in the first 2 minutes.
2. **Bring the first new mechanic forward** (a cracked ice or a single bomb by level 5-6, a rare golden gem or a bonus chest during
   a round) so there is something unexpected inside the first 2 minutes.
3. **Frame the bosses** (intro, own look, 2-3 star bonus, a visible hint after a failed try): L20 and L30 are fixed-deal puzzles whose
   only solution a solver needs 28 s to find; add a "show me the idea" after two fails.
4. **Fix the fps risk**: profile on a real mid-range phone, simplify shadows and the instanced mesh count on boss levels (dropped to 6.5 fps
   in my run), add a quality fallback. Under 30 fps will make the drag feel sticky.
5. **Polish the cards and the map:** win/lose cards must not cover the board, so I can see what I did ("so close" needs the board visible);
   map nodes should show what is ahead (ice/bomb/boss icon for locked levels); fix the "in in" typo and "1 gems".

Verdict: TEST
