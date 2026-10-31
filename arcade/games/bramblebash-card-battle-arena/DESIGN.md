# Bramblebash deep v2 (lane 35, started 2026-10-31)

Real-time 1v1 card duel (Sap, 3-min clock, 2 towers + Hearth). Strong core verb (drag a critter, timing + counters); v1 had no
campaign: Easy/Normal/Hard against a random CPU deck, one unlock per win.

## Five layers (0-3)
| Layer | v1 | v2 plan |
|---|---|---|
| Core verb | 3 | unchanged (drag/tap cards, 15 cards, counters) |
| Core loop | 2 | per-duel goals (3 stars), clear loss reason ("SO CLOSE", Hearth %) |
| Level design | 0 | 30 authored duels (campaign.js): opponent, deck, twist, purpose line, 3 worlds, bosses at 10/20/30 |
| Meta | 1 | map with stars, card unlocks at set levels, sticker per 9 stars, daily streak + tomorrow hook |
| Feel | 2 | acorn / puddle / hive set pieces, star pop, result card with next-duel button (no dead time) |

## Mechanic plan
- World 1 Mossy Meadow (1-10): drop, lanes, spells (L3), fliers (L4), golden acorn (L5), brute (L6), cannon (L8), boss L10.
- World 2 Bramble Woods (11-20): honey puddles (L11), enemy hive bees (L13), badger (L16), double flow (L17), boss L20.
- World 3 Thornpeak (21-30): short clocks, set decks (L22/23/29), tower down start (L26), bosses, final L30.
Twists in game.js `twists()`: acorn, honey, hive, storm; mods fixed/noleft/boss in startMatch.
Stars: 1 win, 2 lose no tower, 3 per level (Hearth down, or win under N s).
First 3 levels: CPU waits 25/15/12 s, half-health towers, 10/8/7 sap, forced first hand, coach chip; L1 wins in about a minute.
Kind assist: after 2 straight losses on a level the CPU thinks 10%/loss slower (max 30%).
Board score unchanged (wins vs CPU; hard-level wins count 2).

## Status
deep v2: in progress (READY false; ?deep=1 forces it). Left: bot all 30, critic, tuning.
