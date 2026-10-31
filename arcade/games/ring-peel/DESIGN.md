# Ring Peel — deep v2 plan (studio lane 25, 2026-10-31)

Data: ring-peel was the 9th most played game in the last 7 days (73 visits). v1 has no levels (seeded generator), no meta, a
loss throws away the whole pier. Same game: hold to pour iron balls down the pier, every ball that reaches the tower peels its
bottom ring, one ball into a guard wall ends the try. Same name, same pastel 3D pier art, same hold-to-fire verb.

## Five layers (v1 → v2)
| Layer | v1 | v2 |
|---|---|---|
| Core verb | 2 | 3 — hold/release timing through moving gaps; skill = longer bursts, tighter gaps, "CLOSE!" grazes pay + fill FEVER |
| Core loop | 1 | 3 — 2-4 towers per pier, a crash restarts only the tower you were on (walls get 10% kinder per crash, max 2), loss card names the cause + "SO CLOSE · n left", one-tap AGAIN |
| Level design | 0 | 3 — 30 authored piers (levels.js, purpose line each), 3 worlds, new element every 5 piers, HARD pier every 10 (red frame) |
| Meta | 0 | 3 — pier map with stars, 6 ball skins unlocked by stars (5/12/22/34/48), 3 daily goals (+1 star each), endless docks after 30 |
| Feel | 2 | 3 — hit-stop + slow-mo on tower down, camera punch on hits, graze spark, FEVER (ghost walls, double fire rate, vignette), BOOM bombs, gold shower, floaty numbers, streak notes |

## Mechanic plan
- World 1 Harbor Pier (1-10): spin wall (1-3), swing wall (4), hex towers (5), two walls (6), counter-spin (7), square towers (8), long pier (9), HARD Harbor Master (10). Pier 1 teaches with a bomb ring + gold ring and nothing to dodge in tower 1; the first wall bump on pier 1 is forgiven.
- World 2 Sunset Reef (11-20): armored steel rings (2 hits, first one cracks) (11-12), bomb chains breather (13), gold-ring hunt (14), blinking shutter that flashes red before it shuts (15-17), reef trio (18), long reef (19), HARD Reef Boss (20).
- World 3 Storm Dock (21-30): gate ring = a wall all round with one gap (21, 23-26, 28-30), surging wall (22, 27), bomb storm breather (26), HARD Storm King (30).
- Rings: normal (striped), gold (+5, fever +20%, 1 in 2.5 towers also gets a random "lucky" gold from pier 4), armor (grey, 2 hits), bomb (red, takes 3 more rings, BOOM).
- After pier 30: seeded endless docks from the Storm Dock elements.

## Stars and par
3★ = no crash and under par (par = 1.5 × the safe-shooting bot's time + 3 s per tower, computed in gmath.js `parOf`), 2★ = at most one crash, 1★ = cleared. Live chip (top-left) shows the stars you can still get and the seconds left to par.
Board meaning unchanged: "levels cleared" (limits unchanged), submitted on the first clear of a pier only.

## FEVER
Bar fills +1/40 per ring, +20% gold, +8% per graze, resets 60% on a crash. Full = 4 s: balls fly through ghost walls, fire rate ×1.8, score ×2, pink vignette, cannon glows.

## Fairness
flow.k() is used exactly like v1 (clamped 0.9-1.25 on wall width and speed); the tuner is untouched. The crash-kindness is for everyone. No money, no ads.

## Files
levels.js (30 piers), gmath.js (wall maths shared with qa/calib.mjs, bot par), deep.js (game), v1.js (untouched old game), game.js (switch, READY false until the fun gate passes), qa/ (calib.mjs offline difficulty, par.mjs, playall.cjs bot through the real game, shots.cjs phone screenshots).

deep v2: shipped 2026-10-31 (TEST, critic ran at ~5 fps: re-judge at real speed)
