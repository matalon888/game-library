# Viral Den: cold-play critic review (v1 vs v2)

Critic run 2026-10-31. Phone viewport 390x844, touch, DPR 1, headless Chrome (channel chrome, software GL), real CDP touch events,
Playwright video + screenshots, every non-127.0.0.1 request aborted. Playbook section 0 (seven fun tests) read first.
Both versions were played in parallel for 10.7 min each (640 s).

- **v1** (`index.html`): tap-spam at about 4 taps/s on the stage, with a sweep of the four shop cards about every 10 s. Reached
  level 6 (about 411K followers), all cards upgraded 3-4 steps. Never failed a level.
- **v2** (`?deep=1`): 25 videos in 10.6 min, played by touch events timed off `__game.notes`/`songT` (taps, holds, flicks; +10..+80 ms
  human bias, 6% skipped notes). Result: 2-3 stars on every video. Then a separate "do nothing" test of the fail sheet.
- Limits: driven by a script, not a human thumb. **Audio not heard** (headless), so the "every hit plays the next note" toy appeal
  is scored from the visuals and code only. The bot never opened the den shop in v2, so I did not see the den evolve there.
  The tofu boxes in some v2 labels (e.g. "7 [] to fan mail") are a headless font gap; real phones likely show a star/mail icon.

## Frame rate and load

- `uptime` at start: load average 10.8 / 20.8 / 32.6 (48-core host). It was 35-42 for most of the run, so everything here is pessimistic.
- rAF count over 5 s, in play, **solo and fresh** (after the parallel run, host load ~33): **v1 58.8 fps, v2 60.0 fps**.
- During the 10-min parallel run (host load 35-42), 5 s windows: **v2** held 60 early and drifted to 49-58 late (median about 55,
  min 41). **v1** went 60 for 2 min, then declined steadily: about 50 at 5 min, about 44 at 7 min, **36-38 by 9-10 min, one dip to 30**.
  Same host, same time, so v1's steady decline looks like the game and not the load (emote/confetti/room-object growth in a maxed
  room, or a leak). Worth a profile on a real phone. v2 never went under 30; its worst window was 41.

## Scores (0-10)

| # | Test | v1 | v2 | Why |
|---|------|----|----|-----|
| 1 | 10-second | 7 | 8 | v1: first tap gives a "+4", emoji, hearts, Kai poses. v2: first clip hits inside a few secs, "PERFECT +24ms", sparks, and the first video goes VIRAL with confetti at about 12 s. |
| 2 | Toy | 6 | 7 | v1: pleasant but identical every tap; the pose and emoji repeat. v2: a pitched note per hit (unheard), holds and flicks vary the motion. Dinged for a lane that is a small purple strip at the bottom with the action up in the room. |
| 3 | Almost | 4 | 8 | v1 has a 40 s timer and spam never loses, so there is nothing to nearly miss. v2 shows "74% short", every missed clip on a strip, "missed at bar 2, 5, 6", and "you tap 25 ms late: tap a hair sooner". A loss is clearly my fault and fixable. |
| 4 | One-more | 5 | 8 | v1 rolls on without any stop (a plus), but there is no loss or retry to want. v2: one green RETRY, restart under 1 s, a NEXT button in the same spot. |
| 5 | Surprise | 4 | 6 | v1: minute 10 is minute 1 with a nicer room and bigger numbers. v2: holds, flicks, troll notes, golden notes, 3 worlds, fan mail and "hard" tiles. But the lane and the loop look the same at video 20 as at video 3. No chest or jackpot moment seen. |
| 6 | Mastery | 3 | 8 | v1: buying cards is the only skill. v2: stars, S rank, % perfect, ms error, best combo, "NEW BEST", and the star counts moving with my timing. |
| 7 | Tomorrow | 4 | 7 | v1: only the next level goal. v2: day streak (+$20, "come back tomorrow for 40"), "7 to fan mail", a star bar one star from done, 1-2 star videos to replay. Still no daily room or chest. |
| | **Average** | **4.7** | **7.4** | v2 beats v1 on all seven. No v2 test is under 6. |

## First 2 minutes, beat by beat

**v1**
1. 0 s: pink sky, grey room, Kai with a phone on a box. Title "VIRAL DEN", a hand and "Tap to film content". Four shop cards are
   already on screen.
2. 2 s: first tap. Kai poses, "+4" floats, emoji and hearts pop. Followers tick up. A pleasant micro-reward.
3. 10 s: a HYPE bar and a "40 s" timer. Tapping fast nudges HYPE but it falls back to x1 for the whole first minute.
4. 15 s: the first coins arrive. The Room card is the cheapest, so I buy it. The room changes (bed, poster). A nice moment.
5. 30-60 s: "+1 fans/s". I keep spamming. The score just climbs and the round ends at about 1K followers. No goal I can fail.
6. 80-120 s: a Camera tripod and Lights show in the room, and HYPE goes to x5 once. Then level 2. Same action, bigger numbers.

**v2**
1. 0 s: same title card (no shop cards, only a small TV button). "Tap to film content".
2. 2 s: first tap starts "Hi, I'm Kai!". A purple lane appears at the bottom with a REC ring and gold clips sliding in.
3. 4-8 s: I tap on the ring. "PERFECT +24ms", sparks, a note, the hype bar fills, combo counter. Instantly readable, and no tutorial text.
4. 12 s: HYPE full, "GOING VIRAL!" in huge type, confetti rain, x5 multiplier. This is the best moment in either version.
5. 16 s: the sheet slides up: two stars, S RANK, 100% perfect, a day-streak bonus, a fan-mail bar, and the den shop with $ I earned. NEXT.
6. 17-120 s: videos 2-6. A new song each time, holds on video 3, a first flick, a first troll note around video 6-7. Each video is
   about 15-20 s, so the 2-minute mark is about video 6.

## What the best app-store rhythm-tap game does that this one still does not

Think Magic Tiles 3 / Piano Tiles / Beatstar / Tap Tap Rush. In the first two minutes they:
- **Put the notes where the thumb and eyes are.** The lane is the whole screen. Here the lane is a thin strip under a busy 3D room
  that demands attention at the top.
- **Let me play a song I know.** Hits assemble a recognisable hit song, so every tap feels like I am performing it. Here each
  video has a short original tune, and with a note per hit it is a toy, not "my song".
- **Give a bigger reward curve inside one run.** Streaks add layers (lights, a crowd, a backing track, a multiplier ladder with
  a distinct sound for 25/50/100). Here the combo has callouts at 10/20/30 but the stage looks the same.
- **Give a rare big win.** Chests, a golden track, a random "unlock a skin" in the first two minutes, and a visible next unlock
  ("3 stars to open the next world"). v2's rewards (day streak, fan mail) are numbers and bars, not a reveal.
- **Make the thing I buy change how I play.** Magic Tiles' unlocks are songs and skins. In Viral Den the den makeover is cosmetic
  and detached from the lane; it gives cash that does not alter the lane.

## The 5 biggest fixes, in order

1. **Make the lane the screen (or at least the bottom 45%).** Scale the lane up, add a glowing hit line, and let Kai and the room
   react as a backdrop, not the focus. This lifts Toy (7) and Surprise.
2. **Add a surprise every 60-90 s.** A chest after a 3-star video with a random pick (a rare den item or a cosmetic for Kai), a
   rare golden "mega clip" that appears once in about 20 videos with a jackpot moment, and a random "trend" modifier (double-time,
   mirrored lane). Surprise is the lowest score (6).
3. **Escalate a run visibly.** At combo 10/25/50 add layers: a light rig turns on, a crowd of phones appears in the room, the
   backing beat adds drums. Currently the room is static through a combo.
4. **Tie the den to play and show it.** Buying a den item should change the lane (a new hit sound or ring skin), and the sheet
   should show the den change right away. Add a daily room or a "daily video" for the Tomorrow test (7), with a chest at 9/10 stars.
5. **Fix v1's frame-rate decline and drop v1 as the default.** v1 slid from 60 to about 37 fps over 10 min while v2 did not; profile
   the particle/emoji/prop growth, and replace the "spam to win" default with v2 if the A/B holds. Also fix the tofu icon boxes
   (embed or fall back from an emoji font) on the v2 sheet.

Verdict: TEST
