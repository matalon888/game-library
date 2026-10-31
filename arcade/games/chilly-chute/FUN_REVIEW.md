# Chilly Chute: FUN REVIEW (v1 vs v2 ?deep=1), critic run 2026-10-31

## How it was played (read this first)
- Phone viewport 390x844, touch, Chrome via Playwright, video + screenshots, non-local hosts blocked.
- 10.5 minutes of wall time each: v1 = levels 1-6 (5 wins, 2 losses); v2 = chutes 1-7 (6 wins, 4 losses). New profile each time.
- **Honest limit:** the host was badly overloaded (load average 17 at start, 80-130 during the runs) and Chrome used software GL.
  Measured fps was far under 30, so I could not judge "feel" with a real thumb. The inputs came from the game's own `__game.bot()`
  with 20% of decisions skipped, plus real taps on the start/retry/continue screens. Feel scores come from the screenshots, the video
  and the code. Treat them as a floor on motion quality and a fair read of structure, rewards and level flow.
- No console errors or page errors in either run.

## Measured fps (under 30 in both; environment-limited, NOT a game verdict)
- v1: 10 (menu), then 7.5, 7, 7, 4.5, 4.5, 4, 4.5 while playing.
- v2: 8.5 (menu), then 9, 7, 8, 9.5, 7.5, 7.5, 7.5 while playing.
- Uptime load before the run was 16.9 and it climbed to 130 during v1. Both versions are equally slow, so the fps does not separate them.
  A re-measure on an idle machine is needed before shipping. v2 is no heavier than v1 here.

## First 2 minutes, beat by beat
### v1
1. 0-3 s: title over a bright snowy chute, a Santa-hat penguin on a pink ring, hand-swipe hint. Pretty, readable, no loading.
2. 3-7 s: a tap starts it. Coins in a line, crates and a rock ahead. Nothing is hit yet.
3. 7-39 s: level 1 (210 m). Dodge crates, grab coins (16), end under a checkered arch. Cubes burst on the win. Pleasant but gentle: nothing can go wrong.
4. 39-42 s: "CLEARED! 16 coins". Tap, next level starts in under 1 s.
5. 42-100 s: level 2 (340 m), the same rhythm, a first gem. It is the same ride, just longer.
6. 100-140 s: level 3 (410 m). The first wipeout at 215 m means a restart from zero ("216 m, 53% of the run, tap to retry").
   Retry is quick, but you replay the part you already beat.
7. By 2 minutes: nothing new has appeared. The chute is a bit longer and the snow is a different colour.

### v2
1. 0-4 s: the same title plus a level map button, a "First Slide" label and 5 star dots. The player has a goal at once.
2. 4-8 s: the same start, but the chute is already full of coin trails.
3. 8-50 s: a coin river, a row of crates and orange speed pads. Hitting a pad gives "BOOST!" with flame jets and streaks, and crates smash.
   This is the first real hit, about 40 s of game time in. At a normal frame rate it is probably 15-20 s.
4. 50-70 s: the finish arch, then a win card ("95 coins, 3 smashed"). It shows "5 more stars for a Mint suit" and "Tomorrow: a new Daily Chute, day 1 of a streak".
   The big button says "CHUTE 2". Headless Chrome has no emoji font, so the icons show as squares.
   The text stack on the card is also crowded: the suit line and the daily line run into each other.
5. 70-140 s: chute 2 (379 m), more pads, a stunt chain of 3, a checkpoint flag. Chute 3 follows with gems, a second star and a mid-chute checkpoint.
6. 140-250 s: chute 3. A wipeout at 323 m says "39% of the run, 336 m to go". Retry respawns at the checkpoint (244 m), not at zero. That is the biggest feel upgrade over v1.
   Then snowmen ("Dodge") appear, followed by a themed "Gem Hunt" chute with 12 gems.
7. By 2 minutes: a boost, a smash chain, a checkpoint respawn, a star count, a suit goal and a new obstacle type have all appeared. v1 shows none of that by minute 2.

## The seven fun tests (0-10). A 6 is a 6.
| # | Test | v1 | v2 | Why |
|---|------|----|----|-----|
| 1 | 10-second | 6 | 7 | v1: coins and a dodge, nothing pops. v2: pads and smash arrive sooner and feel bigger, but the first 10 s are still just a ride. |
| 2 | Toy | 6 | 7 | Swipe lane changes spray snow and tone-blip well in both. v2's pad boost and crate smash give a good hit sound-and-flame. Jump and duck are the same in both. |
| 3 | Almost | 5 | 7 | v1 wipes you to zero with only a % shown. v2 shows "336 m to go" and respawns at a checkpoint. Chute 7 killed my imperfect bot at the same 217 m three times in a row (snowmen wall + gems), so there is at least one possibly unfair spot. |
| 4 | One-more | 7 | 8 | Both restart in under 1 s with a big tap target. v2's checkpoint retry is much less painful. |
| 5 | Surprise | 4 | 7 | v1 is the same every level (new snow tint only). v2 introduces a pad, a chain, snowmen and a gem-hunt chute within 10 minutes. I saw no golden or rare moment. |
| 6 | Mastery | 4 | 7 | v1 shows only BEST m. v2 has stars per chute (1 to 2 seen), a smash and chain count and suit progress, but the star criteria are not clear in play. |
| 7 | Tomorrow | 3 | 7 | v1 has nothing unfinished. v2 has "5 more stars: Mint suit", a map, and a Daily Chute with a streak. These are textual promises that I could not feel as pull. |
| | **Average** | **5.0** | **7.1** | v2 beats v1 on every test. No v2 test is under 6. |

## What the best app-store game in this genre does in its first 2 minutes that this one still doesn't
Top endless-runner and sled-surfer games give a hit in the first 3 s, then stack small constant rewards on a single run: coin magnet pulls, near-miss
"whoosh" slow-motion, a rare golden or mystery item, ramp tricks with a big combo scoreboard, and a mid-run special state (fever or hoverboard) that changes
how you look and sound. They also pop a daily chest or a mission strip (3 goals shown at the top) before the first death, so by minute 2 the player
has a reason beyond "the number went up". Chilly Chute v2 has the structure (stars, suits, map, daily), but in the 2 minutes the screen is calm:
there is no near-miss reward, no rare golden piece, no visible mid-run fever state (the SURGE I saw never fired, chain peaked at 3), and the
meta is shown as small text on a crowded win card rather than as a chest or a bar that fills while you watch.

## 5 biggest fixes, in order
1. **Add a loud first hit in the first 5 s of chute 1.** Put a speed pad and a smashable crate within the first 40 m, and ramp the camera shake and sound up. The 10-second test and the toy test are both stuck at 7.
2. **Make the stunt chain, SURGE and fever visible and reachable.** Chain stayed at 3 or less. Give chain steps on-screen scoring ("x2, x3, x4"), a screen flash and a speed or colour change at the SURGE threshold, so combo 5 is clearly bigger than combo 2.
3. **Rebuild the win and lose cards.** The lines overlap (suit text, daily text, buttons) and the icons break without an emoji font. Use drawn icons, one reward line, a filling star or suit bar, and keep the big "next" button clear.
4. **Check the chute 7 wall (snowmen row at about 217 m).** The same spot killed three attempts in a row. Make sure there is always a readable, fair gap, or telegraph it earlier, so a loss feels like my fault.
5. **Add one rare variable reward per chute** (a golden snowman, a mystery gift pad, a 1-in-20 jackpot arch), and show 3 session goals under the HUD that pay toward the next suit. Right now rewards are predictable and the tomorrow pull is text only.

Also: re-run the fps check on an idle machine. Both versions were under 30 fps here (4-10 fps) because of host load and software rendering, so smoothness is unverified.

Verdict: TEST
