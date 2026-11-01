# Dailies Club: Fun Review (critic run, round 3, cold play)

Played as a new player at 390x844 touch, headless Chrome (channel chrome), all non-127.0.0.1 requests blocked, video + screenshots recorded (videos deleted after). v1 = `index.html`, v2 = `index.html?deep=1`.
Both versions were played in real time for about 14 minutes, in parallel.
- v2: I hand-tapped Puzzle Book pages 1-5 and page 8 (Decode, Vibe Check, Mini Grid, a scramble, the RUSH page, the GOLD page), including a deliberate 4-mistake loss on page 8. Pages 6-30 were cleared by `window.__game.bot()` with a driver that taps the result card buttons and the chest. All 30 pages and 90/90 stars were done in about 9 minutes of bot play.
- v1: I hand-solved the whole Sunday #305 set (Vibe Check, Decode, Mini Grid, with one deliberate wrong cell), then ran the bot over the 7 free archive days until nothing was left to play (about 7 minutes).
- I solved the puzzles myself from the DOM text. Sound cannot be heard in headless, so "feel" is judged from motion, particles and screenshots.

**FPS.** The machine was heavily loaded (load average 50-63), so treat all numbers as pessimistic.
| | v1 | v2 |
|---|---|---|
| Home (3D kitty room) | 5.7-12 fps (p95 100-200 ms) | 5.6-12 fps (p95 100-200 ms) |
| In a puzzle | 33-34 fps (p95 33 ms) | 32-40 fps (p95 33-50 ms) |

The 3D home room is under 30 fps on this headless software-GL setup in both versions. Puzzles run 32-40 fps and are about the same in v1 and v2, so the new frames and particles cost nothing visible. The home number still needs one measurement on a real mid phone.

## Score table (0-10)

| # | Test | v1 | v2 | v2 beats v1? |
|---|------|----|----|--------------|
| 1 | 10-second test | 5 | 7 | yes |
| 2 | Toy test | 6 | 7 | yes |
| 3 | Almost test | 6 | 7 | yes |
| 4 | One-more test | 3 | 8 | yes |
| 5 | Surprise test | 3 | 7 | yes |
| 6 | Mastery test | 3 | 6 | yes |
| 7 | Tomorrow test | 6 | 7 | yes |
| | **Average** | **4.57** | **7.00** | |

Why these numbers:
1. 10 s. v1: home, tap Play, tap tiles; the first real payoff (a group collapsing) lands around 15-20 s. v2: on a fresh save the Puzzle Book row now goes straight into page 1 (no lock map), the page is an emoji rebus (ear + ring) and I had EARRING spelled with confetti 6 s after the page opened, about 12 s from the home screen. That is close to a 10-second win, but it still starts behind a load screen and a slow 3D home. 7.
2. Toy. v1: a tile lifts and turns purple, that is all. v2: every tap adds a small sparkle burst plus a scale pop, and letter bubbles drop into slots with a tone; 10 rapid taps in a row all still read as feedback. It is still select/deselect, not bubble wrap (no rising pitch, no chain), and the sparkles sit on top of the tile label. 7.
3. Almost. Both have "One away..." for 3-of-4 guesses and a heart/mistake dot lost at once, which is fair. v2 adds a "So close!" card and a "Try again" button. But the loss card leads with "+1 mistake, short video" (a rewarded ad) and the retry only appears after "Show answer"; it also shows 3 empty stars and two Map buttons. Good feel, clumsy fail screen. 7.
4. One-more. v1 ends after 3 puzzles ("New set in 19h 43m") and the archive is a calendar to dig through. v2: the result card has a big "Page N+1 ›" and "Again", and the next page is on screen in about 0.25 s (measured: tap to tiles 239 ms). Strong. Limit: the book has only 30 pages, so the runway ends. 8.
5. Surprise. v1: nothing changes inside a set; a random holo sticker is the only variance. v2: boss pages, chests every 9 stars (random sticker), world changes, and now RUSH (pages 5/15/25: dashed orange frame, "RUSH 28s" chip, "RUSH WON!") and GOLD (8/18/28: gold frame, "GOLD" chip, x2 coins, "GOLD PAGE!"). The frames are easy to spot and the titles are good. But a RUSH/GOLD page plays exactly like any other page; it is a frame plus a clock plus a coin multiplier, and the RUSH pages I saw on the Decode type (carpet, hair clip) are as easy as any. 7.
6. Mastery. v1 has stars by mistakes and nothing else. v2 now shows time, par, "new best (was Xs)" and a "perfect in a row" counter. That is real feedback. But I three-starred every page on the first try (the bot got a 30-page perfect chain), pars are generous (28 s page-1 par, I did 6 s), so there is no struggle to get better at. The game shows progress but there is little skill to grow. 6.
7. Tomorrow. v1: streak start, "New set in X", album dot. v2 adds the chest bar ("3 more stars to the next chest") and "Tomorrow: daily set #306" on every result card and the next page right there. Once the book is 90/90, the hook is gone and the home row just says "All 30 pages done". The home also showed "3/3 stars to unlock the cloud rug" on a day where I had not played a daily puzzle (book stars counted). 7.

## The first 2 minutes of v2, beat by beat

(Hand play, fresh save; times are approximate wall-clock including screenshot pauses.)
- 0:00 Load screen. 0:03 Home: pink 3D kitty room, "Dailies Club" logo, bottom sheet with Vibe Check, Decode, Mini Grid and a new orange "Puzzle Book, Page 1 · Sprinkle Lane · 0/90" row with a purple Play. The room renders at about 6-12 fps here.
- 0:05 I tap the book row. No map: I am in page 1, a Decode: ear + ring, tag "Accessory", 7 coloured letter bubbles, a "27s" clock chip, bubble "Emoji math! What word do they make?".
- 0:06-0:12 I tap E-A-R-R-I-N-G. Each letter pops with a sparkle and a tone and lands green in a slot. The kitty says "EARRING! Big brain energy" and a confetti burst covers the screen. Clock says 6 s.
- 0:14 Result "Slay!" 3 stars, "6s · under 28s +8", coins fly into the counter (+28), a macaron sticker, "Page 2 ›" / "Again" / "Map", and "6 stars to the next chest". Clean, rewarding, fast.
- 0:18 Page 2 Vibe Check. Bubble says "New: Vibe Check: three plain categories" (awkward wording). There is a dead 260 px gap between the kitty and the 16 tiles; the Submit button runs off the right edge.
- 0:20-0:45 Planets, star signs, instruments, decor. Tile taps sparkle, groups collapse into colour bands, bubble escalates: "Okay genius", "2 clean in a row", "FLAWLESS RUN!". Result "Iconic!" 3 stars at 23 s, "2 perfect in a row", a rainbow swirl sticker.
- 1:00 Page 3 Mini Grid: four short clues; the speech bubble ("New: logic grid: several direct clues...") overlaps the clock chip. I solve it in 13 s by double-tapping six cells. "Perfect!" +37.
- 1:20 I tap "Page 4" and a Chest opens (9 stars): gift box, confetti, a makeup-case sticker, "Yay ›". The first variable reward, about 80 s in, and the best beat of the run.
- 1:40 Page 4 scramble (KAWAII from a heart-flower emoji). I took 42 s against a 28 s par, so no speed bonus. Still "Slay!", 4 perfect in a row.
- 2:00 Page 5 RUSH: dashed orange frame around the board, "RUSH 28s" chip, bubble "RUSH PAGE: beat the clock!". I clear four groups in 15 s: "RUSH WON!", +20 bonus, 55 coins, a chest sticker. First time the screen looks different on purpose. Nothing about the mechanic changed.

## What the best app-store game in this genre still does better

(NYT Connections / Wordle for the daily ritual, Royal Match / Wordscapes for pacing.)
- It is hard enough to lose. A top game fails new players about 20-30 % of the time at level 10-20 and makes the win feel earned. Here I got 3 stars on 30 of 30 pages (and 3 of 3 stars on every single first try), the clock is a decoration, and a loss only happens if you tap wrong on purpose.
- Skill creates something. In Royal Match a good move makes a booster that you then spend on a hard level; in Wordscapes a bonus word pays out. Here a clean streak gives a line of text and a few coins; nothing you earn changes how the next page plays.
- Escalation inside one round. Match-3 and Wordscapes build a combo chain with rising sound, bigger bursts and a fever state. Here group 1 and group 4 of a Vibe Check feel the same, and RUSH/GOLD only add a frame and a timer.
- A loss that does not slow you down. The best games put retry first, free, and instant. Here the loss card puts a rewarded-video button first and hides retry behind "Show answer".
- A bigger, never-ending runway plus a daily hook. Wordle and Connections have one shareable result and a streak; Royal Match has hundreds of levels. Here the book is 30 pages (nine minutes for the bot, perhaps 20 for a person) and then it is a dead end, and the v1-style daily set is over in 2-3 minutes.
- Smooth home. The 3D home room is 6-12 fps on this machine; the top games open on the puzzle, not on a scene.

## The 5 biggest fixes, in order

1. Make it hard enough to feel (Mastery 6, Almost 7). Tighten the curve: fewer decoy letters on Decode, more clues and no direct "X wears the Y" gifts on Mini Grid after page 10, real overlap groups on Vibe Check from page 12, and a par that matters (3 stars needs par, 2 stars needs less time or a mistake). Today every page is 3 stars on the first try.
2. Fix the loss path (Almost 7, One-more 8). Retry must be the primary, free, instant button on the "So close!" card. Move "+1 mistake, short video" to a smaller secondary button, drop the duplicate Map button, and do not show 3 empty stars for a fail; show "2 groups found" or similar instead.
3. Clean up the layout defects that I can see in every page: Submit clipped off the right edge (and under the gold/rush frame at the bottom), the 260 px dead gap above the Vibe tiles (put a streak/combo meter or the found groups there), the page-intro bubble overlapping the clock chip on pages 3 and 5, the "New: Vibe Check: three plain categories" copy, tap sparkles covering the tile label, and the glyphs that are still tofu in my Chrome: the backspace key in Decode and the cross mark in the Mini Grid cells, legend and "Auto" button (draw them as CSS or SVG).
4. Give RUSH and GOLD a different feel, and escalate inside rounds (Surprise 7, Toy 7). For example: a RUSH page drains time on a miss and speeds up music; a GOLD page has one hidden golden tile or a bonus letter. Add a combo chain with rising pitch and a bigger burst on groups 2, 3, 4 and a fever on a clean run, so tapping 20 tiles gets louder, not equal.
5. Longer runway and a better hook (Tomorrow 7, One-more 8). Add a second book (worlds 4-6) or seeded endless pages after 90/90 so "All 30 pages done" is not the end, show chest progress as a bar on the home row, fix the "3/3 stars to unlock the cloud rug" counter that includes book stars, and keep the 3D room from running at 6-12 fps (lower pixel ratio, pause the render loop under the sheet, or use a still image on weak GPUs).

## Other things I noticed (small)
- The Puzzle Book row opens straight into page 1 only on a fresh save; afterwards it opens the map (fine, but a "Continue page N" button on the home row would be one tap faster).
- Selection is kept after a wrong guess (like Connections), so a miss leaves 4 tiles lit; fine, but the first re-tap deselects one tile with no feedback.
- Shared set grid card in v1 shows the group colours as plain squares and the "Grid" star row; fine.

Verdict: TEST
