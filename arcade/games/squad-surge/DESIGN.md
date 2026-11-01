# Squad Surge — DESIGN (deep v2, lane 57)

Game: sprint down a sky track, sweep up idle buddies into a yellow squad, dodge saws/spinners/pads/posts, crash into the rival
gang, topple the boss. Same name, same idea, same chunky faceless art. v2 keeps all of it and adds the layers around it.

## Five layers today (v1) → v2   (score 0-3)
| Layer | v1 | v2 plan |
|---|---|---|
| Core verb | 1 (steer left/right; no skill beyond avoiding) | 2: gate maths (pick the lane that grows the squad), cages need a big enough squad, dodge the red ring |
| Core loop | 1 (random rows, boss = wait) | 3: every 13-unit row asks one decision; the boss fight has a verb (dodge the ring / lose front line) |
| Level design | 0 (procedural seeded) | 3: 36 authored tracks, `why` line each, hard/breather sawtooth, 3 worlds |
| Meta | 0 | 3: world map, stars (survivors vs par), squad colours by stars, Daily Surge + streak |
| Feel | 2 | 3: gate pops, FREE! cage, DODGED!, ring telegraph, flawless line, rainbow squad |

## Mechanic plan (in order)
W1 Sky Park (1-12): recruit → saw → +/× gates → posts → red gates → spinner → rival patrol → club boss.
W2 Pink Pier (13-24): spike pads → cages (need N buddies) → halving gate ÷2 → slam boss (red ring: drag away).
W3 Castle Rush (25-36): twin boss (ring + club), tight lanes, patrol gauntlets, everything at once, Castle King.

## Meta
Stars: 1 = captured, 2 = survivors ≥ par[0], 3 = survivors ≥ par[1]. Hard clear first time +1 bonus. Every 6-14 stars a squad
colour (Cherry, Mint, Grape, Ink, Rainbow). Daily Surge (seeded by date) = +3 stars once a day, streak counted; win/lose cards and
map say "Tomorrow: a new Daily Surge · N-day streak". Level frontier saved (`squadsurge2` store).

## Fairness / board
Board score unchanged (levels cleared, sum). Difficulty numbers: gate/cage/enemy counts are authored; `flow.k()` still scales
saw/spinner speeds and enemy counts as in v1 (not touched).

## Build state
Switch: `READY && ab('deep-squad-surge')` (READY false until the fun gate passes). `?deep=1` forces v2 for QA.

## Status 2026-11-01 (lane 86)
Bot run (G.bot, ?deep=1, levels 1-21): wins all but 7, 10, 12, 18, 20 (hard/boss, maybe bot weakness: check by hand). Bot survivors beat par[1] on 1-5, 13-15, 19 so pars are too low there: recalibrate. No page errors. READY false. Not yet critic-reviewed (load 55).
Left: levels 22-36 bot run, hand-check 7/10/12/18/20, recalibrate pars, replay fresh, critic at load<24, READY true, ticket.

deep v2: shipped 2026-11-01 as TEST (critic r5 7.3 vs 4.0). Golden buddy, boss chest every 3rd new track, x3 gate on track 1.
