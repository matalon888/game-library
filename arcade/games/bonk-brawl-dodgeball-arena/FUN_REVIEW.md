# Bonk Brawl: fun review (critic gate, PLAYBOOK section 0)

Critic run 2026-10-31. Played v1 (`index.html`) and v2 (`?deep=1`) on a 390x844 phone viewport, about 10.5 minutes each (v1 reached
level 19, v2 reached level 20 of 30), video + screenshots, analytics/API hosts blocked.

**How it was played.** The first ~60 s of each version used real pointer drags as a new player would. After that the in-page
`__game.bot()` drove the run in real time (the bot never lost, so the lose path was checked separately with a forced loss on v2 L3).
I cannot hear audio in headless Chrome: sound and haptics are NOT scored from experience, only from what is visibly synced to hits.
Difficulty above level 20 and the three boss fights beyond L10/L20 were not judged by a human hand.

## FPS: UNDER 30 (prominent)
Measured **about 11 fps for both v1 and v2** (clean single-browser run: v1 9-12, v2 11-12; with two browsers at once 8.7 and 10.8 avg).
This is Chrome headless on SwiftShader (software GL, no GPU) on a cloud box, so it says little about a real phone, but I cannot confirm
30+ fps. The useful finding: v2's extra effects (hit-stop, trails, pillars, belts, crowds) cost nothing measurable versus v1. The
stage uses `deviceScaleFactor` 2 here; a real-phone check (or the 4x CPU throttle in DESIGN.md) is still owed.

## The seven tests

| # | Test | v1 | v2 |
|---|---|---|---|
| 1 | 10-second | 6 | 7 |
| 2 | Toy | 5 | 6 |
| 3 | Almost | 4 | 7 |
| 4 | One-more | 5 | 7 |
| 5 | Surprise | 3 | 8 |
| 6 | Mastery | 3 | 7 |
| 7 | Tomorrow | 2 | 7 |
| **Avg** | | **4.0** | **7.0** |

Why:
- **1. 10-second.** v1: tap, one rival, first bonk lands in ~10 s. Fine but flat, and the start card is the same every run. v2: L1 is
  a single rival who aims wide and cannot win; first bonk is in ~12 s with "CLEARED! 3 stars" right after. Docked because the
  start card is cluttered: the "Your hero / Make a hero" Hero Lab panel sits on top of the title, level label and the rival, and
  the map/closet buttons float over the center line.
- **2. Toy.** Run, scoop, let go. Pleasant, stick follows the finger, the bean waddle is cute. v2 adds hit-stop, camera punch,
  shockwave, "GOT IT!" world-space pops. Still a 6: running around with no ball to throw is only mildly satisfying, the balls are
  small and fast and read poorly at phone size, and the throw has no aim input (auto at the marked rival), so the thumb never
  feels it chose anything. Cannot hear the audio.
- **3. Almost.** v1: you get hit, lose a heart, no reason shown, the level restarts at once. Little sense of "my fault". v2: the red
  ring telegraph plus the 0.35 s lock, a purpose line on the lose card ("WATCH THE RING"), "0 / 3 rivals out", close-call counter.
  Good. Docked because there is no replay/near-miss "SO CLOSE" banner on the lose card.
- **4. One-more.** v1: "Tap to continue" anywhere, restart is instant. No retry cue, no goal to retry for. v2: a huge green RETRY
  / NEXT button, instant, a purpose line that tells you what to try. The win card holds 1.2-1.5 s before NEXT is useful and the map
  detour appears after some wins (it is optional). Solid 7.
- **5. Surprise.** v1 is the same arena with a colour theme swap every level: by level 8 you meet 5 rivals in a clump, not a new idea.
  Minute 10 is minute 1 with more beans. v2: tank at 5, pillars at 6, a boss at 10 (a big new character), a new world with new
  colours and teal glass at 11, bank-shot / catch / gold-ball tricks, conveyor belts planned for 21+. Something new about every
  2 to 3 levels, about every 40 s. This is the best part of v2.
- **6. Mastery.** v1: score per level, "BEST" shown. Nothing shows I got better. v2: a 3rd-star trick shown under the score all level
  (FLAWLESS, CLOSE CALLS, COMBO, BANK SHOT, CATCH, PIERCE, SPEED with a par timer), style meter, stars per level. The tricks are
  visible, but the bank/catch tricks are never taught on screen, so a new player will get them by accident.
- **7. Tomorrow.** v1: nothing but the next level number and a best score. v2: map with stars, a chest bar ("3 stars to the next
  chest"), a closet of 12 locked silhouettes (1/12). Real pull, but nothing is nearly done after a 10-minute session (3 stars of 6
  after L1, chests fill fast when played well) and the daily is not surfaced in the main flow.

## Version 2: the first 2 minutes, beat by beat
1. **0:00** Title card over the arena: BONK BRAWL, "LEVEL 1", a Hero Lab panel, small map and closet buttons, "Tap to play". Busy: five things compete.
2. **0:02** Tap. The card drops, one red spiky rival at the far end, one ball at my feet. "SPEED 25s" under the score. Stick appears under my thumb.
3. **0:03-0:08** Run into the ball, it hops into my hand. Lift the finger, auto-throw. Rival wobbles, no loss risk: its throw goes wide.
4. **0:12** Bonk: hit-stop, pop, confetti. Rival out.
5. **0:13** "CLEARED!" with 3 stars slamming in, "45 pts", "SPEED, clear fast", "3 stars to the next chest", big NEXT.
6. **0:20** L2 "TWO IS COMPANY": two rivals, red landing rings now appear under my feet before each throw. First real dodge. I got hit on the first try 1 in 3 times on the real-finger runs.
7. **0:35** L2 clear, same card. L3 "WATCH THE RING": 3 rivals, rings overlap, close-call counter starts.
8. **0:45-1:10** First retry card: KNOCKED OUT, "0 / 3 rivals out", purpose line, big green RETRY. Back in under 1 s.
9. **1:10-1:30** L4 a dodger (sidesteps my throw), a ball hit I could not see coming once: it blames the ring, not luck.
10. **1:30-2:00** L5, tank (2 hits): the first time the game says "this one is different". Chest bar creeping up. I want L6.

## What the best app-store dodgeball/arena-brawler does in its first 2 minutes that ours still doesn't
1. **A throw I aim.** In the leaders you flick or drag to aim a throw, ball arcs, skill is in the angle. Ours auto-throws at a marked target; one lift of the finger is the whole verb.
2. **Reaction from the crowd and the world.** Rivals ragdoll, fly through the air, land in a pile, the camera follows the knocked-out bean, crowd jumps. Ours: a hit-stop and a pop, then the rival just vanishes.
3. **A reward beat every 30 s.** Chest/coin burst, a skin reveal, a new character introduced with a pose. Ours gives stars at the end of each level and a chest only after six stars.
4. **A clean, empty start.** First screen is just the arena and "tap to play". Ours stacks the Hero Lab ad, map and closet on the first frame.
5. **Immediate teaching by doing.** Hand pointers and a slow-mo moment for catch and bank shot. Ours has the mechanic on level 12-14 with a tag in the HUD and a "tip" nowhere.

## The 5 biggest fixes, in order
1. **Clean the first frame.** Hide the Hero Lab panel and the map/closet buttons until after the first win; the title card should be the arena, the title, "Tap to play". (Lifts tests 1, 4.)
2. **Make the knock-out the show.** The hit rival should fly back and tumble (ragdoll/launch + slow-mo on the last rival), the camera pushes in, a bigger number pops, with a rising pitch combo. (Toy test 6 to 8, 10-second test to 8.)
3. **Give the throw a skill.** Let the player drag-aim a throw (or flick) with a visible arc; keep auto-aim only for L1-2. Today the thumb never chooses. (Toy, mastery.)
4. **Teach the tricks in play.** The first time a bank, catch or gold ball is possible, a hand pointer + 1-line tip + a slow-mo, and a "SO CLOSE" lose card on a missed 3rd star. (Almost, mastery.)
5. **Open a reward on the first minute and keep one unfinished.** First chest at 3 stars (not 6), show the closet reveal at the chest, and leave "chest 4/6" or "world 1: 9/10" visible on the retry/next card and the title card. Surface the daily as a tile on the title card. (Tomorrow 7 to 8.) Also get a real-phone fps number: the 11 fps here must be confirmed as a software-render artifact.

## Beats v1 on all tests? Yes (v2 above v1 on every row).
Avg 7.0, lowest 6 (toy), highest 8 (surprise).

Verdict: TEST
