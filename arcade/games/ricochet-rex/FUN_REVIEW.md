# Ricochet Rex: FUN_REVIEW (cold critic play, 2026-10-31)

Method: Playwright + Chrome, phone viewport 390x844 touch (CDP touch drags), video + screenshots, all non-local hosts blocked.
About 10.5 min of play each on v1 (no player code, so the A arm) and v2 (`?deep=1`). My aimer is a crude "drag at a random
goon, with noise" player, so it is a sloppy new player, not a good one. v2 reached room 9 (8 wins, 24 losses, 19 stars in 10 min).
v1 cleared 2 levels, then lost 54 times in a row on a generated level 3 (aimer plus the QA helper bot every 6th try).
Caveat: the star glyph renders as a tofu box in this headless Chrome (font), so star screens looked broken to me. Check on a real phone.

## FPS (requestAnimationFrame over 5 s, shared software-rendered machine)
| arm | fps |
|---|---|
| v1 | 11.9 |
| v2 | 11.7 |

**Both are under 30 fps.** This is a SwiftShader box under load, so it is not a real-phone number. v1 and v2 are equal, so v2 added no measurable cost. Judge feel on a real device.

## Scores (0-10, honest)
| # | Test | v1 | v2 | Notes |
|---|---|---|---|---|
| 1 | 10-second test | 6 | 6 | Room 1 is the same in both: one goon, sight already on him, a kill within about 7 s. Satisfying but quiet. Title still says "Tap the bad guy to shoot him", while the real verb is drag-and-release. |
| 2 | Toy test | 6 | 6 | Aim, bounce and ragdoll are pleasant. Nothing in the toy changed in v2 (same pops, same sounds). Plain repeating shots get no escalation. |
| 3 | Almost test | 4 | 6 | v2 loss card says "1 goon left standing", and the sight shows two bounces, so losses read as my fault. No "SO CLOSE" moment, no replay of the near miss. v1 had a spike at generated level 3 and I lost 54 times in a row. |
| 4 | One-more test | 7 | 7 | The retry card re-tries on any tap and restarts instantly (the best thing in both). The win card has a big Next button. |
| 5 | Surprise test | 3 | 5 | v2 gave a HARD ROOM red frame at room 9, TNT, crates and ropes. In 10 min I saw no jackpot, golden goon, combo spectacle or bonus. World 2 starts at room 13 and is too far away. Rooms 1 to 8 look and feel the same. |
| 6 | Mastery test | 2 | 6 | v2 has par, a star meter and stars per room, so better aim shows. Combo pops are tiny and there is no best/time/trick-shot reward. v1 has only a level number and a score. |
| 7 | Tomorrow test | 1 | 6 | v2 has a room map, "8 more -> Royal suit" on every win card, and 12-room worlds. No daily room, no chest, nothing at 9/10. v1 has nothing at all. |
| | **Average** | **4.1** | **6.0** | |

## First 2 minutes of v2, beat by beat
1. 0 s: the title card "RICOCHET REX" with a pointing hand and "Tap the bad guy to shoot him". The map button sits top right. Tap to start.
2. 6 s: room 1. One goon, aim line already on him. Drag, release, the bullet bounces and he ragdolls with slow-mo and confetti.
3. 12 s: "CLEARED!", a star row, "+300 for 2 spare bullets", "3 more -> Crimson suit", a big ROOM 2 button. This is the best beat of the first minute.
4. 15 s: room 2 "Lined Up". Two goons in a line, so a one-bullet-or-two decision. Cleared in about 6 s.
5. 25 s: room 3, the first room you can lose. A pillar hides the goon and you bank off the ceiling. My first 4 tries failed here ("OUT OF AMMO, 1 goon left standing", tap to retry). Retries are instant, which keeps it from being angry, but there is no hint and no near-miss feedback.
6. 60-120 s: more retries on room 3, then room 4. Each room is new and short, but the look and sound barely change, and nothing bigger than a "DOUBLE KILL" pop ever happens. Total at 2 min: room 4 about to be cleared, 5 to 6 stars.

## What the best app-store game in this genre does in its first 2 minutes that we still don't
The genre leader is Hitman Sniper / Mr Bullet / Sniper Elite style: bullet-physics puzzle games with a real tutorial.
- **Killcam on the shot that matters.** A slow-mo follow-cam on the bullet in flight, with a heavy impact, the camera punching in and a brief freeze on the kill. Ours has slow-mo on the last kill only, from a fixed side view.
- **A new toy every 30-60 seconds.** Within 2 minutes they have shown you an explosive barrel, a chain reaction, an environment kill and a "headshot!" bonus. We have the same room for 8 rooms.
- **A 2-minute reward ladder.** A currency or chest appears in the first minute (coins, a skin roll, a random weapon), with a number that visibly goes up on every kill. Ours shows only a suit unlock text; there is no spend, roll or reveal.
- **Variable reward and a character.** There is a mission narrative, a funny boss, taunts and a "bonus target" and rare kills that pay extra. We have the same blue-cap goons.
- **Per-kill escalation.** Combos, streaks, "PERFECT!" with a score multiplier and a loud audio stinger, so a good shot is louder than a normal shot. Ours is flat after the first win.

## The 5 biggest fixes (in order)
1. **Surprise (lowest test, 5): add a variable-reward layer.** A rare golden goon in about 1 in 8 rooms (double stars, a gold burst), a bonus room after every world's boss, a chest at each world end with a random suit/hat roll, and a trick-shot bonus (3 bounces = "BANK KING +1 star"). Also pull the first new mechanic (TNT/crates) into rooms 4 to 6 so the first 3 minutes already change.
2. **Escalating spectacle on every kill.** A kill-streak ladder (2 kills = pop, 3 = slow-mo and flash, an all-kills-in-one-bullet shot = freeze-frame, screen flash and a stinger), a follow-cam on bullet, and a bigger final-kill hit-stop. Currently combo 5 looks like combo 2.
3. **Near-miss feedback on a loss.** On "OUT OF AMMO", replay the last bullet's path with "SO CLOSE: 0.3 m off" on the goon it nearly hit. After 3 fails in a room, show a ghost aim line ("hint") for one shot. Losses on room 3 and the v1 level-3 wall (my 54 losses) need to feel fixable.
4. **Tomorrow hooks.** A daily room (one seeded room each day with a streak counter), a chest at "9/10 stars of the world" shown on the map, and a "next suit in 1 star" progress bar on the start card. Today the player closes the game with nothing unfinished except the next number.
5. **Fix the first 10 seconds and the performance.** Change the start-card hint to "Drag to aim, release to shoot", show a demo hand drag on room 1, and add a first-shot sound/shake bump. Then profile frame rate on a real phone: the software number was about 12 fps for both arms (v2 is no worse than v1). Also make sure the star glyph has a fallback (inline SVG) so it never shows as a box.

Verdict: FAIL
