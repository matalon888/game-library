# Dust Descent: FUN REVIEW (critic gate, 2026-11-01)

Critic: cold play as a new player, phone 390x844 with real touch input (CDP touch events: taps and drags). I read only
`window.__game` state. About 12 min on v1 (level 1 to 5, 2 losses) and about 12 min on v2 (`?deep=1`; levels 1 to 6, 3 losses at L6, a chest, 9 stars).
All non-127.0.0.1 requests blocked.

## FPS (read this first)
**Under 30 fps: 6 to 9 fps in this run, on both v1 (7.6, 8.2, 8.6) and v2 (5.9) during play (rAF over 5 s).**
The environment is headless Chrome on a Linux server with software WebGL (SwiftShader, no GPU), so this is an upper bound on
how bad a real phone looks, not a measure of one. Still, v2 measured about 30% slower than v1 in the same sandbox, and neither
was tested on a 4x-throttled real device. DESIGN.md lists that as undone. Treat "fps on a mid phone" as an open risk. Because of 6 to 9 fps I
could not judge frame-level feel (steering smoothness, hit-stop, trick spin), and headless audio is muted, so sound is not
scored beyond what the code promises. Scores below are about what I could see and do.

## Seven fun tests (0-10)
| Test | v1 | v2 |
|---|---|---|
| 1. 10-second | 5 | 7 |
| 2. Toy | 5 | 6 |
| 3. Almost | 4 | 8 |
| 4. One-more | 6 | 7 |
| 5. Surprise | 3 | 7 |
| 6. Mastery | 2 | 7 |
| 7. Tomorrow | 2 | 7 |
| **Average** | **3.9** | **7.0** |

Reasons, short:
- 10-second: v1 auto-weaves for the first seconds, then the race starts only after a tap; the first "event" is a pass or a pad. v2 gets coins pinging, flow popups and "OVERTAKE!" inside the first 5 to 8 s of a run, plus the goal strip ("3 stars = 1st + flow 4") on screen at once.
- Toy: steering a first-person bike with dust and fov kick is pleasant in both. v2 adds coins and chain tones, but at 6 fps I cannot call the toy "great"; a 6.
- Almost: v1 says "Finish top 3 to qualify" and nothing else. v2 says "4TH PLACE, 0.6 s off the podium" and "1st place for 2 stars + flow 7 for 3 stars". That is the best thing in the game.
- One-more: both restart with one tap, no load. v2 shows two buttons (Again / Map) and I had to pick; the win card has a refresh button as well as Next. Fast, but not a reflex thumb-spot.
- Surprise: v1 repeats the same canyon with a portal/wingsuit now and then; L5 looked like L1 with more rocks. v2: L2 rock + trick, L3 logs and a first chest ("New bike: Grape"), L4 coins, L6 jump-then-dodge; a new idea nearly every level.
- Mastery: v1 shows nothing but a level counter. v2 has stars, flow x-levels, best flow, time, a goal per level. I could not show a visible skill gain in 12 min because I lost three times at L6 to my own sloppy steering, but the game explains how to do better.
- Tomorrow: v1 nothing. v2 has the map with a pulsing node, "3 stars to the next chest", "Tomorrow: Daily Descent #2, day 2".

## First 2 minutes, beat by beat

### v1
1. Title card "DUST DESCENT" over the canyon with the bike weaving by itself; five rivals bunched ahead. Nice-looking, low-poly, warm sunset. A pointing hand and "Tap left / right to steer or drag".
2. Tap. "GO!". Dust, the rivals pull away, I am 5th to 6th. Bike steers one lane per tap.
3. A blue pad, then a portal (wingsuit) appears. The wingsuit section is the one real spectacle, with "TAKE THE LEAD!".
4. Finish 1st at about 12 s on pure random tapping. "CLEARED!" with "1st place, 555 pts". The card text sits over the leaderboard bars.
5. Tap, L2. Same canyon. I finish 4th ("Finish top 3 to qualify"), retry, 4th again, then 3rd and on to L3.
6. By minute 2 I know everything the game will ever show me. Nothing is collected, nothing accumulates.

### v2
1. Same title shot, plus a coin counter (0). Tap.
2. "LEVEL 1, FIRST RUN: Only pads and kickers: win it, loudly. 3 stars = 1st + flow 4." Start 6th.
3. Lanes of pads and coin lines; "FLOW x1, 2/4" bar fills, coins tick up (3, then 14), "OVERTAKE!" pop-ups, rank goes 6th, 3rd, 1st.
4. Win card at 21.9 s: "1ST PLACE!", three stars, coins, best flow x4, "3 stars to the next chest", "Tomorrow: Daily Descent #2, day 2", green Next button.
5. Straight into L2 "TRICK SHOT: First rock; tap in the air for a trick" (no map between levels, good).
6. L3 "Log Jam" at about 1:40: 2nd, two stars, "1st place for 2 stars + flow 7 for 3 stars", chest opens: "New bike: Grape". First-session reward lands before minute 2.5.

## Not-so-nice things I hit
- v1 and v2 share the same grey rank panel (left) which covers a quarter of the view and the card text overlaps it in v1.
- v2 L6 beat a casual player three times: ok as a wall, but the lose card's tip ("Tap in the air off a kicker") is the same each time.
- The first v2 screen is a title card over an empty road, with the 6 rivals missing: it looks like v1 minus the demo.
- v2 flow is 0 most of the time for a loose steerer (chain popped between 1 and 3). The chain is invisible until you are already good.

## What the best app-store game in this genre does in its first 2 minutes that this one still doesn't
The best downhill/racer in the store (the kind with a bike or board, a chest and a car garage) makes the player feel fast and
powerful in 10 s with a big, loud, scripted moment: a huge jump over the whole field with slow-mo, a camera swing and a rival
you can SEE and name that you chase for the whole level. It also lets you see the bike getting better: the garage opens at minute 1,
there is a visible upgrade after the first race, a rival is "rival of the day", and every run ends with a count-up of coins,
stars and a progress bar to the next unlock that is nearly full. Ours still has: (1) no scripted
"holy" moment in the first 10 s (the first race is quiet and your rank climbs by itself), (2) trick gameplay that is only told, not shown (no
demo of the tap-in-air trick before L2), (3) the garage / bike colours are a text line, not something you see and ride in
the first 90 s, (4) one named rival and an obvious trophy at the end are missing: 5 anonymous riders in a grey list, (5) at 6 to 9 fps in
software GL, we cannot prove it feels fast on a cheap phone.

## 5 biggest fixes, in order
1. **Prove frame rate on a real mid-range phone profile (4x CPU throttle), and fix it.** At under 30 fps, nothing else here matters. Drop shadow resolution, reduce rider/prop counts, cap pixel ratio at 1.5 and re-measure v2 against v1.
2. **Make the first 10 s of v2 a showpiece:** place a guaranteed big kicker with a rival right next to you at s=30 m, with slow-mo, a camera roll and a "PERFECT" ring. Show the trick tap with a ghost hand once on L2.
3. **Give the player one named rival per world** (Kestrel/Mako/Rook as a banner, a portrait, a win/lose line) and show the gap to them live ("Kestrel +0.4 s"), instead of a grey list.
4. **Show the garage and chest early and physically:** after L1 show the bike, the next chest bar nearly full (the 9/10 effect); put the new bike under the player in the next level so reward is seen, not read.
5. **Soften and explain L6 and the fail loop:** vary the lose-card tip by cause (hit log, missed kicker, slow flow), put Again where the thumb already is (centre bottom), and make the Again button the only big one; adaptive help after 2 losses (slower rivals, a hint arrow to the best lane).

Verdict: TEST
