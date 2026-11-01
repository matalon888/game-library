# Blubbo: deep v2 design (studio lane 28, 2026-10-29)

Status: deep v2 ready for the real-player test (critic Verdict TEST, 2026-11-01).
No DB on the AWS server, so no player numbers for this game; the plan is from playing v1 (qa/ simulations) and reading its code.

## What it is
Virtual pet: care for Blubbo (feed, wash, bed, closet; needs drop only while you play) and three mini-games (Sky Hop, Snack Catch,
Bubble Pop) for coins. v1: every mini-game is endless and random, lose = "game over", coins buy hats; nothing to finish, no reason to
come back.

## Five layers today (v1) / target
| Layer | v1 | v2 |
|---|---|---|
| Verb | 1 (drag / tap, no skill ceiling) | 2: same verbs; skill = routes through authored waves, golden risk items, combo + fever |
| Loop | 1 (play until 3 hearts are gone) | 2-3: a trip = 15-70 s, 3 goals shown up front, near-miss card ("3 points short"), 1-tap retry |
| Levels | 0 | 3: 30 hand-built trips, 3 worlds, 3 new mechanics per world, boss + breather |
| Meta | 1 (coins -> hats) | 2-3: stars, trip map, a surprise box every 6 stars + a daily box, 14 hats/glasses to collect, rare ones |
| Feel | 2 | 2-3: combo numbers, fever, hit-stop + shake on hits, star pop-in, confetti, gold glow |

## Trip format
Trips are made of hand-written PHRASES (levels.js: `PH`, 7 lanes, rows between `/`); each of the 30 stages lists which phrases play in
which order, plus pace (`gap` frames between rows, `speed`), `goal`, `gold` (3rd-star count) and a one-line purpose.
Three goals per trip (shown on the trip card and as live chips in the HUD): 1 star = reach the goal (hop: the top), 2 stars = clean
(no hit, no fall), 3 stars = collect golden things (trips 1-6 without gold: a streak of 8 / top in N s).

Mechanic plan (a new idea every 1-3 trips):
- World 1 Meadow Pond (1-10): hop pads -> drifting pads -> star pads; catch snacks -> spikes -> golden snacks; pop bubbles -> thorns -> fast golden. Trip 10 boss "Snack Storm".
- World 2 Candy Canyon (11-20): breather; crumbly pads; heavy snacks (x2, fast); big bubbles (2 taps); springs; magnet snack;
  zig-zag bubbles; twists mixing them; trip 20 boss "Bubble King".
- World 3 Cloud Kingdom (21-30): storm clouds; breather; thorn walls; wind; sky buffet; zig-zag + thorns; storm springs; rainy fast
  heavies; pop parade; trip 30 boss "Cloud King's Tower" (88 rows, wind + storms + springs + crumbles).
First 3 trips: trip 1 (hop, wide pads, cannot be lost, ~10 s), trip 2 (catch, a tiny decision), trip 3 (pop). A new player is put into trip 1
straight from the start card.

## Meta
- Trip map (3 worlds, nodes with stars, next trip pulsing, bosses crowned), card with the 3 goals before every trip.
- Stars -> surprise boxes: every 6 stars (+ one daily box): pick 1 of 3 gifts; random new hat/glasses (rare ones flagged), coins if all owned.
- 3 new hats (wizard, halo, cat ears), 1 new glasses (goggles); they can be bought with coins as before or won.
- Coins unchanged: trips pay coins (x1.5 while Blubbo is happy: hunger/clean/fun >= 50). Care loop kept as in v1; sleeping gates trips
  (energy >= 12 to start, -8 per trip).
- Free play (the three v1 endless modes, incl. the daily seed and the "Mini-game points" board) stays in the Playroom tray.
  Board score meaning is unchanged (free play only). Trips do not post to the board.

## Fairness
Trips are authored: same for everyone; no use of flow.k / the tuner; nothing depends on device, money or ads.

## QA
- `qa/simall.cjs <port> 1-30`: a lookahead bot plays every trip through the real step functions (no drawing): all 30 cleared, 3 stars on
  most (boss trips 1-2 stars). `qa/shots.cjs`: phone screenshots of start, trip, result, map, box, closet, playroom.
- Hop has rescue bubbles on falls (lives = 3). Storms: radius 38, sway 22 (earlier 44/38 made the bot unable to pass).
- Left for the next cycle: fresh replay + critic gate, desktop screenshots, fps at 4x CPU throttle, tune what the critic finds.
