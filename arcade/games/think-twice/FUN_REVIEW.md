# Think Twice! - cold fun review (v1 vs v2 `?deep=1`)

Critic run 2026-11-01. Chrome (channel chrome), 390x844 touch phone viewport, every non-127.0.0.1 request aborted. I played by hand: real taps and mouse drags, one move at a time, with a screenshot looked at between moves. v1: levels 1-9 (about 12 min). v2: levels 1-8 plus the map screen (about 11 min). I did not reach the level-10 boss in v2 or the daily trick. Headless Chrome has no audio, so sound is not judged. Every "feel" score is motion and visuals only.

**Measured fps (requestAnimationFrame over 5 s, taken during play): v1 = 60.2 / 60.1 (two samples), v2 = 60.1 / 60.1 (two samples).** No problem.

## Score table (0-10)

| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 7 | 9 |
| 2. Toy | 5 | 6 |
| 3. Almost | 5 | 6 |
| 4. One-more | 6 | 7 |
| 5. Surprise | 6 | 7 |
| 6. Mastery | 2 | 8 |
| 7. Tomorrow | 1 | 8 |
| **Average** | **4.6** | **7.3** |

v2 beats v1 on every test, but the margin on tests 2, 3, 4 and 5 is 1 point. The v2 gain is almost all meta (tests 1, 6, 7). The puzzles and the feel of tapping are unchanged. Levels 1-8 in v2 are the same eight puzzles as v1, in the same order.

## First 2 minutes, beat by beat

**v1**
1. 0:00 A cartoon kid, "THINK TWICE! Tricky puzzles. Sneaky answers." and a "Tap to play" pill. Clean and quick.
2. 0:05 Level 1, "Tap the biggest ball." Four balls and a huge orange one cut off by the bottom of the screen. I tapped the beach ball by mistake: red X and a heart gone. That was my own misread, which is a good "almost". I then tapped the giant ball: confetti and a green check. Satisfying, though the check covers the answer.
3. 0:25 "Tap to continue". Level 2, "Tap the number 7." There is no 7 on screen. I used HINT ("Read the question really carefully"), then tapped the 7 in the question text. Confetti. That is the one real "ha, got me" moment of the opening.
4. 0:50 Level 3, balloons. Four pop with a nice burst, then a speech bubble says "2 more somewhere" and the "oo" in "balloons" are the other two. Another good gag.
5. 1:15 Level 4, curtains. Dragging them apart is the best toy in the game: sun floods in, the kid wakes up laughing. I wanted this one again.
6. 1:40 Level 5, stars. Counted 6, wrong (heart lost). Dragged the moon: a seventh star was behind it. Fair.
7. 2:00 Nothing carried over. No stars, no score, no time, no "best". It is a stack of disconnected gags.

**v2**
1. 0:00 Same title. The button is now a fat green "PLAY" with "MAP" and "DAILY TRICK" under it, and "Level 1 . star 0".
2. 0:05 The HUD is bigger: a star counter, a chest with 5 dots, and a hat progress bar. I tapped the giant ball: confetti plus gold coins fly in a ring. The star counter jumps from 0 to 7 and the bar fills.
3. 0:10 A card with 3 stars, "NEW HAT Beanie", "NEW TRICK: READ IT TWICE +1", "no slips = 3", "DAILY TRICK +2", "chest 1/5", "QUICK 3.6s +1". That is 6 rewards for one tap. Very rewarding, but it reads as a wall of chips.
4. 0:30 Level 2. I tapped a distractor "1" and the number said "Hee hee!" with no heart lost. Then I tapped the 7 in the question: confetti, a fire streak "2", and a Party Cone hat.
5. 1:00 Level 3 balloons: a Crown. The kid sleeping on level 4 wears the crown, and the wizard hat sits on the frowning face in level 6. Cosmetics change the game's own art, which feels good.
6. 1:30 Level 4, the same curtains. I hit MAP by accident and got a map with 3 worlds and 30 levels each. A hat collection has silhouettes ("21, 29, 38 stars"). A "tricks" collection shows "Read it twice 2/6, Drag a word 1/4, Move things 1/16" and 3 "???" slots. Lots of "one slot empty" pull. The map header is clipped at the top.
7. 2:00 Level 4 card: "20/21 -> new hat" and "chest 4/5". My thumb went to NEXT. The pull is real. The core gag is still the v1 one.

## What the best app-store game in this genre still does that this one doesn't

The best trick-puzzle games sell every level as a joke with a visual punchline. The solution plays out as a short animation of the character. The wrong answer is also funny: the character gets squashed, flung or shocked, so failing is something to show a friend.

Here, both versions cover the punchline with the same giant green check circle, and a wrong answer is a red X plus a generic quip. Rewards on the result card come from a system and not from the gag. The best game also keeps the player's attention on the scene for the whole level. Here the player's eyes are pulled up to HUD chips, and the card appears 2-3 s after the win on level 8, so the joke has gone cold by then.

The best games also teach each new input with a free first example before it can cost anything. Here "drag a word" is first needed on level 8 with no lead-in, and failing it gives no feedback at all.

## 5 biggest fixes, in order

1. **Make the solved level a payoff in the world, not a badge.** Remove the green check from over the scene. Give each level its own 1-second reaction (kid laughs, balloon-kid floats, face flips) and let that run before any card. Add a funny, level-specific fail animation instead of the X. This is what lifts the Toy and Almost scores, which are at 5-6, and they are the weakest of the core tests.
2. **Fix the unfair and untaught moments.**
   - v1 and v2 level 8: tapping "dark" does nothing, no wiggle, no bubble, and the hint ("Get rid of the darkness, it's in the question") never says "drag". I spent about 6 tries on it.
   - Pre-teach "drag a word" earlier. Make draggable words wiggle or show an underline.
   - v2: tapping the already-eliminated B on level 7 cost a heart each time and I lost all 3 hearts from three taps on one button. Disabled options should not cost anything.
3. **Calm the result card.** One hero reward (hat or stars), one line of tricks, and the rest behind a "details" tap. Six chips per card turns every win into reading. Cut the win-to-card delay to about 1 s (it was 2-3 s on level 8).
4. **Make v2's rewards variable and the puzzles carry the meta.** A hat after every one of levels 1-6 is predictable, and the "chest" is only a chip. Space hats out. Make the chest a tap-to-open moment with a random pick and an occasional rare "golden" hat. v2 levels 1-8 are v1's levels 1-8, so the ten-minute experience has no new puzzle shapes. v1 also used "tap the word in the question" three times in 8 levels (L2, L3, L8), which makes the trick predictable by level 4. Add 3-4 genuinely new mechanics before level 10, and vary that trick.
5. **Polish the layout bugs.**
   - The map header (star total and "next hat at") is clipped at the top.
   - The speech bubble has a square white strip under its rounded border (visible on "Hmm... 2 more somewhere" and "Too dark to see!").
   - The "DAILY DONE" button appeared on the map on day 1, before I had played a daily. This may be a bug, I did not verify it.
   - A ghost of the previous card overlaps the new one during the card transition.
   - The fail text "Read the question again" is the same for every level.

## Verdict

v2 averages 7.3, the lowest test is 6, and v2 beats v1 on all seven tests. That clears the TEST bar, not the PASS bar (8+ average, no test under 7).

Verdict: TEST
