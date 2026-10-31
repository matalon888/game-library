# Slab Up — DESIGN (deep v2)

Status: deep v2: shipped 2026-10-31 as test (Verdict: TEST, v2 7.1 vs v1 4.7). `?deep=1` forces v2 on 127.0.0.1 for QA.

## What it is
One-tap stacker (inspired by the Stack genre, mechanic only). A slab slides over the tower; tap to drop; overhang is sliced
off; a perfect drop keeps the whole slab and climbs a chime scale. Same name, core idea and 3D look in v2.

## Five layers (0-3)
| Layer | v1 | v2 | Note |
|---|---|---|---|
| Core verb | 2 | 3 | tap timing is real skill; v2 adds rhythm modes (sine/burst), rush, ghost, wind, diagonal |
| Core loop | 1 | 3 | v1 = endless until a miss; v2 = a tower with a goal height, a star target (perfects) and a clear "why" on a fail |
| Level design | 0 | 3 | v1 = speed tiers every 20 slabs; v2 = 30 authored towers, a purpose line each (levels.js) |
| Meta | 1 | 3 | v1 = best score; v2 = map, stars, chests every few stars -> 12 palettes, Daily Tower streak |
| Feel | 2 | 3 | chime scale, combo/fever, slab-cut debris, win/lose cards with near-miss line |

## Verb and skill ceiling
Drop on the exact middle. Ceiling: chaining perfects regrows the slab (v1 rule kept), so a perfect run keeps a wide tower.

## Round loop (20-60 s)
Goal slabs (7-20) -> each tap is a decision (wait for the middle vs. drop now) -> win card with 1-3 stars (perfect counts
vs. `par`) or a lose card that says what cut the tower. Retry is instant.

## Mechanic plan (levels.js)
- World 1 Candy Quarry (1-10): the verb (L1-2 cannot fail), cut, sine rhythm, gold (perfect regrows), rush, small base, burst, boss L9, breather L10.
- World 2 Ghost Harbor (11-20): ghost (flickering slab), wind (wobbling path), combos of them, boss L20.
- World 3 Sky Spire (21-30): diagonal slab that cuts two sides, with gold / ghost / sine; HARD L26 and finale L30.
- Rhythm: intro -> practise -> twist -> breather -> HARD boss in each world; first 3 levels of each world are slow and wide.

## Meta
Stars (par per level) on the map; chest every few stars -> 12 palettes (random pick = variable reward); Daily Tower
(date-seeded, streak counts days played, win/lose cards and the map say what waits tomorrow); endless Sky Run after 30.

## Feel list
Chime scale on perfects, fever (rainbow slab) after a streak, cut debris, camera climb, star pop on the win card, near-miss
line ("1 slab short"), instant retry.

## Changed
levels.js (30 + daily + bonus), deep.js (meta, map, cards, palettes), game.js DEEP branches. v1 path untouched without READY+ab.

## Left to do
Fresh hand replay (first 3 levels, hard 9/16/20/26/30 with a noisy human), fps at CPU throttle 4x/6x, desktop shot, critic
(load<24) -> FUN_REVIEW.md, fix lowest test, READY true, ticket.
