# Squad Surge FUN_REVIEW (critic run 3, 2026-11-01)

Played cold on a 390x844 touch phone (Playwright, Chrome, SwiftShader, fresh context each, every non-127.0.0.1 host blocked). v1 for 10.5 min, then v2 (`?deep=1`) for 11 min, one after the other (not in parallel).
Input: real CDP touch drags and taps for the first ~22 s of every level and for all boss phases. The rest of each level was `__game.bot()` (a bot, not my thumb). My drags were random, not skilled, so the skill ceiling and "almost" scores come from cards, logs and screenshots.
I did not hand-play the 2-minute beats with intent, so treat mastery as inferred.

## FPS (rAF counter; box was NOT idle)
- `uptime` at v1 start: load average 11.34 / 19.72 / 31.37. At v2 start: 14.68 / 20.40 / 30.19. 48 cores, software GL, no GPU.
- v1: title 23.6 fps. Play 22-28 for the first 2 min, then 11-15 fps for the rest of the run (L3 onward, 24 samples, most 11-13).
- v2: title 23.1 fps. Play 21-35, median about 28, never under 21 over 11 min.
- So v2 held higher fps than v1 under the same box. Both are SwiftShader numbers, which are pessimistic; a real-device check is still needed. No page errors in either run.

## Run stats
- v1: 3 wins, 30 losses in 10.5 min. Cleared L1-L3, then died on L4 about 25 times in a row, mostly in the first 30 z-units (n=1, an early saw kills the lone start buddy) or in the clash. Random drags make v1 L4 close to unwinnable, because you start with 1 buddy and no safety.
- v2: Tracks 1-6 cleared (6 wins, all with a boss fight), 33 losses. Stuck on track 7 (saw + posts + rival patrol + boss, par 16/30) for the last 8 minutes: about 28 losses in a row, with 20+ losses coming from the bot and my drags, spread across saws, clash and boss. The bot-run squad usually reached the boss with 1-4 buddies and the boss was untouched (0-10% down). Track 7 is a wall for a player who is not good yet; track 6 right before it had been clear in 3 tries.
- v2 loss card: "SQUAD WIPED! The rival gang beat you: bring more buddies", "103% OF TRACK · ONE MORE!", "Lost 21 to saws · 7 to the rival gang", "Pick the gates that add buddies". It names the cause, the progress and a tip. That is a real improvement on v1's one line ("Recruit more buddies on the way").
- Boss fight reached and won on tracks 1-6; boss lost on track 7 ("The boss had 28 HP left (100%)", "You reached the boss with 1").

## Required v2 checks
- First gate on track 1: "+5 | x3". The squad is 4-9 strong when it arrives. The auto-demo steers a new player toward the white buddies, and my first drag put the squad on the x3 side. The decision is almost not a decision (x3 of 9 vs +5 is obvious), which is fine for a teach, but it is also why track 1 feels like a tutorial with no tension. A new player ends track 1 with 41-52 survivors against par 26.
- Golden buddy: a gold-coloured buddy was visible on tracks 2 and 5 (the `Y` rows, 'Y>' on track 2, top of the lane in the track 2 screenshot). I did NOT capture the 'GOLDEN! +10' popup on screen (the bot/drag did not catch one while I was sampling). So that moment is unconfirmed by me.
- Boss chest: confirmed on the win card of track 6. "🎁 BOSS CHEST: +3 stars!" shows (together with "NEW SQUAD COLOUR: Mint!"). Tracks 1 and 2 cards showed "chest in 2 new tracks" and "chest in 1 new track" counting down. Chest is every 3rd new track, as designed; however, the card text is crammed: 4 lines of small white text stacked on a busy background, the chest line sitting on top of the castle art (hard to read, easy to miss). Nothing opens, shakes or reveals: it is only a text line.
- Card gap: track 2 card said "+3 stars" when the earlier L1 card also said "+3 stars", so the numbers do not feel earned differently (par 26 both times).

## v2's first 2 minutes, beat by beat
1. 0 s: title shows already-running track with a small yellow squad (4) and "SQUAD SURGE · Tap left or right to steer · or drag". Camera behind the runners, rival gang visible at the castle gate far away. Good promise.
2. 2-6 s: demo auto-steer runs (the squad pulls itself to the white buddies: first recruit pop in under 6 s). Count pill 4 -> 9 as buddies join. First satisfying thing happens inside 10 s.
3. 6-12 s: first gate "+5 | x3" (glass panels, floating "+2" popup, squad swells). My drag takes over. Squad turns into a crowd of 20-40.
4. 12-18 s: castle gate opens, boss "club" with 12 HP, a swarm of 40+ yellow beats it in about 3 s. "TRACK 1 CLEARED! 41 survivors · par 26 +3 stars", "chest in 2 new tracks", "3 stars to Cherry", "Tomorrow: a new Daily Surge · day 1". Tap Next.
5. 21-52 s: track 2, first saw gap. Squad of 4 again (reset), a gold buddy up ahead, a boss with an 18 HP club. I won with 29 survivors and got "NEW SQUAD COLOUR: Cherry!" on the card: a surprise at 52 s.
6. 56-92 s: track 3 (first gate pair "+10|+20", both good) and track 4 (posts) went by without a loss. Boss swats 2 at a time. The squad recoloured Cherry.
7. 93-111 s: track 5 red gate (read before you pick). 26 survivors, 2 stars (par 40).
8. 113-137 s: track 6 is the first track I lost (3 times, early at z -29 -> a saw). Then won with 13 survivors, 1 star, with BOSS CHEST +3 and "NEW SQUAD COLOUR: Mint!". That is a real variable-reward moment at 2:17.
9. 143 s+: track 7, the first wall.
So the first 2 minutes = 5 clears, 1 new colour, 1 chest, 3 deaths. Fast and generous. It is satisfying and clear, but the loop is the same three beats (recruit, gate, boss swarm) each time.

## The seven fun tests (0-10, 6 is a 6)
1. **10-second test**: v1 5 (a demo that runs on its own; squad of 1, only a handful of recruits, no big moment before 30 s). v2 8 (start with 4, recruit pops and x3 gate by 12 s, win by 18 s, confetti).
2. **Toy test**: v1 5 (dragging a crowd is pleasant, a bit floaty, but squad of 1 is dull). v2 7 (crowd sloshes and swells, gates with "+2" popups and sound; the tap-to-side steering is decent; still no per-recruit chain feel like "pop pop pop" scaling).
3. **Almost test**: v1 4 (one generic line, deaths at n=1 early feel random). v2 7 (the card explains why, shows 103% / 74% of track, "ONE MORE!", and a tip; but a boss that is 0% down after you reach it with 1 buddy is not "almost").
4. **One-more test**: v1 6 (tap to retry, about 2 s). v2 8 (about 2 s: card to play; "ONE MORE!" with a progress bar).
5. **Surprise test**: v1 3 (L1-L4 are the same recruit + saw + boss). v2 7 (new colours at tracks 2 and 6, chest at 6, a new hazard in track 2, 3, 5 (red gate), 6 (spinner), 7 (rival), and a golden buddy; but I saw nothing new in minutes 5-11, just track 7 on repeat).
6. **Mastery test**: v1 3 (no star par, only a count; the L4 wall teaches nothing). v2 7 (stars vs par, survivors count, "14/26 for 2/3", the trophy counter; but I did not feel myself get better with random drags, and track 7 gave no sign of improvement).
7. **Tomorrow test**: v1 2 (a level number, nothing else). v2 7 (stars to the next colour, chest in N tracks, Daily Surge line, the map button; the unfinished things are on the card only, in small text).

## What the best app-store crowd-runner does that this one still doesn't
- Starts the first 10 s with a bigger, more readable number fight: the top crowd-runners pour dozens of units through multiplier gates with an escalating "pop-pop-pop" and the camera widening as the crowd grows. Here the crowd stays about 4-40 and the camera stays the same.
- Gates are real choices from the first level (x2 vs +30 with a different path, a hazard behind the "good" one). Track 1 and 2 here are "pick x3". The top games make the player look at both.
- Every few levels the world changes: a new character skin, a new arena, a mid-run bonus room (a ramp, a shooting section, a collection lane of coins) so the 10th minute looks unlike the first. Here it is the same lane, same props, a different background colour per world and a new tint for the squad.
- Boss and win are an event: a slow-mo, a big hit, the boss visibly shrinking, a chest that you open with a tap. Here the boss dies as a 3-second swarm and the chest is a text line.
- Between levels there is something to tap (a coin-multiplier wheel, a chest, a character upgrade). The only meta here is stars and colours and it is displayed as 4 lines of small text.
- Difficulty is dynamic: lose twice and the next try is gentler (more recruits, a visible helper). Track 7 stayed a wall for 8 minutes.

## The 5 biggest fixes, in order
1. **Track 7 wall / retry help.** After 3 losses on the same track give a visible assist (extra +10 start squad, a slowed saw or a "skip gate" ghost path). 28 losses in 8 minutes is where players quit. Also check the track 7 par (16/30) against a 4-buddy start: a bot got to the boss with 1-4.
2. **Make the boss and the chest a moment.** A slow-mo hit, the boss HP bar visibly dropping as the crowd hits it, and a chest that appears as a 3D object with a tap-to-open pick-1-of-3 instead of a text line. Make the "GOLDEN! +10" pop big enough to see and hear for 1 s (I could not confirm it).
3. **Real gate decisions on tracks 1-2.** "+5 | x3" is a free x3 so it teaches nothing. Put a saw or a red cost behind the x3 side at track 2, so the player reads both sides.
4. **Make the win/loss card readable.** 4-6 lines of small white text over a purple castle (chest line, new colour, stars, tomorrow) is a text wall. Show 3 icons with numbers (stars bar, chest progress 2/3, colour progress) and larger type.
5. **Escalating spectacle and a change of scene.** Widen the camera and add a bigger sound/particle step for each 10 buddies; add a mid-track bonus lane (coin ramp or "x" lane at the end) every 4th track, so minute 8 looks different to minute 1. Also: v1's squad of 1 at the start and first-30-unit deaths show that v1 should not ship as the control without a safer start (v1 is 3 wins / 30 losses by minute 10).

## Score table

| Test | v1 | v2 |
|---|---|---|
| 10-second | 5 | 8 |
| Toy | 5 | 7 |
| Almost | 4 | 7 |
| One-more | 6 | 8 |
| Surprise | 3 | 7 |
| Mastery | 3 | 7 |
| Tomorrow | 2 | 7 |
| Average | 4.0 | 7.3 |

Verdict: TEST
