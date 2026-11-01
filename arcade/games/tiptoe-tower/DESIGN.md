# Tiptoe Tower — deep v2 design

Status: v2 built behind READY=false (?deep=1 for QA). Not shipped.

## Numbers (7 days to 2026-10-29): 95 visits (queue rank 6). v1: endless generated levels, same shoes/walls/rails/podium.

## Layer scores (v1 → v2 target)
verb 2 (drag, steer between shoes/walls) → 3 · loop 2 → 3 · levels 1 (generated) → 3 (36 authored) · meta 0 → 3 (map, stars, closet, heel jar) · feel 2 → 3

## Mechanic plan (3 worlds × 12 levels)
- World 1 Rooftop Runway: shoes, gems, brick walls (full and lane), rails (splits), golden shoe (+3), spend-to-win choice.
- World 2 Neon Boulevard: +N / -N / ×N gates, snip bars (laser cuts the stack), double-or-bank choices.
- World 3 Starlight Skyline: sliding walls (timing), everything combined, 10 walls / 10 rails.
- Sawtooth: HARD levels at 10, 12, 21, 24, 32, 36, each followed by a breather (Victory Lap, Neon Cruise, Moonwalk).
- Each level has a purpose line in levels.js (`p`). Levels 1-3 per the first-3 rule (1 can't be lost, 3 first loss).

## Meta
Level map with world tabs and stars per level; closet of looks unlocked by total stars; gem jar fills from podium points and
opens a random heel style (10); star steps on the podium (★ = reach podium, ★★/★★★ = climb to solver-derived steps);
encore levels after 36 from the generator.

## Feel
Combo pops, PERFECT column bonus → RUNWAY FEVER, gate/snip/golden bursts, hit-stop + shake, near-miss lines ("1 short!").

## Validation
qa/levels.mjs: solver clears all 36 (sets star steps). qa/playall.cjs: bot plays all 36 in the real game.
Board score meaning unchanged (levels cleared, sum). 
