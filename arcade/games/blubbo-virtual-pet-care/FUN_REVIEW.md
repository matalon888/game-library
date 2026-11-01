# Blubbo FUN_REVIEW (critic gate, PLAYBOOK section 0)

Third cold run (2026-11-01), replacing the 2026-10-31 review (avg 6.9, Almost 6, Mastery 6). Phone viewport 390x844, touch, fresh storage per arm,
Chrome via Playwright, every non-127.0.0.1 host blocked, video and screenshots recorded then deleted. v1 = `/blubbo/index.html` (care + 3 endless minigames),
v2 = `?deep=1` (trips, stars, gift boxes, map). Each arm ran 10.5 minutes of real time.

Honesty notes (read before trusting the scores).
- I drove both arms with the game's own `__game.bot()` plus real touch taps to start. The bot is far better than a new player: in v2 it cleared 26 trips in 10 minutes,
  3 stars on nearly every one, almost no hits. So I did NOT feel a new player's frustration curve; Almost and Mastery lean on the lose cards I forced
  (idle on trip 5 spikes, trip 10 boss, trip 20 pop boss) and on the simulator. The simulator (`simTrip` at skill 0.5 and 0.75, 4 runs per trip, trips 1-30) won every single
  trip, only the spike/boss trips (5, 10, 21, 27, 30) took hits (4 per 4 runs, all survived). If a human is anywhere near that, the game is very easy. A hand-play by a real
  human is still needed on trips 5 to 30.
- v1 bot plays minigames fine and handles care; I restarted taps on the lose cards by hand. v1 saw level 2 in 42 s and I looked at kitchen, playroom, bubble pop, sky hop.
- FPS (1000 ms / mean rAF interval, about 37,800 frames, 10.5 min each): v1 60.0, v2 60.0, p99 frame 16.8 ms, max 16.8 ms. Both valid (>=30).
  Desktop Chrome, software GL, no CPU throttle; not a real phone.

## Scores (0-10)
| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 4 | 7 |
| 2. Toy | 5 | 7 |
| 3. Almost | 2 | 7 |
| 4. One-more | 3 | 8 |
| 5. Surprise | 2 | 7 |
| 6. Mastery | 2 | 6 |
| 7. Tomorrow | 3 | 7 |
| Average | 3.0 | 7.0 |

v2 beats v1 on every test. Average exactly 7.0, lowest test 6 (Mastery). That is TEST territory, not a ship.

## Why each score
- 10-second. v1: care screen, pet is cute, but the first minigame is 2 taps away and has no hint. v2: one tap on "Tap to play" and trip 1 is live; first landing chimes
  and a chime/confetti result arrives at 9 s. Still 7, not 8: the "Drag to steer" banner sits on the first pads and hop has no hit or pop in its first seconds.
- Toy. v1: poking, feeding and soaping the pet is a nice toy; the minigames are dry (catch has no score pop, a miss costs a heart). v2: pop is the toy (rings, +1, FEVER, a x29
  callout at 51 s in trip 3), catch is good (+1, x combo, sparkles); hop is the weakest and plain.
- Almost. v1: "GAME OVER" with just points, no cause; missed food takes hearts. v2 improved: spike hit boxes are smaller and the lose card names the cause that is true
  ("9 of 40 . Spikes got you x4", "0 of 52 . pop gold first"), one line, no scrolling off the card; the boss now has 4 hearts. A fixable loss now. Held back from 8:
  idle test showed the card says "pop gold first" on a trip lost at 0 hearts lost (timer), which reads a bit like a riddle, and I could not hand-test a real near-miss.
- One-more. v1: lose card, tap, home, pick a card, tap: 3 to 4 taps, and a sleepy gate. v2: retry is a big pink button on the lose card, restart is about instant, next trip is one tap. Best part of the game.
- Surprise. v1: minute 10 is minute 1. v2: new idea every 1 to 2 trips early (wobbly pads, spikes, golden snacks, thorns, boss, storm, zigzag); a gift box about every 2 trips with a new look
  (hat, flower). But in a 10-minute run the loop is hop, catch, pop, hop, catch, pop eight times in a row: the rhythm becomes predictable and the box is always the same three-boxes screen.
- Mastery. v1: Best score on a card, nothing else. v2: 1 to 3 stars per trip, three goal chips, streak. Problem: a bot at skill 0.5 gets 3 stars everywhere, so stars do not separate
  skill; there is no "your best run", no ghost, no par time to beat once you have 3 stars. A 3-star trip is a dead end (the retry button is pointless). 6.
- Tomorrow. v1: coins, hats; nothing unfinished. v2: star counter (74 after 10 min), map with next node, "gift in N stars" pull, daily-challenge banner on the start card. Good,
  but one beat of progress and no named collection with an empty slot on screen.

## First 2 minutes of v2, beat by beat
1. 0:00 Start card: Blubbo title, Daily Challenge banner (NOV 1), "Tap to play". One tap.
2. 0:01 Trip 1 "First Hops": GO! text, 3 hearts, progress bar, 3 goal chips (reach, clean, time 22 s). Banner "Drag to steer" covers the first pads.
3. 0:03-0:09 Bounce and chime on each cloud, score counts up; reach the flag, "CLEARED", 3 stars.
4. 0:10 Trip 2 "Snack Drop" (catch): slide under the snacks, +1 floats, x streak, FEVER at streak 8. 0:31 "PERFECT" 3 stars with a "New surprise box" line.
5. 0:32 Gift box screen: three boxes, pick one, reveal, goes on the pet. About 1 s of bot time here, a human lingers.
6. 0:33 Trip 3 "Pop Pop": rising bubbles, ring pops, x29 callout, 0:55 cleared.
7. 0:56 Trip 4 "Wobbly Pads" (yellow wobbling clouds), cleared at 1:11; second box; trip 5 begins at 1:14.
8. 1:14-2:00 Trips 5 to 6: "Mind the Spikes", "Prickly Patch" (pop with thorn bubbles). Moving, but the same three verbs in the same order.

## What the best app-store game in this genre does that this one still doesn't
Pou and My Talking Tom Friends keep the PET as the reward and the toy: every poke, tickle and feed gets a reaction, and a minigame result shows on the pet in seconds (new room, outfit, food) with
a visible shelf of things still missing. In its first 2 minutes you also get a loud "you are getting better" signal (a score to beat, a streak, a coin shower you can spend right now). Blubbo v2 sends you
away from the pet for the entire first 10 minutes: the pet is a hat rack on the minigame screen, the three minigames never mix, and 3 stars comes too easily to feel earned.

## 5 biggest fixes, in order
1. Mastery: make 3 stars mean something. Tighten star goals so a competent player gets 1 to 2 stars on first clear, add a par time or best score per trip with "beat your best" and a retry that
   matters at 3 stars (gold ranking).
2. Difficulty ramp: the bot at skill 0.5 won all 30 trips. Make spikes, storms and bosses actually cost a casual player a few tries from trip 8 on (Almost needs real near-misses), and test by hand.
3. Break the hop, catch, pop rotation: mix verbs in one trip or add a different trip type (chase, bonus room) every 4 trips so minute 8 differs from minute 2.
4. Bring the pet back: show Blubbo reacting on the result card and let the reward (box item, coins) be used right away (a shelf with a visible empty slot; one tap to dress or feed).
5. Tomorrow hook: a named collection (e.g. 12 looks, 4 owned) on the map, a "daily trip" with a streak count, and a 90 %-full gift bar at the end of every result.

Verdict: TEST
