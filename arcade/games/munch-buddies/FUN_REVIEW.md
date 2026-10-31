# Munch Buddies FUN_REVIEW (critic round 90d)

Method: Playwright Chrome, 390x844 touch, SwiftShader, non-127.0.0.1 hosts blocked. Not the perfect bot: a jittered human tapper
(timing sd about 75 ms, 5% of snacks skipped, holds released with jitter, about 850-900 taps per run). v1 played 8 min
(L1-L8, 7 wins / 11 losses, stuck on L5 for 6 tries). v2 (?deep=1) played 10 min (L1-L19, 18 wins / 3 losses). Win card checked separately with go(3)+bot().

## Scores (0-10)

| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 7 | 8 |
| 2. Toy | 6 | 7 |
| 3. Almost | 5 | 7 |
| 4. One-more | 6 | 7 |
| 5. Surprise | 3 | 7 |
| 6. Mastery | 3 | 7 |
| 7. Tomorrow | 2 | 6 |
| **Average** | **4.6** | **7.0** |

v2 beats v1 on every test, no test under 6, average 7.0 (last round 6.7; Mastery 6 -> 7, Almost 6 -> 7). Not 8, not 7 on Tomorrow: it does not ship, it goes to A/B.

## First 2 minutes of v2, beat by beat

- 0:00 Blue pantry room, two chunky kittens, ice-cream cone falling behind the title, "Tap a side when the snack reaches the kitten". Heart pill shows 9 hearts wrapped over two rows (fits now). Clear.
- 0:03 Song starts, snacks fall; the kittens munch the first few by themselves (demo), notes play. Pleasant but I am a passenger for the first 3-6 s (v2 waits 3 s before the demo kicks in, v1 0.4 s).
- 0:05 My first tap: kitten pops its mouth, heart sprites, sparkle, the next melody note. YUM / PERFECT pops. Satisfying, not spectacular.
- 0:08 Wider 0.30 s window: a sloppy tap still lands, small blue "EARLY" or orange "LATE" tag. The tag is readable now and teaches the timing without a tutorial.
- 0:13 Level 1 ends at 12 s with 3 stars, almost nothing can go wrong. Win card (after a tap-free pause): three stars, "RANK S/A..., best combo", "N more PERFECT for S" line, "NEW STICKER" when the box opens (first box after 3 stars, so after level 3 for a clean player), "Daily Duet waits". A wall of centred text, but it does tell me what to chase.
- 0:16 L2: second kitten takes turns, first golden snack (screen flash, "GOLDEN! +5"). 0:33 L3: first bombs (6 hearts). A bomb ends the run instantly (BOOM), harsh next to the forgiving hearts.
- 0:57 L4: long chocolate sticks (hold), the first real "new verb" moment. 1:30 L5 first loss (75% done, "SO HUNGRY!", tap to retry, back in the song in under a second).
- 2:00 I am on L5-L6, 10+ s per level, no menus. Fever x2 at combo 8 and the stars/rank give me a reason to replay a 3-star level for S.

## Where v1 loses

v1 L1 is a 15 s plain run, 3 hearts, no EARLY/LATE, no rank, no stars, no meta. It turns into a wall at L5 (6 deaths in a row at 28-60%, no explanation of what went wrong, 3 hearts, bombs rising 3% per level). Same room recoloured, nothing new until I quit. Win and lose cards say "28% . 41 pts" and that is it.

## Frame rate

SwiftShader software GL at 2x DPR with a screenshot every 7 s: v1 avg 17.7 fps (min 9), v2 avg 10.0 fps (min 7). Not representative of a phone GPU, but v2 is about 40% heavier than v1 (heart sprites, particles, fever flashes) and the dips are during PERFECT chains and flash overlays. Worth a real-device check; I cannot claim 60 fps from this.

## 5 biggest remaining fixes

1. Tomorrow (6): nothing is left unfinished when I lose or win. Put a permanent "2 stars to the next treat box" progress bar (filled to 80%+ looks) and the sticker slot you are missing on the win AND lose card as a picture, not as a text line. Replace "Daily Duet waits . streak 0" with a big Daily button on the card. Sticker book needs a visible silhouette teaser.
2. Win card is a text dump. Show rank as a big stamp/letter with a pop, the stars drop in one by one with a note each, "2 more PERFECT for S" as a thin bar. Right now it reads like a debug log. Do the same for the lose card (one clear "why": which beat I missed).
3. Surprise (7): the 10th minute still looks like the 1st: same room shape, same two kittens, only a colour change per world. Add a visible set-piece every ~4 levels: a bonus room (all-golden shower), a boss kitten, a changing room prop, a snack that splits. The first bomb and the first hold are the only "wow, new" moments I felt in 10 min; L6-L19 felt identical.
4. Bomb = instant death is out of tone with 9/6-heart levels. Make a bomb cost 2 hearts plus the dizzy kitten (keep the instant BOOM only on boss levels), or the "Almost" test keeps failing silently: two of my three losses were a stray tap on a bomb at 80%+. Also show a faint ring on the lane for the trap-bomb window.
5. Toy/feel: tap at 20 repeats gets samey: an empty tap is a tiny click, a normal munch is the same hearts and sparkle. Make the kitten do a bigger chew (squash on the beat, head bob, cheek puff), scale the PERFECT burst with combo from combo 2 (not combo 8), add a tiny screen punch on each hit. And cut the 3 s wait before the demo so the first beat is instant; check mobile fps (10 fps here), trim heart sprites to 1 per hit when combo is high.

Minor: the FEVER pill overlaps the score on the win card; v2 ?deep L1-4 are so forgiving that a good player wins on autopilot (L1-L19 in 10 min with 75 ms sloppy timing): ramp L5-L10 faster.

## What the best app-store game in this genre does in its first 2 minutes that ours still doesn't

The best rhythm games make me feel like a performer in the first 10 s: the track is a famous tune I recognise, the visuals react to the beat (lane pulses, screen glows, the character dances), the very first tap lands with a crisp sound-plus-flash on every note with full-song audio, and by minute 2 I have unlocked a new skin or song with an obvious next unlock one tap away. Ours is polite and pleasant, but the world does not move with the beat, the reward after a level is text, and nothing visual changes between level 3 and level 19. The meta (stickers, daily) is a sentence, not an object I want to fill.

Verdict: TEST
