# Tiptoe Tower: cold fun review (critic run, 2026-11-01)

Method: played as a new player in headless Chrome, phone viewport 390x780 with touch, non-local hosts blocked. About 10.5 min of
wall-clock play on each version (v1 = default, v2 = `?deep=1`): 37 attempts on v1 (reached level 14), 35 on v2 (reached level 24).
Input mix: timed taps on left/right halves (random "clumsy new player" timing, about half the attempts), the built-in `__game.bot()`
for about a third (to see later levels), and idle attempts on purpose to lose. Many losses on v1/v2 are therefore my own sloppy
tapping, which is the point of the almost test. I did not read any earlier review before playing.
FPS (requestAnimationFrame counter, software WebGL, shared box under load): v1 31 / 32 / 15 (start / start / end of session), v2 27 / 27 / 17.
That is a worst case and not a phone number, but 15-17 fps late in a session suggests the scene gets heavy; check on a real phone.

## Score table (PLAYBOOK section 0, 0-10)

| Test | v1 | v2 |
|---|---|---|
| 1. 10-second test | 8 | 8 |
| 2. Toy test | 6 | 7 |
| 3. Almost test | 4 | 8 |
| 4. One-more test | 8 | 8 |
| 5. Surprise test | 5 | 7 |
| 6. Mastery test | 3 | 7 |
| 7. Tomorrow test | 2 | 6 |
| **Average** | **5.1** | **7.3** |

Reasons, short:
1. Both: first tap grabs shoes, the stack of heels rises, a bridge "SPLITS!" bit hits at about 5 s, then the rainbow podium. Instantly readable, bright, juicy. Level 1 is a 10-12 s win.
2. Steering is "tap a side = hop one lane". Pleasant, with a squashy stack and brick-scatter, but it is a discrete hop, not a fluid action you want to fiddle with for its own sake. v2 adds PERFECT x2 pops and +N floaters, which help a little.
3. v1 loss card says only "BONK!" or "FELL OFF!" plus "3 gems this run". No reason, no count, no "so close". Feels arbitrary (score 4). v2 says "Wall 5 - you had 3 heels", "Rails need 6, you had 5, 1 short!" and shows the star par on the HUD (8).
4. Both: tap anywhere to retry, back in play in under a second, no screens. Good. v2's retry button sits over the map button but works.
5. v1: splits, rails, brick walls, background colour changes, then levels 6-14 are the same shapes with bigger numbers. v2: gates (x2/+4/minus), snip bars, sliding walls, HARD boss levels (10, 12, 24), new "looks" unlocking every 3-5 levels. The 10th minute does differ from the 1st. Still no jackpot moment.
6. v1 has no stars, no par, no best, nothing that shows I improved (3). v2 has stars per level with par, PERFECT count, "3 more heels for 3 stars", a running star total (7).
7. v1: nothing unfinished except "Level N". v2: look-unlock progress bar, "127 gems to new heels", star total, map. But there is no daily, no chest, no collection page I could see, and the bar resets to a new target each time (6).

## The first 2 minutes, beat by beat (v1, as a new player)

- 0:00 Title "TIPTOE TOWER" over a pink runway in a city, a pointing hand and "Tap a side, grab the shoes". Heel rows ahead. No menu.
- 0:02 First tap: she hops a lane, scoops a heel, stack counter ticks 0 to 3, a small tower grows under her. Good.
- 0:05 A low brick wall: she is tall enough, bricks explode. Immediate payoff. Then the "SPLITS!" bridge: she stretches across it, camera drops, blue gems.
- 0:08 "NAILED IT!" then a rainbow staircase climb, one step per heel. x1.0 to x1.7 label.
- 0:10 "LEVEL 1 CLEARED! x1.7 podium +32 gems", arms up. Tap to level 2. A great first 10 s.
- 0:25 Level 2 is the same recipe, a different colour. Level 3 (0:30) is the first loss for a clumsy player: a wall with no heels: "BONK! 2 gems this run". I do not know how many heels I needed.
- 0:35 Retry is instant. I win level 3 on a clean run. Levels 4-5 are about 25 s each.
- 1:00 Still the same three beats (heels, wall, splits). Backgrounds change colour every level, which is the only novelty.
- 1:30 A tower-based loss at level 6 (FELL OFF, 0 gems). I start to feel the loss is dice: I cannot tell if I needed 3 or 8 heels.
- 2:00 Level 7 cleared, "x2.7 podium". I am getting gems, but gems have no use that I can see.

v2 first 2 minutes differ:
- 0:00 Same open, but a strip of "1 - First Strut, star 2: 3 heels, star 3: 6 heels" sits under the HUD, a map button bottom-right.
- 0:08 "PERFECT x2" pops when I hit the podium cleanly. 0:12 win card shows 3 stars, "2 -> Lemonade look", "127 gems to new heels" bar and a big LEVEL 2 button.
- 0:18 Level 2 "Pick a Lane" introduces x2 / +4 gates. First loss at 0:32: "Rails need 4 heels, you had 1". Clear, fair, mine.
- 1:00 Level 3 "Mind the Bricks" and the first "New look: Lemonade!" unlock. 1:20 Level 4 "Long Legs". 1:35 Level 5 "Zigzag": idle attempt dies on wall 3, "you had 0 heels".
- 2:00 Level 6 "Gold Rush" (golden shoes), "New look: Mint!". The game is already telling me what the next goal is every 20 s.

## What the best app-store game in this genre does in the first 2 minutes that this one still doesn't

The best stack-and-run games make the numbers the show, not the lane choice. In the first 2 minutes they:
- Give a continuous finger-follow steer (drag), so every run has a line you can be good at, not three hop-lanes.
- Put a live big number over the character that you watch grow, and gates that make you do mental maths under time pressure (greed vs safety), with a visible fork every 3-4 s. Ours has about two decisions a run and they are mostly "tap toward the shoes".
- Pay off a "huge" moment in the first minute: a 20x ramp, a giant pile, a slow-mo finish with confetti, a chest or boss with a random prize. Ours caps out at "x3 podium" and a small gem count.
- Spend currency on something you can see: a new character/outfit appears on the very first win and is worn immediately, with a rotating preview. Ours shows a progress bar toward a look, then silently applies it.
- Keep a visible next-world carrot: a world bar "3/10", a boss at the end, a chest at X stars. v2 has the star total, but no world bar, no chest, no daily.

## The 5 biggest fixes, in order

1. **Tomorrow test (v2 6, v1 2): give the session a visible unfinished thing.** A 10-level world bar with the boss at the end ("World 1: 7/10"), a star chest at 9/10 stars (random prize), a daily run with a streak. Show it on the win card and on the title screen when the player returns.
2. **Steering feel (toy test 6-7): drag-follow steering** with the hop kept as an option for tap, plus a bigger squash/lean, a heel "click" pitch that rises with the stack, and a screen-edge streak at high stacks. Fiddling with the stack should be fun with no goal.
3. **Surprise: a jackpot beat.** A rare golden-heel rain or giant gate (x10) 1 in 8 runs, a slow-mo podium for 3-star runs, a "FEVER" when 5 PERFECT in a row. v2's levels vary, but no single moment is huge. Nothing in 24 levels made me say "wow".
4. **Fix v1's almost test or retire v1 (loss feedback).** Port v2's reason line ("Wall 5 - you had 3 heels", "1 short!") to every losing screen, and show a ghost marker of how far you got. v1's "3 gems this run" says nothing.
5. **Polish and perf:** the v2 win card stacks 5-6 lines of small text that overlap each other (best/perfect line, look line, progress bar) and the star par strip under the HUD is tiny and unreadable on a 390 px screen; drop to 2 lines and a bigger star row. Also check fps on a mid phone (15-17 fps in my late-session run) and the HUD heel counter showing 0 on win/lose cards, which makes the "Rails need 6, you had 5" line the only place the count is visible.

## Verdict against the critic gate (PLAYBOOK section 0)

v2 averages 7.3, lowest test 6, so it clears the 7.0 / no-test-under-6 bar for an A/B (`Verdict: TEST`) only if "beats v1 on every test" is read loosely: v2 ties v1 on the 10-second test (8 vs 8) and the one-more test (8 vs 8). Strictly, those two ties fail the rule. It does not clear the ship gate (8+ average, no test under 7): the tomorrow test (6) and the toy test (7) and surprise (7) / mastery (7) are the gap. Fix item 1 first, then item 2, then review again with a fresh run.

Verdict: TEST
