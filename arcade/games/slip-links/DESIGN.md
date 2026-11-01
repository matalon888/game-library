# Slip Links — deep v2 design (lane 2, 2026-11-01)

Same game: chains knotted over pegs, tap the one lying on top to slip it free, 3 hearts. v1 (v1.js) is untouched; v2 = deep.js + levels.js
(data written by qa/author.mjs: explicit chain control points, removal ranks, pegs).

## Five layers (v1 -> v2, 0-3)
1 core verb 2 -> 2 (read heights, order matters; padlock/spark add decisions) · 2 level design 0 -> 3 (30 authored knots, 3 worlds, purpose line each)
· 3 meta 0 -> 3 (stars, map, chest every 8 stars unlocks chain paints, gold chains, daily knot + streak) · 4 juice 2 -> 2+ (rising arpeggio with combo, x5 flash, shake, gold burst)
· 5 session loop 1 -> 3 (level -> next star, chest bar always visible).

## Mechanic plan
- World 1 Pond (1-10): the core verb only. L1 two chains and a wrong tap is free (hearts dimmed), L2 a tiny choice, L3 first losable, L5 wrapped pegs, L8 hard, L9 breather, L10 boss.
- World 2 Snowfield (11-20): padlock chains (🔒N = N chains must be cleared first; a free-looking chain you may not tap), gold chain (L16, bonus star toward the chest), L15 hard, L19 breather, L20 boss.
- World 3 Shore (21-30): spark chains (fuse starts when the chain becomes free, 10 s down to 6 s; burning costs a heart), spark + lock + gold combos, L30 boss.
- After 30 and in the Daily Knot: generated 5-7 chain boards with elements picked by depth (same for everyone each day).
- Stars: 3 = no heart lost, 2 = one, 1 = cleared. Gold chain = +1 bonus (counts toward chests).
- Meta: chest every 8 ★ (stars + golds) -> next chain paint (8 paints, pick on the map). Daily Knot (+2 ★ once a day, streak). Win card says what waits tomorrow.
- Feel: slip arpeggio climbs with the streak, x5 UNSTOPPABLE flash, screen shake, gold confetti, burn FX, lock/spark tags on chains.
- Fairness: hearts and timers are the same for everyone; authored levels ignore the tuner multiplier; generated ones keep flow.k(). Board score meaning (levels cleared) unchanged.
Deep v2: shipped 2026-11-01 (Verdict TEST, critic 7.3 vs v1 4.3)
