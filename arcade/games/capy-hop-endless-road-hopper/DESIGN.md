# Capy Hop — deep v2 plan (studio lane 33, 2026-10-31)

Same game: a calm voxel capybara hops across roads, rivers and rail tracks, camera creeping behind. v1 = endless only (v1.js, untouched).

## Five layers today (v1) → v2
| Layer | v1 | v2 |
|---|---|---|
| Core verb | 1 (tap = hop, swipe = side; little skill ceiling) | 2: same verb, plus oranges on risky squares and a par time = skill ceiling |
| Core loop | 1 (run until you die) | 2: a crossing with a flag (30-90 s), 3 stars, near-miss "SO CLOSE: 1 row", rescue |
| Level design | 0 (random rows) | 3 authored: 30 crossings in 3 worlds, purpose line each, boss at 10/20/30 (levels.js) |
| Meta | 1 (best score) | 3: map + stars → 7 hats, rescues, daily dash + streak, endless kept on the map |
| Feel | 2 (voxel, bursts, tones) | 2 → target 3 (juice pass pending) |

## Mechanic plan
W1 Sunny Streets: cars → trucks → trees (sidestep) → roadside oranges → lane-speed mixes → boss "Main Street".
W2 Lazy River: logs → lily pads (pad paths) → logs after roads → fast water → drift edge → boss "Great River".
W3 Rail Yard: trains with a bell (period/phase authored) → rail + road → rails with logs → fast everything → boss "Grand Central".
Row tokens in levels.js: G grass (trees), C cars, T trucks, W logs, P pads, X rail, `*x` orange.

## Stars
1 = reach the flag · 2 = every orange · 3 = under the par time. Par = rows*0.85+5 s (author override `par`).
Rescue: respawn on the last grass row you stood on (start 2; +1 every 5th first-clear, +1 first daily each day).
Hats: Cap 3 stars, Shades 8, Flowers 15, Top hat 25, Party 38, Crown 52, Halo 70 (max 90).

## Tomorrow hook
Daily Dash (generated crossing from the date seed, same for everyone) with a medal, a rescue and a day streak; the result card and map say "Tomorrow: Daily Dash #N · day K".

## Board
Only Endless submits to the world board (same score meaning as v1: furthest row). Level and daily modes never post. `flow.k()` is used only by Endless (unchanged); levels use authored fixed speeds.

## QA
qa/solve.cjs <port> 1-30: fast-forward bot (window.__game.sim) clears every level (it already found 3 unreachable pad paths). qa/shot.cjs: phone screenshots.

## Status (cycle 1, 2026-10-31 ~20:55Z)
v2 BUILT behind READY=false (game.js; ?deep=1 forces). All 30 bot-clear, phone shots ok, no console errors.
Left: lengthen levels 2-9 / 12-19 / 22-29 (10-16 rows now ≈ 15 s; target 20-25 rows ≈ 30-45 s); fresh replay as a new player; critic;
juice (near-miss hit-stop, star pop, rail bell cue, flag cheer); fps at 4x throttle; desktop shot; hat look check; rescue and daily playthrough; ticket.

## Cycle 2 (lane 33)
Levels 2-9 of each world now run twice (first half, rest row, mirrored second half; levels.js `mirror`): 16-30 rows each. All 30 bot-clear, no console errors. Critic not run (load 45+).
deep v2: shipped 2026-11-01 (TEST)
