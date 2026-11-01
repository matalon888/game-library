# Stretch Dash — design (studio lane 3)

deep v2: in progress (started 2026-10-29, lane 3)

## What it is
A jelly runner that steers through gates (taller / wider / shorter / thinner). Beams slice off what is too tall, walls
squeeze what is too wide or crush what misses the hole. The body you keep is spent on the rainbow multiplier stairs:
the step you run out on multiplies the gems collected.

## The numbers (diag_events type 'game', 2026-10-22..29, 116 visits)
- Median time per visit 36 s (p75 82 s, p90 205 s); 11% reach 3 min.
- Quit under 15 s: 23% (27/116).
- Ended by jumping to another game ("next"): 63%. Closed: 36%.
- Back on another day: 0 of 115 players.
- Where runs end: 35% at level 1, then a long tail (levels 3-7 = 49 runs). Losses are rare (22 lost vs 55 won):
  players leave while winning, i.e. nothing pulls them on, not a wall of difficulty.

## The five layers today (0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 2 | drag to steer has some skill (pick the gate, thread the hole) but most rows need no thought |
| Core loop | 1 | a level is 13-20 s; gate pairs are random, so the choice rarely matters (a Taller before a beam is never punished by design) |
| Level design | 0 | procedural rows, same three row types from level 1 to 50 |
| Meta | 0 | gems are counted and never used; only a level number carries over |
| Feel | 2 | jelly spring, chunks fly off, stair notes; but no combo, no streak, no spectacle growth |

## Verb and skill ceiling
Drag left/right. The skill is READING AHEAD: mass = height × width, and what you grow is only worth something if the
next beam/wall lets you keep it. A good player takes Wider before a low beam and Taller before a narrow wall, catches the
sliding ×2, threads the gem line without missing the hole, and arrives at the stairs fat. Stars measure exactly that.

## Round loop (v2)
Goal shown by picture: the stairs at the end and the star steps marked on them (★ at the 1-, 2-, 3-star steps).
Pressure: rows get denser and the punishments bigger through the level. Decision every 1-2 s (which gate, which hole,
gems vs safe line). Near miss on the stairs: "1 step from ★★★"; near miss on a loss: "2 rows from the stairs".
Win = stars + gems × multiplier → chest bar.

## Mechanic plan (in order)
World 1 · Jelly Park (1-10)
1. Blue gates (+ taller / + wider) — L1, can't lose.
2. Red gates (- shorter / - thinner) as the other choice — L2.
3. Beams: full-width bars that slice height — L3 (first loss possible). Taller before a beam = wasted.
4. Walls with a hole: crash costs height, a narrow hole squeezes width — L5.
5. Jelly drops: lines of small +4 pickups that pull you off the safe side — L7.
World 2 · Candy Works (11-20)
6. × and ÷ gates (×2 Wider / ÷2 Taller): big swings, real decisions — L11.
7. Sliding gate: a single gate that slides across the track; catch it — L13.
8. Half beams: a beam over one side only; go round it or take the slice for the gate under it — L15.
9. Golden drop: one per level on the risky line; collect all 10 in a world → a golden suit — L12.
World 3 · Storm Peaks (21-30)
10. Sliding walls: the hole moves — L21.
11. Shape doors: a wall with a tall-thin hole and a short-wide hole; your shape decides which keeps more — L23.
12. Wind belts: push you sideways; keep your line — L26.
Hard levels: 9, 19, 29 (red frame, "HARD", +1 chest key). Breathers right after (10, 20, 30 are flashy finales).
After 30: a generator mixes the unlocked rows in the same sawtooth (generated levels say so; the authored 30 are the game).

## Meta
- Level map: 3 worlds × 10, stars per level, next level pulsing, replay any level for more stars.
- Wardrobe: 12 jelly suits (colours + hats, code art). A chest bar fills with gems (×multiplier); each full bar opens a
  chest with a random suit (duplicates pay gems back). World finished = a guaranteed suit.
- Golden drops: 10 per world (worlds 2-3) → golden suit.

## Feel list
- Combo: good gate / clean duck / perfect fit / full gem line chains x2..x5; at x5 JELLY RUSH: glow, trail, gems ×2, 4 s.
- Gate: squash + pop, rising note per combo step. Slice: 60 ms hit-stop + shake + chunk. Crash: bigger shake.
- Gems: pitch rises along a line; full line = "LINE!" bonus.
- Stairs: 20 steps (x1.0 → x5.0), star steps glow; each step a rising note; star reached = star burst; top step = jackpot.
- Win card: stars fill one by one, gems roll up into the chest bar.

## Board
Unchanged: "Levels cleared", mode sum, 1 per level cleared (limits maxRun 1, maxPerSec 0.3 still fit: a v2 level is 30-50 s).

## Fairness
flow.k() and adapt.js untouched and used the same way as v1 (speed / crash cost); stars and levels are the same for everyone.

## Changes (log)
- 2026-10-29 cycle 1: DESIGN.md; levels.js (30 authored, rows every 16 m, 5-20 rows: ~12 s for L1, 25-40 s later);
  stairs 21 steps at 0.25 mass a step (x1.0-x5.0), size caps H 3.5 / W 3; qa/solve.cjs checks every level (solvable, L1 can't
  be lost, greedy "biggest number" play falls short of 3★ outside intro/breather levels); qa/playall.cjs plays all 30 in the
  game. v1 → v1.js unchanged, game.js switch, deep.js = v2 (READY false).
