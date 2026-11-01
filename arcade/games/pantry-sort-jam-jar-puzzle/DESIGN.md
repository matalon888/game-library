# Pantry Sort: deep v2 plan (lane 37, 2026-11-01)

deep v2: in progress (READY=false in game.js; `?deep=1` forces it for QA)

## Five layers (v1 → v2), scored 0-3
- Core verb: 2 → 2 (tap jar, tap jar; already clear, with drag-pour)
- Core loop: 1 → 2 (goal = jams on the goal strip, pour chains for combo, par pours with 3 stars; "SO CLOSE: n pours too many" + one-tap "Try for 3 stars")
- Level design: 0 → 3 (v1 was random boards from a seed. v2: 30 hand-made shelves in qa-checked `levels.js`, a purpose line each, boss at 10/20/30, breathers at 6/9/14/18/24/29, hard (1 spare jar) at 8/16/26)
- Meta: 2 → 3 (kept: Nana's larder, stamp album, Daily. New: shelf map with per-level stars, replay any shelf for 3 stars, star chests every 10 stars with a random pick incl. a 1-in-12 golden jar)
- Feel: 2 → 2 (kept v1 juice; new: chain words + shake, seal-melt burst)

## Mechanic plan (3 worlds)
1. Nana's Shelf (1-10): pure pouring. L1 two pours, L2 a ring, L3-5 mixed jars, L6 chain breather, L7-8 five kinds (L8 only one spare jar), L9 ring of five, L10 six jams boss.
2. The Cellar (11-20): wax seals (L = melts after the first jam, LL = after two). Rule in logic.js (`setLocks`, `sealLeft`): nothing in or out until enough jars are finished. Every sealed level has a kind that needs no sealed jar, so there is always a first jam.
3. Market Day (21-30): cloth jars (M): only the top run shows; pieces under it are dark until uncovered. Mixed with seals from L25.

## Numbers (v1, db copy): see lab test deep-pantry-sort once live. Board stays "Stars earned" (sum); only improvements over a level's best add stars, so replays can't inflate it. Limits unchanged (maxRun 3).

## Check
`node qa/check37.mjs` proves every level solvable and counts right; `tools37/ps.cjs` plays levels in a phone browser with the solver bot.
