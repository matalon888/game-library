# Neon Hop: FUN_REVIEW (critic run, lane 83 gate, 2026-10-31)

Method: cold play of v1 (`index.html`) and v2 (`index.html?deep=1`), Chrome via Playwright, 390x844 touch viewport, fresh storage, 10.5 minutes each (video + screenshots, analytics/non-127.0.0.1 blocked). Input was my own steering logic, not the game's built-in bot: an in-page "human-ish" player with Gaussian aim error (shrinking as it wins), a 4% lapse rate (a 0.7-unit misread), a finger speed cap, and pointer drags through the game's real handlers; real touch taps for start/retry. Menus (NEXT/RETRY/Map/Balls) were clicked as a player would.
Honest limits: headless, so I could not HEAR anything. Audio claims (chime pitch climbing, fever) are from the code and DESIGN.md, not from my ears, and the audio-dependent parts of tests 1 and 2 are scored conservatively. The bot has no "feel", so feel scores come from the video/screenshots, win/loss rates and structure of the game. Daily Jam was not played. I did not see FEVER on screen in a screenshot (I saw PERFECT x3/x4); the bot likely reached it but I cannot confirm.

## FPS
Machine was heavily loaded (load average 35-55 on 48 cores, software GL). The first attempt at deviceScaleFactor 2 gave 12-19 fps for both games and made the bot lag, so I discarded it and re-ran at DPR 1.
- v1: mean 41.8 fps, p5 31, min 28 (14 of 619 seconds under 30).
- v2: mean 45.6 fps, p5 34, min 27 (5 of 619 seconds under 30).
Neither is meaningfully under 30 on this machine; at DPR 2 on software GL both dropped to 12-19, so the glow-sprite/transparent-tile scene is fill-rate heavy and a weak phone could dip. Not a verdict issue.

## Numbers from the 10-minute runs
- v1: reached level 12, 11 wins / 16 losses. Level 1 is 10 s long, 14 tiles.
- v2: reached level 17 (World 2), 16 wins / 10 losses, balls unlocked early (Coral after level 1, Aqua soon after), gem chest at 16/30 by level 4. Level 1 is 24 s, 28 tiles.
- 4 of v2's 10 losses happened on the first 0-4 tiles of a retry (levels 4, 8, 12, 15: "0/93", "0/70" tiles). Retry lead is 1.0 s in v2 (v1 keeps 1.6 s). Some of this is my bot's reaction time, but a player whose finger is wherever they left it will see the same thing: the first tile can be a 2-unit hop with one second warning. That is the "unfair" kind of loss.

## First 2 minutes, beat by beat

### v1
0:00 Pink synthwave scene, giant NEON HOP logo, "Twinkle Twinkle, Traditional", a bobbing finger "Hold & drag to steer". No Play button, any touch starts. Good.
0:03 Ball starts hopping on its own (the demo autopilot on level 1), tiles sink away behind it. PERFECT / PERFECT x3 pops, sparks, ring.
0:06-0:10 Autopilot hands over to me; steering is relative drag. Score ticks up. Level 1 is a 10 s ride.
0:13 Win, instant "LEVEL 2" tile palette flip to cyan, new song. No fanfare beyond a flash and confetti.
0:20-0:50 Level 2 (30 tiles) is where the first real losses come. "OOPS! 14% - 3 pts" plus "Tap to retry"; one tap puts me back in, about 1.5 s dead time.
0:50-2:00 Levels 3-5: new colour and song each level (cyan, orange, green), gems (+3), BEST counter. Same mechanic and same step size pattern the whole time, only longer.
Net: instantly playable and pleasant, but by 1:00 I have seen everything it will ever show me.

### v2
0:00 Identical title screen (adds a MAP button and level subtitle, "Just ride: huge tiles in the middle, cannot be lost"). The "why" line is read-me text and clutters the title.
0:03-0:10 Same autopilot and pops; v2 adds a pitch-climbing chime and bigger bursts as the combo grows (per code).
0:24 Level 1 ends, results card: stars animate in, "PERFECT RUN!", "New ball: Coral (now equipped)", "Next ball: Aqua, 3 stars to go" with a bar, NEXT / Replay / Map. A reward in 24 s. Bug: it says PERFECT RUN with 39% perfect (level 1 is a gift 3 stars, the title does not match the number on the card).
0:26-1:18 Levels 2 and 3 (gems, first real misses). Stars 2 each. Ball is now Coral, then Aqua: visible personalization.
1:27, 1:49, 1:54 Three losses on level 4 in a row; the 3rd was on the first tile (0%). Card: "OOPS! 21% of the song" with a progress bar and RETRY. The "SO CLOSE! N tiles from the end" line never appeared in my losses; the near-miss framing is good in theory but did not fire, and "OOPS!" at 21% is the same flat line v1 has.
2:00 Level 4 won on the 4th try at 2:24. Map shows stars per node, Next ball bar, gem chest 16/30, "Tomorrow: Daily Jam".
Net: the same 10 seconds as v1, then a visible reason to keep going (ball, stars, bars) from the first minute.

## The seven fun tests (0-10)

| Test | v1 | v2 | Notes |
|---|---|---|---|
| 1. 10-second | 6 | 7 | Both open on a self-playing hop with pops and sparks (nice, zero friction), but the first 10 s is watching a bot until I touch. v2 adds the chime ramp (unheard) and bigger bursts. |
| 2. Toy | 6 | 7 | Squash, ring, sparks, glowing trail and beat-pulsing sky feel good. Steering is a relative drag with no mid-air interest; v2's climbing chime is the only real toy upgrade. Neither has the satisfaction of a finger-flick. |
| 3. Almost | 5 | 6 | v1: hops of up to 2.2 units per beat feel random-ish, flat "OOPS". v2: progress bar and 85%+ "SO CLOSE" exist but I never saw them; early-tile deaths on a 1.0 s lead feel unfair, not close. |
| 4. One-more | 7 | 8 | Both are a tap. v1 ~1.5 s dead time, v2 about 1 s lead plus a result card with one big RETRY and the bar that shows how far I got. v2 slightly ahead; the post-win card (stars, NEXT/Replay/Map plus two meta panels) is heavier than v1's immediate tap. |
| 5. Surprise | 4 | 6 | v1: palette and song change per level, nothing new at levels 2-12. v2: gems at L2, a ball unlock at 0:24, sliding tiles in World 2 (level 13+, after ~7:30), HARD levels (11, with a red badge). Still 7 minutes before the first genuinely new mechanic. |
| 6. Mastery | 4 | 7 | v1: a BEST score and a tile-by-tile percent, I cannot tell I'm better. v2: stars by % perfect, per-level stars on the map, my pass rate rose over the run. |
| 7. Tomorrow | 2 | 8 | v1: nothing. v2: Next ball 1 star away, gem chest 16/30, Daily Jam streak line, a lit "level 12 is next" map, i.e. real Zeigarnik hooks. |
| **Average** | **4.9** | **7.0** | v2 beats v1 on every test; lowest v2 score is 6. |

## What the best app-store game of the genre (Magic Tiles 3 / Tiles Hop / Beat Hopper style) does that this still doesn't
Tiles Hop and Magic Tiles make the first 2 minutes about a song you know and a screen you cannot stop touching: the music responds to every tap (miss one note and the melody audibly breaks, hit it and you ARE the player), there is a clear pop-music catalogue the player chooses from in the first 10 s, and every few seconds a tile type, speed-up or colour flip asks for something different. Here the player never chooses a song (a "Twinkle Twinkle" first is not a hook), the steering is one-axis dragging that feels like piloting not performing, the ball hops on the beat whether or not I do anything (so the music never reacts to me), the first level asks nothing (24 s of cannot-lose), and the first genuinely different mechanic is at level 13, 7+ minutes away. The leaders also show a short fail reason in-run ("MISS", camera lurch, music cuts to a stinger) instead of a flat "OOPS".

## The 5 biggest fixes, in order
1. Make the first 90 s ask for something: compress the teach ladder so a new idea appears every ~30-40 s (gems by 0:30, a slide or fork before 2:00), and shorten L1 to about 12 s. Today the first 7 minutes are one mechanic with different colours.
2. Make the music respond to me: on PERFECT add a melody/harmony layer or stinger, on a miss or loss audibly drop notes or stall the track (not just a fail synth). Hearing the song get better or worse is the genre's core pleasure.
3. Fix the unfair-start deaths: on retry the first tile can be 2+ units away with 1.0 s warning (4 of 10 losses). Cap the first-tile offset (like level 1's `safe`) or give the 1.6 s lead back, and apply the 85%+ "SO CLOSE" text to the whole fail card so near-misses feel loud.
4. Let the player pick the song and see it: a 3-song choice on the first retry or at the end of level 1 ("Pick your jam"), with song titles people know, and the "why" line moved off the title screen. Level names like "Twinkle Twinkle · Just ride: huge tiles..." read as a tutorial.
5. Fix the result card honesty and weight: "PERFECT RUN!" at 39% perfect is wrong; show the real % and what is needed for the next star ("+2 perfects for 3 stars"), make the star meter the headline, and keep the card to one primary button. Also surface the near-miss and fever states on screen (a visible FEVER bar), since I could not confirm it from screenshots.

Verdict: TEST
