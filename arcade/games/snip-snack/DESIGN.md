# Snip Snack: design

deep v2: in progress (studio lane 35, started 2026-11-01). READY=false in game.js until the fun gate passes.

## What it is
Pip, a sleepy hedgehog, naps on a pillow. A candy hangs on strings inside a cardboard box. Swipe or tap a string to snip it, grab
the stars on the way down, drop the candy into Pip's mouth. Same game in v2: same box, same Pip, same strings.

## Numbers (db copy, 2026-10-22 … 11-01)
19 game visits logged for the slug in the window: too few for a distribution; ranks 20th of the arcade. v1 is endless generated
levels (seeded, solvable by construction), no stars kept, no map, no reason to return.

## The five layers in v1 (0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 2 | Snip timing is real skill (swing phase decides the landing), order of strings matters from level 4. |
| Core loop | 2 | One level = 15-40 s, a decision per string, near-miss loss ("Pip is still hungry"). |
| Level design | 1 | Procedural; the generator adds a string or a bubble but nothing is taught, no hazards, no variety of shape. |
| Meta | 0 | A level counter and a star total. Nothing to collect. |
| Feel | 2 | Snip sparks, star pitches, chomp + confetti; nothing escalates, no lose juice. |

## Verb and skill ceiling
Same verb. The skill ceiling is the 3 stars: they float on the swing arc and on the fall of the author's own solution, so a
sloppy snip feeds Pip but collects fewer. A tolerance number per level (how many 1/120 s steps the snip may slip and still feed
Pip) is measured by the tuner and sets the difficulty by design: 0.2 s on level 1, ~0.1 s on the HARD levels.

## The round
Goal by picture (Pip + stars), pressure (the swing never stops; strings you leave tie the candy down), a decision every 2-4 s
(which string, when, pop now or ride higher), a loss that says why (SO CLOSE / OUCH spikes) with a one-tap retry, a win with 1-3
stars, a chest meter and tomorrow's Daily Dessert.

## Mechanic plan (in order)
1. Strings + stars (1-4): one string, swing timing, two strings (either order), order matters.
2. Bubble (5, 6, 9): lifts the candy, tap it to pop.
3. Speed (8): two snips a heartbeat apart (one swipe through both = DOUBLE SNIP).
4. Air cushion (11, 12): tap to puff the candy sideways.
5. Spikes (13, 14 …): the wrong order drops the candy on them (decoy spikes sit where each wrong order lands).
6. Sliding pins (21 …): a pin rides a rail, so the swing keeps changing.

## Worlds (30 hand-built levels, `levels.js`, a purpose line on each; HARD at 10, 20, 30; breathers at 17 and 26)
- Pantry Shelf 1-10: strings, stars, bubbles. Toy Box 11-20: puffs and spikes. The Attic 21-30: sliding pins, everything together.
- After 30: the v1 generated levels carry on (bonus), plus the Daily Dessert.
- First three: L1 one string, the whole window feeds Pip (Pip's mouth is wider); L2 swing timing; L3 two strings, either order.

Levels are authored as setups (candy, pins, hazards, bubble, cushion) plus the author's own cuts; `resolve.js` simulates the cuts
with the real physics to find where Pip sleeps and where the stars float. `qa/tools/tune.mjs` searched the first-cut time so the
tolerance and the landing fit the intended difficulty, and `qa/tools/probe.mjs` checks every level: the solution wins, the wrong
orders are listed (and get spikes where a spike level calls for it).

## Meta
- Level map (3 worlds, stars under every level, HARD red, next level pulsing).
- Stars → chests: every 7 stars a chest opens a random candy for the jar (8 candies: ruby, mint, grape, sunny, sky, cola, rainbow,
  gold). The candy you pick is the candy you play with.
- Tomorrow hook: Daily Dessert (a different bonus level every day, same for everybody; first clear of the day pays +3 stars, a
  streak counts days). Win/lose cards and the map say what waits tomorrow.

## Feel list
Snip sparks (v1), DOUBLE SNIP, star pitch ladder, PERFECT BITE (3 stars: slow-mo + extra confetti), spike OUCH (burst, shake, red),
SO CLOSE on near misses, chest shake and reveal, stars pop on the win card one by one.

## Fairness / board
Board score stays "stars per level" (0-3, same scale as v1). The in-round adapter, tuner and flow are untouched; authored levels do
not depend on `flow.k()`; the first levels widen Pip's mouth the same way for everyone.

deep v2: shipped 2026-11-01 (TEST, critic 7.0 vs v1 3.1)
