# Dust Descent — DESIGN (deep v2 plan, lane 37, 2026-11-01)

**What it is:** first-person downhill mountain-bike race down a canyon trail against 5 rivals. Drag or tap left/right to steer; blue pads
boost, wooden kickers launch, rocks and logs crash you. Same name, same 3D look, same verb. v1 is untouched in `v1.js`.

## Five layers today (v1, 0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 1 | steer only; pads and kickers are hit or missed, no timing/skill beyond lane choice |
| Core loop | 1 | ~20 s race, top 3 to clear; no tension inside (nothing to decide but a lane) |
| Level design | 0 | seeded random trail, level 12 = level 2 with more rocks |
| Meta | 0 | level counter + board "Levels cleared" |
| Feel | 2 | good first-person camera, dust, boost fov kick; no combo, no escalation, flat results card |

## v2 plan
**Verb with skill:** steer to line up pads and kickers (PERFECT LAUNCH at the kicker's centre); TAP IN THE AIR for a trick (a short window
after take-off; landing it gives a full boost); thread a rock/log with a hair to spare for CLOSE!; grab coin lines (arcs in the air
over kickers, rings during the wingsuit).
**Round (20-35 s):** read the trail ahead → pick the lane that chains pads/tricks/coins and dodges hazards → FLOW chain (x1..x5 multiplier,
2.6 s window) → 8 in a row = FEVER (5 s of boost). A crash breaks the flow. Finish top 3.
**Stars:** 1 = 3rd, 2 = 2nd (or 1st without the flow goal), 3 = 1st **and** the level's flow goal (`goal` in levels.js).
**Mechanics, in order:** 1 pads + kickers (L1, cannot fail) · 2 rocks, tricks (L2) · 3 logs, first possible loss (L3) · 4 coin lines (L4) ·
5 slalom (L5) · 6 jump-then-dodge (L6) · 7 gate gaps + bumping rivals (L7) · 8 wingsuit portal + ring coins (L8) · 9 hard mix · 10 BOSS Kestrel.
W2 Pine Gorge: mud (L11 alone, L12 pads in mud, L13 mud+rocks, kickers out of mud, wingsuit, trick alley) · BOSS Mako (L20).
W3 Frostbite Pass: ice (steering is a third as sharp while sliding: line up BEFORE it; L21 alone, L22 pads on ice, L23 rocks after ice,
L24 ice into mud) · gauntlet, ice slalom, whiteout · BOSS Rook (L30). Breathers at L16 and L26 (big air, coins, low rivals).
**Worlds:** Red Mesa (v1's canyon look) · Pine Gorge (green dusk, tan trail) · Frostbite Pass (icy blue, snowy pines). Own sky, fog, trail art.
**Levels:** `levels.js`, 30 hand-picked sequences of hand-drawn 40 m trail segments (SEG) + rival speed + flow goal + purpose line; the
trail's curve/slope comes from the level number. Daily Descent: a seeded sequence from the same segments (same for everyone each day).
**Meta:** level map with 3 worlds, stars, pulsing next node, red outline on hard levels, crown on bosses · a chest every 6 stars = a new bike
colour (12 in the Garage, 8% jackpot = 2) · Daily Descent with a daily gift (first podium each day opens a bike colour) and a day streak.
**Tomorrow hook:** win/lose cards and the map say "Tomorrow: Daily Descent #N · 🔥 day D"; the daily trail and its gift are real.
**Feel list:** hit-stop + slow-mo on crash, FEVER, finish; rising pitch chain tones; trick spin (camera roll), landing dust, shake, fov kicks;
coin pings with rising pitch; popups on every event; instant retry (same trail is not rebuilt).
**Board score:** unchanged meaning ("Levels cleared": +1 on the first clear of a level only).
**Fairness:** rival speed uses the tuner's `flow.k()` at half strength exactly as v1; difficulty is per level, never per device/money.

## Build status (2026-11-01, cycle 1)
Built, READY false (`?deep=1` forces v2): `deep.js`, `levels.js`, `v1.js`. QA: `tools37/sim.cjs` runs every level headless with a bot
(aims at pads, dodges, mud-aware, tricks), a never-steering idle bot and a dodge-only bot (`__game.run(n, kind)`). Bot clears 29/30 in
the top 3 (L27 4th), idle fails from L3, dodge-only sits 2nd-4th. Left: fresh replay as a new player, critic gate (FUN_REVIEW.md), 4x CPU fps,
desktop shots, ticket. deep v2: in progress
