# Bumperlark deep v2 (lane 20, 2026-10-31) — status: built, READY=false, fun gate not run yet
Data: never played in the last 7 days (queue fallback). v1 = one table, 3 balls, endless score chase.
Layers today (v1): verb 2 (two flippers, plunger power), loop 1 (3 balls, no goal), levels 0 (one table), meta 0, feel 2. v2 target: 3/3/3/3/3.
Verb unchanged: same physics, same flippers, same table geometry, same lanes/drops/orbit (v1.js untouched).
Mission plan (levels.js, 30 missions, purpose line each): T1 LARK LANE teach one element per mission (bumpers, lane multiplier, targets, orbit, slings) with big ball saves, boss 10;
T2 NEON ALLEY hot bumper (5x, hops after each hit) and a sliding bumper, new bumper layouts (diamond/five/line), 2-ball mission, boss 20;
T3 MIDNIGHT LOOP armored drop targets (two hits), shorter ball saves, multi-goal missions, boss 30.
Goals: score / bumper hits / target banks / orbits / reach n× / hot hits / sling kicks, up to 4 at once on bosses; pills on the table show progress.
Stars: 1 goal done, 2 done before the last ball, 3 done and score >= s3. Map with 3 tables; every 5 stars a ball skin (8, variable look); next-skin bar on win/map.
Feel: hot-bumper ring pulse + HOT pop, goal-done confetti, crack on armor, SO CLOSE line on loss, one-tap AGAIN.
First 3 missions: ball save 14/12/10 s, start card goes straight into mission 1, no menu.
Board: submit score per mission at end, same meaning as v1 (points in one game), limits unchanged.
QA: qa/playall.cjs (bot through the real game, warp). Left: calibrate goals with bot, replay, critic gate, READY true, ticket.
deep v2: shipped 2026-10-31 (TEST)
