# Marble Dash — deep v2 design

deep v2: shipped 2026-10-31 (Verdict TEST 7.7 vs v1 3.4)

v1 scored (layers 0-3): core verb 2 (hold + steer), core loop 1 (generated course, run until you fall), level design 0
(generated), meta 0, feel 2. Same game kept: beach-ball marble, floating wooden deck, hold to roll, slide to steer.

## v2 plan
- 30 hand-made courses (levels.js, one purpose line each), 3 worlds, sawtooth with breather + BOSS at the end of each world.
- Mechanic plan: W1 Sunny Deck = roll, narrow, jump gaps, zig, slider, sweeper, bridge planks. W2 Candy Sky = spinners, ice
  (loose steering), conveyors (sideways push). W3 Storm Peak = crumble tiles (keep moving), blinking tiles (time it), twin doors.
- Every course has gems (combo chain x2..x20, UNSTOPPABLE), exactly 3 golden stars on risky lines, a par time.
- Stars per course: 1 cleared, 2 all golden stars, 3 under par. 7 stars = chest = a new ball (12 balls). Course map with worlds.
- First 3: course 1 cannot be lost (railed slopes, boosts, 3 golds on the path); 2 adds narrow planks; 3 adds the first slider.
- Hearts: 3, checkpoint pads; fall = back to last pad.
- Board score = levels cleared (same meaning as v1: sum of levels), limits unchanged.

## QA
qa/solve.cjs: planner bot clears all 30 with 3/3 golds, par = ~1.35x bot time (course 12 and 27 pars checked below).
