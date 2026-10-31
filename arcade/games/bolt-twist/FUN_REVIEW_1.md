# Bolt Twist FUN_REVIEW (critic run, 2026-10-30)

Method: Playwright + Chrome headless, 390x844 touch, video + screenshots, non-127.0.0.1 requests blocked. v1 played ~11 min
(levels 1-10 cleared, 158 taps), v2 (?deep=1) played ~11 min (toys 1-16 cleared, 196 taps) plus a separate 2.5 min "naive random
tapper" run on HARD toy 10 (7 losses, no win) and spot loads of toys 12 and 22. The play bot used the game's own "this bolt
matches an open box" flag, so it is a competent player, not a new one. Headless = no audio heard: sound is NOT scored from
experience, only from the visible motion/particles. Scores are honest; a 6 is a 6.

## Scores (0-10)

| # | Test | v1 | v2 | Why |
|---|---|---|---|---|
| 1 | 10-second | 6 | 8 | v1: glowing bolt, 6 taps, quiet cube. v2: first tap pops a bolt into a box slot, "x3!", "x4 WOW!", confetti and a plate drop by ~8 s; clear card at ~12 s. |
| 2 | Toy | 6 | 7 | Both: bolt flies to its box, plate falls, cube spins. v2 adds streak words, confetti, tray ghost. Same verb and same weight, nothing new in the hand-feel. 20 taps is nice, not "bubble wrap". |
| 3 | Almost | 4 | 7 | v1: "TRAY FULL!" only. v2: "SO CLOSE - 3 left", live star chip that drops as you park, "So close! Park 0 or fewer (you parked 1)". Loss reason is still generic ("Match the box colours") and does not point at the bad park. |
| 4 | One-more | 6 | 8 | v2 tap-to-retry restarts instantly (no load), the green next button is big, cleared card is skippable. v1 also fast but a plain text link and no pull. |
| 5 | Surprise | 3 | 7 | v1: only colours and plates change. v2: spin lesson at 3, parking at 4, small tray 5, scissors 6, HARD window 10, locks and keys 11+, ice 21+, fresh toy shapes (robot, gift bow, rocket). I only saw up to toy 16 in play; 17-30 seen only as spot screenshots. |
| 6 | Mastery | 2 | 6 | v2 has par per toy and 1-3 stars, so improvement is measurable. But a competent player (my bot) never lost in 15 toys including HARD toy 10, and 3 stars are free on toys 1-7 (par 0), so there is little to master early. No per-run score, no best-time, no trick shots. |
| 7 | Tomorrow | 2 | 6 | v2: map with 30 nodes, sticker per toy, paints at 3/8/14/22/32 stars ("paint at 8" shown on the card), HARD nodes. Nothing is almost done when you quit: no chest, no daily toy, no sticker-page "1 missing". |
| | **Average** | **4.1** | **7.0** | |

Beats v1 on every test: yes. Min v2 score: 6. Average: 7.0 (needs 8+, none under 7).

## First 2 minutes of v2, beat by beat
- 0.0 s: Pastel-blue screen, trophy, level chips 1-2, two empty box (green, blue) with 3 slots, five-slot tray, a wooden crate with 6 bolts, a glowing bolt and a bouncing hand. No start card, no menu: the first tap is a real move.
- 1.5 s: Speech bubble "Match the box colours!" Tap 1: green bolt pops, flies to the green box, "Nice!".
- 3-6 s: Taps 2-3 fill the boxes; "x3!", "x4 WOW!" ghost text behind the cube. A top plate (the blue bar) falls off.
- ~8 s: Final bolts: "HOT STREAK x5", confetti bursts over the boxes, the front plate tumbles off the cube.
- 12 s: Card "TOY CLEARED! 3 stars, Perfect: not one bolt parked", sticker Toy Crate 1, Candy paint unlocked, Best streak x6, "3 stars - paint at 8". Big green "2 >" button.
- 20 s: Toy 2 ("Take the bar first: layers"), a pink bar over three bolts; teaches layers by doing. Clear at 35 s, a second sticker.
- 41 s: Toy 3 "Swipe to spin: the other side has bolts too". Clear at 52 s, Chrome paint unlocked (second unlock in under a minute: good).
- 59 s: Toy 4, 9 bolts, "No match? Park it in the tray", a NEXT chip appears showing the next box colour. Clear at 79 s with the first 12 stars.
- 85-110 s: Toy 5 smaller tray (4 slots). First time the star line says "So close! Park 0 or fewer (you parked 1)". The first real decision arrives about the 85 s mark; before that there was none.
- 112 s: Toy 6 scissors, 12 bolts. By 2:00 the player has 4 clears, 2 paints, 5 stickers and has been taught match, layers, spin, park and tray size, with no text wall. Honest weakness: the first 80 s has no decision and no risk; a player cannot lose until toy 5.

## What the best bolt/screw puzzle on the store does that this still does not
(The category leader pattern: Screw Jam / Screw Puzzle / Nuts & Bolts style games.)
1. **Satisfying physical sound and haptic per unscrew.** A real twist-out spin, a ratchet click per turn, a metallic clink into the box, and rising pitch per streak. Here a bolt just lifts and flies; no unscrewing rotation was visible (watch the video: bolts pop off, they do not turn out).
2. **Immediate meaningful puzzle in the first minute.** Top games get you stuck, then unstuck, in the first level or two (a bolt blocked by a plate you must free first), so the "aha" arrives early. Ours has no failure possible until toy 5.
3. **Visible risk meter.** Tray slots fill with an urgent red tint and a shake at 1 slot left. Ours shows a small "TRAY 1/4" label only.
4. **Rewards that are surprising.** Chests, a golden bolt, a booster (extra tray slot, hammer) you earn and spend, a rare jackpot. We only have predictable stars and stickers.
5. **A live goal for tomorrow.** Daily toy, chest at 9/10, season track. We have a star ladder but nothing nearly finished.
6. **Clear loss feedback.** Show which bolt/park cost you, with a one-tap "undo/add slot" rescue. Ours says "TRAY FULL!".

## 5 biggest fixes, in order
1. **Mastery (6) and difficulty:** make the first 10 toys carry real risk. A competent player lost 0 of 15 toys. Put the first fail-able decision in toy 2-3 (a forced park choice), raise par so 3 stars needs thought, and add best-parks/ratings per toy so improvement is shown, not just stars.
2. **Tomorrow (6):** add something visibly nearly done at quit time: a chest at N/10 stars on the result card, a daily toy with a streak, a sticker book page with one empty slot highlighted. Show it at the moment of clearing.
3. **Unscrew feel (Toy 7):** animate the bolt turning out (spin + lift + slight wobble) before it flies, add a distinct per-bolt click, a squash on arrival in the box, and a pitch ladder. Right now it is the same pleasant pop 200 times.
4. **Loss that teaches (Almost 7):** the lose card says "TRAY FULL! Match the box colours." Replace with the specific cause ("3 parks, no match for red: spin to the back") and a 1-tap "+1 slot" rescue; also the lose text overlaps the tray at the top of the screen (seen on toy 10).
5. **Surprise cadence (7):** between mechanic unlocks (toy 11 keys, 21 ice) there are 10 toys of the same rhythm. Add a rare golden bolt, a bonus toy room, or a "fever" pass every 3-4 toys so minute 10 differs from minute 3. Also fix the first 80 s: add a decision or a tease of the HARD toy so toys 1-4 are not just six free taps.

Verdict: FAIL
