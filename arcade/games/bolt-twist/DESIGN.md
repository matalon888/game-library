# Bolt Twist — deep v2 plan (studio lane 25, 2026-10-29)

Data: no DB on the AWS studio server, so no numbers this cycle (PLAYBOOK: bolt puzzles already hold best here, 85-116 s median).
Same game: tap coloured bolts out of a 3D toy, they fly to boxes of their colour (3 per box) or park in the tray; plates fall when
bare; spin the toy by dragging; a full tray loses. Same name, same art style, same core idea.

## Five layers (v1 → v2)
| Layer | v1 | v2 |
|---|---|---|
| Core verb | 2 | 3 — park-or-match decision has a skill ceiling: stars are earned by parking little (par = fewest parks a careful player can reach) |
| Core loop | 2 | 3 — goal in a picture (boxes), pressure = tray, a decision every tap, near-miss line ("SO CLOSE · 2 left"), live ★ chip drops as you park |
| Level design | 0 | 3 — 30 hand-drawn toys (levels.js, purpose line each), 14 plate templates, baked colours checked by qa/verify.mjs + qa/playall.cjs |
| Meta | 0 | 2-3 — toy map with stars and stickers (30), bolt paints (6) unlocked by stars, bonus toys after 30 |
| Feel | 2 | 3 — streak ladder (HOT STREAK / FEVER / UNSTOPPABLE with flash, confetti, rising notes), key/lock/thaw pops, animated star reveal |

## Mechanic plan (3 worlds × 10)
- **World 1 Toy Shop** (1-10): tap/match (1), layers (2), spin to the other side (3), parking (4), small tray of 4 (5), scissors, rungs/rails (6-9), HARD window toy (10).
- **World 2 Workshop** (11-20): gold-ring bolt = key, padlocked bolt waits for it (🔑/🔒 on matching ring tints); keys on other sides, keys behind plates, 2-4 locks, three open boxes; HARD locksmith (20).
- **World 3 Factory** (21-30): ice bolts: the number is how many bolts must leave before the ice thaws; ice + keys together, 4-slot tray, up to 8 colours; HARD big machine (30).
- Difficulty is a sawtooth: each world ends in a HARD toy (casual player ~40-55% win), then a breather.

## Level rules
Toy = theme (crate/house/robot/gift/rocket/castle) + one hand-drawn plate template per face + knobs (colours, open boxes K, tray T, tangle, keys, ice).
Colours are searched once offline so a casual player wins about `target`% of the time (levels.js), then frozen in bake.js (qa/bake.mjs):
everyone sees the same toy (fairness), instant on a phone. flow.k() is not used on authored toys; the in-round adapter (adaptQueue / rescue) is unchanged from v1.
After toy 30: the Factory toys return with fresh colours (generated on the spot).

## Stars
3★ parks ≤ par (+1 on toys with 18+ bolts), 2★ ≤ par+3, 1★ cleared. Board meaning unchanged: "levels cleared" counts first clears only (replays do not add).

## Meta
- Map (🗺️): 3 worlds, 5×2 nodes each, next one pulses, cleared nodes show the toy's sticker + ★, HARD nodes red-framed.
- Paints (6, at 0/3/8/14/22/32 ★): Classic, Candy, Chrome, Pastel, Neon, Midnight — tap one in the map to equip.
- Result card: stars one by one, new sticker, paint unlocked, streak, "paint at N★" (next thing in sight), next / replay / map.

## Files
levels.js (30 toys), blogic.js (rules, builder, greedy solver, casual sim), bake.js (frozen colours), deep.js (game), v1.js (untouched old game), qa/.
Switch in game.js: READY false until the fun gate passes.
