# Bolt Twist FUN_REVIEW (critic run 2, 2026-10-30)

Method: Playwright + Chrome headless, 390x844 touch, video + screenshots, every non-127.0.0.1 request blocked. v1 played 11 min
(432 taps, reached level 8), v2 (?deep=1) played 11 min (525 taps, toys 1-13 cleared in 3.5 min, then stuck on toy 14).
The player was a casual, memoryless "new player" bot: 80% of taps go to a free bolt whose colour matches an open box (a human can
see colours), 20% to any free bolt, swipe-to-spin only when nothing is free. It never used a hint flag, never planned ahead.
No audio is heard in headless, so sound is scored only from code (ratchet clicks exist, line 538 of deep.js) and visible motion; I did not see
the unscrew spin in still frames (video only), so I give it no extra credit. Scores are honest; a 6 is a 6.

## Did round 1's fixes land?
| Fix from FUN_REVIEW_1 | Landed? |
|---|---|
| Unscrew spin + click per bolt | Code: 5 ratchet clicks rising with streak. Visually a bolt can be seen mid-twist on v1 and v2 (small, fast). Mostly yes; still reads as a pop at phone size. |
| Squash on arrival | Present in code/flow; not distinguishable in my stills. Unverified, not credited. |
| Golden bolt | Present (pins, "Pins 7/12" on result card after 13 toys, ~1 in 3 toys). A new player is never told it exists, never saw one in my 13 toys by eye. |
| Best time | Yes: "6.8s - beat it next time", "15.6s" on every card. |
| Specific lose cause | Yes: "blue + cyan had no box open: spin for a bolt that matches". But the text is drawn ON TOP of the tray (still overlapping, unreadable bolts underneath) and v1 still says only "Match the box colours." |
| Chest / pins (round-1 fix 2) | Yes: "Chest 1/3" progress bar on the card, pin book 0/12. New since round 1. |

## Scores (0-10)

| # | Test | v1 | v2 | Why |
|---|---|---|---|---|
| 1 | 10-second | 6 | 8 | v1: "Match the box colours!", first tap flies a bolt, "Nice!" and small chips. v2: glowing bolt + hand, demo self-plays, first clear card at 6 s with confetti, stars, sticker, paint. Fast reward. |
| 2 | Toy | 6 | 7 | Both: pleasant lift-and-fly, plate falls, cube turns. v2 adds streak words ("Nice!" fading behind the tray), rising clicks. 20 taps is nice, not bubble wrap; the cube is a flat soft wood block with no weight. |
| 3 | Almost | 4 | 7 | v1: "TRAY FULL!" only, a wall at level 6 where my casual player lost 15 times in a row with no hint why. v2: names the stuck colours, live stars, "parked 3". Docked: text overlaps the tray, and 35 losses in a row on toy 14 with no rescue/hint offered is a grind, not "close". |
| 4 | One-more | 6 | 8 | Tap-to-retry restarts in about 2 s in both; v2 shows a big next/retry pair of buttons and lose-to-play loop took ~2-3 s. No loading. |
| 5 | Surprise | 3 | 7 | v1: only colours and plates (levels 1-8). v2 in 11 min: layers, spin, parking, small tray, scissors, HARD toy, keys + padlocks (toy 13-14), gift-bow shape. New thing roughly every 1-2 toys early; then toy 14 stopped me. Golden bolt never noticed. |
| 6 | Mastery | 3 | 7 | v2: stars by parks, best time per toy, streak x15 reported. Improvement is visible. But early toys are free 3-star (par 0), and no trick/score. v1: only a level number. |
| 7 | Tomorrow | 2 | 7 | v2: chest 1/3 bar, pins 7/12, "paint at 32" with 30 stars: something is always nearly done, shown on every card. No daily toy. v1: nothing. |
| | **Average** | **4.3** | **7.3** | |

Beats v1 on every test: yes. Min v2: 7. Average 7.3 (needs 8+). Up from 7.0 last round; gained on Mastery, Tomorrow, Almost.

## First 2 minutes of v2, beat by beat
- 0.0 s: Pastel-blue screen, trophy, level chips 1-2, map button, two empty boxes (green, blue), 5-slot tray, a wooden crate with 6 bolts, one glowing with a bouncing hand and the bubble "Tap the glowing bolt". No menu.
- 1.5-4 s: if you do nothing the demo unscrews bolts for you; first tap flies a bolt to its box, "Nice!", confetti. Streak words.
- 6 s: card "TOY CLEARED!" 3 stars, "Perfect: not one bolt parked", sticker, paint "Candy", best streak x6, Chest 1/3, 6.8 s, Pins 0/12. Big green "2 >" button. Seven chips is a lot to read at once, but all are skimmable.
- 9-15 s: toy 2 (layers: a bar over bolts) cleared in 6 s. 19-25 s: toy 3 (spin) 6 s. 28-37 s: toy 4 (park) 9 s.
- 40-50 s: toy 5, tray shrinks to 4 and a NEXT chip appears. 54-67 s: toy 6 scissors. 70-87 s: toy 7. 90-102 s: toy 8.
- 105-123 s: toy 9. By 2:00 a casual player has cleared 9 toys, 14+ stars, several stickers. Never failed. Honest weakness: 2 minutes with zero risk, then a cliff at toy 14 (keys behind plates) where a casual player fails 35 times: easy then suddenly very hard, no ramp.

## What the best app-store screw/bolt puzzle does that this still doesn't
1. A real physical unscrew: the bolt turns visibly and slowly enough to see (a full turn, wobble, lift), with a clear metal clink and haptic per bolt. Ours is a quick small pop on a phone-sized cube.
2. The puzzle is the order you free pieces, with obvious dependency (this plate blocks that bolt) from level 1-2, and a puzzle you can think about, with one correct-ish solution and a satisfying "aha". Ours is match-and-park; early toys are solved by tapping any matching bolt.
3. A gentle failure ramp: lose = 1 booster offer (undo, +1 slot, remove one) so a stuck player isn't ground down. Ours loops the same fail with no help for 35 tries.
4. Rewards that surprise: a rare golden bolt a player actually notices (glint, sound), chest openings with a pick, boosters earned. Ours has the pieces (pins, chest) but they appear as text chips on a card.
5. Rich, varied 3D objects and environments and ASMR audio polish; ours is pastel crates with soft shading.

## 5 biggest fixes, in order
1. Difficulty ramp: toys 12-16 (keys behind plates) are a wall for a normal player. Give a "stuck twice" help (+1 slot, undo last park, or highlight the unblocking plate) and ease toy 14; same for v1 level 6 (15 losses).
2. Put risk and a decision into toys 2-5 (a forced park choice, par above 0) so the first 2 minutes aren't six free taps per toy.
3. Slow and exaggerate the unscrew (visible full turn, wobble, clink, arrival squash, haptic) so the toy test hits 8-9.
4. Fix the lose card layout (text sits on the tray) and make v1's lose message specific; trim the win card from 7 chips to 3-4 with the chest as the hero.
5. Make the golden bolt and pin book visible before they pay off (a glint on the toy, "gold bolt hidden!" hint) so the surprise lands, and add a daily toy for the Tomorrow test.

Verdict: TEST
(2026-10-31: round 2 avg 7.3, min 7, beats v1 on all; since then: toys 3-5 real park choice, slower unscrew, trimmed win card, golden bolt tease. Keep improving toward 8+.)
