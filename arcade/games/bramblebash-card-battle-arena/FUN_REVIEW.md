# Bramblebash: FUN_REVIEW (cold critic play, 2026-10-31)

Method: Playwright + Chrome headless, phone 390x844 touch, real drag-to-deploy, non-127.0.0.1 hosts blocked. v1: about 12 min (won 1-0 on Easy, then idled and lost 0-3 on purpose). v2 (?deep=1): about 20 min, levels 1-5 played in order (won 1-4, lost 5 to Dot), then the map. Levels 13 and 17 were opened via `__game.play` only to look at the twist screens. Playbook section 0 tests.

fps over 3 s (headless software GL, box load about 20): v1 22.7, v2 13.7 during the map overlay. Both are under 30, so this is flagged. It is a measurement artefact of the box, but v2 is clearly the heavier of the two.

## Scores

| # | Test | v1 | v2 |
|---|------|----|----|
| 1 | 10-second | 4 | 7 |
| 2 | Toy | 5 | 6 |
| 3 | Almost | 4 | 7 |
| 4 | One-more | 7 | 8 |
| 5 | Surprise | 3 | 7 |
| 6 | Mastery | 3 | 6 |
| 7 | Tomorrow | 2 | 8 |
| | **Average** | **4.0** | **7.0** |

## First 2 minutes, beat by beat

v1:
1. 0:00 A pretty 3D arena, a title card, Easy/Normal/Hard, "Tap to battle". There is no hint of what to do.
2. 0:05 The match starts with 4 cards and 5 sap and silence on what to do. The first drag works, but units are tiny and the CPU drops a cannon that chews through them.
3. 0:20-0:60 I trade squirrels and a frog for a cannon. Nothing explodes, nothing pops. The towers barely move and I cannot tell if I am winning.
4. 1:00-2:00 I spam cards at sap 0, then sit on 10 sap, because there is no pressure or prompt. First tower down at about 2:20, a crown appears. A real player would have quit by now.
5. After a loss: "DEFEAT 0-3 crowns", "Tap to retry". Retry took 588 ms, which is good, but nothing says why I lost.

v2 (level 1, Pip):
1. 0:00 "Tap to play" takes me straight into duel 1. No menu.
2. 0:02 I have 10 sap, a hand picked for the lesson, the coach bubble "Drag a card onto your half", the star goals on screen, and a pre-placed enemy knight walking at me.
3. 0:05 I drop a knight, archers and bees in about 3 seconds. The bees fly over the creek and the fights start at once.
4. 0:30-0:50 "2x SAP", "POP!", "CHAIN x2" appear. Two towers fall in under a minute.
5. 0:56 "HEARTH SMASHED", a star, a stars-to-sticker bar, "Tomorrow: daily duel, 1-day streak, next: Two Lanes", and a big "Next duel" button. No map detour. This is a much stronger first 2 minutes.

## What was good in v2
- Next duel and Again are one tap, with no loading.
- The defeat card explains itself: "Out-crowned 0-1. Their Hearth had 100% left."
- Star goals are listed with filled and empty bullets, and rewards are shown (new card Mole after level 3, "CHAIN x11" on level 3).
- The golden-acorn twist on level 5 shows up on the bridge, with a banner.
- The map has worlds, stars, stickers, streak and a daily duel.

## What the best app-store game in this genre does that this one still doesn't
Clash Royale makes the first 2 minutes about readable, loud trades. Every troop has a clear silhouette and a name, a hit has a sound and a number, a tower falling shakes the screen, and the card that countered a push is obvious. After the match there is a chest ticking down and a visible next goal. Here:
- Troops are tiny dots seen from far away, so I could not tell which card countered which. "Read the board, drop where it counters" is not really possible.
- Combat has little weight (no hit-stop, no shake), and the damage numbers are small.
- There is no counter hint, for example "bees beat the frog" or "spells beat clumps".
- There is no replay or highlight of how I lost.
- The twists (honey, hive, storm) are text banners only. On levels 13 and 17 the board looks identical to level 1.
- No rewarding variable payout: no chest, no rare drop.

## 5 biggest fixes, in order
1. **Readability and weight.** Zoom the camera in or scale the troops, add an outline or team colour ring, a hit flash, damage numbers, tower-hit camera shake and hit-stop. Toy test 6 -> 8. Mastery cannot be felt when the fight is unreadable.
2. **Counter feedback.** Show a short "BEES beat FROG" style prompt or a ghost hint when a drop wins or loses a trade. Add a mini post-match replay line: "you lost lane 2 because...". This lifts Almost and Mastery.
3. **Make the twists visible on the board.** Show honey puddles, the hive dripping bees and a storm tint, and not only a banner. This lifts Surprise from level 11 onward.
4. **Frame rate.** v2 measured 13.7 fps (v1 22.7) on headless software GL. Cut the shadow and particle cost, or lower the resolution scale, and re-measure on a real phone.
5. **Variable reward and progress.** Add a chest or pick-a-card after wins, a "1 star from the next sticker" nudge on the result card, and a clearer star summary (the three-star row is ambiguous at a glance). Also fix the star-goal banner that overflows the top edge of the screen at the start of each level.

Verdict: TEST
