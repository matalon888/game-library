# Twist Drop: deep v2 design (lane 94, 2026-10-31)

Game: drag to twist a 3D tower, the ball bounces down; fall through gaps, never land on dark slices; 3 gaps in a row = ON FIRE
(smashes the next landing). Today (v1): rings are random per level number, one board score "levels cleared". No DB on this server.

## Five layers today (0-3)
- Core verb 2 (drag-twist with timing in the air; skill exists but levels do not ask for different things)
- Core loop 1 (a level is ~10-36 random rings; lose = restart at 0 score; no goal beyond finish)
- Level design 0 (seeded random rings, same shape bigger)
- Meta 0 (level counter + score)
- Feel 2 (squash, shards, fire, splats; no hit-stop, no combo escalation, no near-miss line)

## Plan
Mechanic plan (order): 1 gaps+safe  2 dark slices  3 fire streak  4 gems (stars)  5 crumbling ice  6 spinning rings
7 bumpers (big bounce)  8 blinkers (dark only while lit)  9 pinch gaps  10 mixes.
Worlds: Candy Tower 1-10 (twist, dark, fire, gems, boss) · Frost Tower 11-20 (ice, spinners, boss) · Neon Tower 21-30 (bumpers, blinkers, final boss).
Levels: `levels.js`, 30 motif-built towers with a purpose line each; `qa/validate.mjs`. Stars: 1 clear, 2 = 2 gems, 3 = 3 gems (gems hang in gaps).
Meta: level map with stars (button bottom-left), every 6 stars = a chest with a ball skin (12 skins), Daily Tower with day streak;
win card says what waits tomorrow. Feel: combo pitch + bigger pops, hit-stop on fire smash, gem sparkle, near-miss line on loss.

## Left to do
- deep.js (meta + map), DEEP branches in game.js, READY=false; QA bot all 30; critic next cycle.
