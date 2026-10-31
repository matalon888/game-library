# Neon Hop: deep v2 design

deep v2: in progress (built 2026-10-31 lane 83, READY false; fun gate not run yet)

## What it is
A glowing ball hops tile to tile on every note of a public-domain or original song. Hold and drag to steer; land centre = PERFECT.

## The five layers (0-3), v1 -> v2
| Layer | v1 | v2 | Note |
|---|---|---|---|
| Core verb | 2 | 3 | Drag to steer already had a skill ceiling (centre landing). Added streak chimes that climb in pitch, FEVER (8 perfects in a row: ×2 score for 8 tiles, FOV kick, flash). |
| Core loop | 1 | 3 | v1: 11 songs looped with a longer length each level. v2: each level 18-40 s, one idea, stars for % perfect, near-miss line on a loss ("3 tiles from the end!"), retry is one tap with a 1 s count-in. |
| Level design | 1 | 3 | 36 authored levels (`levels.js`, `why` line each), 3 worlds × 12, sawtooth: teach, practise, twist, HARD, breather. Remix levels after 36. |
| Meta | 0 | 3 | World map with stars, 12 collectible balls unlocked by total stars, gem chest every 30 gems (random new trail of 6), Daily Jam streak. |
| Feel | 2 | 3 | See feel list. |

No play data was available on the studio server for this cycle (no DB); numbers to be read by the Mac side when the test is registered.

## Mechanic plan (in order)
1. Giant tiles, middle only (L1, cannot be lost)  2. gems  3. normal tiles with real misses  4. zig-zag  5. waltz (3/4) and fast galop timing
6. sliding tiles (W2)  7. narrow tiles  8. ice (steering slides)  9. forks (W3: two tiles on a beat, the gem sits on the far one)  10. all together.

## Worlds
Glow Streets (1-12): steer onto every tile. Drift Lane (13-24): sliding, slim, slippery. Storm Deck (25-36): forks plus everything.
HARD levels: 11, 22, 34, 35, 36 (red frame and badge). Breathers: 12, 23.

## First 3 levels
L1 (Twinkle, 20 s): tiles twice normal width, within ±0.8 of the middle: cannot be lost, always 3 stars, a ball unlocks at once.
L2 (Ode): gems appear. L3 (Neon): first level with real misses.

## Stars
1 = cleared, 2 = 45% perfect, 3 = 75% perfect. Perfect radius shrinks with tile width (0.26·√w).

## Meta and tomorrow hook
Balls (12) by total stars 0/3/6/10/15/21/28/36/45/55/66/80. Gem chest every 30 gems opens a random unowned trail (6, one rainbow).
Daily Jam: a daily song with a daily toy (slide, ice, fork, zig, slim), same for everyone that day; first clear each day +10 gems and day streak.
The map and result card say what waits tomorrow: "Tomorrow: Daily Jam “<song>” · keep your N-day streak".

## Feel list
Streak chime pitch climbs; pops GROOVE (5), FEVER (8), ON FIRE (12), UNREAL (16), LEGEND (24); bigger particle bursts with combo; FOV kick on perfects;
beat pulse boosted in fever; star-pop animation on the result card; confetti bursts; haptics.

## Fairness
Difficulty numbers (gap and step width) still multiplied by `flow.k()`; no change to the tuner. Board still submits "levels cleared" (+1 per win); limits unchanged.
v1 save keys untouched; v2 uses `neonhop_d*` keys.

## Switch
`READY` in game.js is false: v2 only at `?deep=1`. Set READY true when the fun gate passes (FUN_REVIEW.md).

## Left to do
Fun gate (critic run in a later cycle), then fix its findings; level QA in `qa/levels-run.txt`.
