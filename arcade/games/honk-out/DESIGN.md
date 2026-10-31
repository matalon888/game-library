# Honk Out!: deep v2 plan (studio lane 33, 2026-10-31)

deep v2: in progress (READY false in game.js; fun gate not run yet). No DB on the AWS studio server, so the numbers below are from the Mac db copy
read earlier: honk-out was the most played unclaimed game (25 visitors in 7 days).

Same game: tap a car/van/bus to drive it out of a jammed lot into one of the parking spots; riders in the line board vehicles of their colour; a full
vehicle leaves; spots full of the wrong colours = jam. Same name, same 3D toy-town art, same core idea (v1.js is untouched).

## Five layers (v1 -> v2, 0-3)
| Layer | v1 | v2 |
|---|---|---|
| Core verb | 2 | 3: order is the skill (which car, when); stars reward using few spots and no bumps |
| Core loop | 2 | 3: goal = the line (seen), pressure = spots, a decision per tap, "waiting for <colour>" jam card, live star chip |
| Level design | 1 | 3: 30 hand-drawn lots (levels.js, a purpose line each), queues frozen by qa/bake.mjs, casual win rate checked per level |
| Meta | 0 | 3: town map (30 stickers), stars -> 4 paints, hops, daily rush + streak medal |
| Feel | 2 | 3: convoy/fever streaks (louder every step), golden rider, wake pops, star reveal, instant retry |

## Mechanic plan (3 worlds x 10)
- World 1 Sunny Lot (1-10): cars (1-3), vans carry 6 (4), stacks (5), buses carry 10 (6), chains (7), taxi that leaves by whichever end is clear (8-9), HARD 10.
- World 2 Rush Hour (11-20): sleepy cars (badge = cars that must leave first, 11-15), rainbow bus takes whoever is next (16-18), breather 19, HARD 20.
- World 3 Harbour Night (21-30): only 4 spots, all the toys together, breather 28, 29 everything, HARD 30.
- After 30: bonus lots from the v1 generator at a fixed size (never the tuner: authored/bonus lots do not use flow.k()).
- First three lots: 1 = three free cars, cannot fail; 2 = one car blocks another; 3 = the first lot you can lose.

## Stars
cost = max(0, peak spots in use - par) + bumps + 2 x hops. 3 stars cost <= 2, 2 stars <= 4, else 1 (lots 1-2 always 3: first win is loud).
par = lowest peak a greedy player reaches (qa/bake.mjs). Board meaning: "levels cleared" counts first clears + the daily.

## Meta and the tomorrow hook
- Map (top right): 3 worlds x 10 lots, stars, HARD frames, next pulsing; paints (Classic, Candy 6, Neon 15, Night 27 stars).
- Town stickers: one per lot first clear (30). Hops (rewinds the first 3 riders to the back): 2 at start, +1 per first 3-star, golden rider, daily.
- Daily Rush: a generated lot, same for everyone today; medal + hop; streak of days played; every win/lose card and the map say
  "Tomorrow: Daily Rush #N . day S".

## Files
deep.js (game), levels.js, blogic.js (parse, greedy solver, casual player, generator), bake.js (frozen queues + par), v1.js (old game), qa/.
qa/bake.mjs (node, writes bake.js), qa/playall.cjs (bot plays every lot in a browser: all 30 won on 2026-10-31), qa/shot.cjs, qa/ui.cjs.

## Left before shipping
Fun gate (separate critic, a LATER cycle: PLAYBOOK 0), then fix lowest scores; likely: lots 3-6 may be too easy for a casual player (bake shows
casual win rate 90-100%), more surprises in world 1, sound/juice check at 30 fps on a throttled CPU, phone + desktop screenshots, then READY true + ticket.
