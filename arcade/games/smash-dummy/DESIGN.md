# Smash Dummy: design

deep v2: shipped 2026-11-01 (TEST)

## What it is
Flick a wooden dummy into swinging balls, paddles, cars, bumpers and stairs. Every bump is damage; reach the target before the
throws run out. Ragdoll is a hand-written verlet sim (ragdoll.js), unchanged in v2.

## Numbers (diag_events type 'game', 34 visits, 34 players, all history)
Median **45 s**; 10 of 34 (29%) quit under 15 s; 14 (41%) stay 60 s+. Runs end by "next game". Levels reached: mostly 1-8 (levels
were random setpiece picks after level 6). 30 taps/visit typical, so the verb is liked; nothing makes it add up.

## Five layers in v1 (0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 2 | Flick for direction and power; where and when you throw (timing a swinging ball) is skill. |
| Core loop | 1 | 3 throws vs a damage number. Round ends the moment you pass the number: no reason to throw better. Loss says "NOT BROKEN". |
| Level design | 0 | 6 hand-built setpieces for levels 1-6, then random pairs. No teaching, no new mechanic. |
| Meta | 0 | A level counter. |
| Feel | 2 | Hit-stop, shake, floaters, bursts: good. No combo, no escalation, no reward for style. |

## v2 plan
- **Stars by damage**: 1 star = target, 2 = bigger, 3 = a clean masterpiece. The round no longer ends at the target: you keep
  throwing for more (BANK IT button ends early). 3 stars = slow-mo PERFECT.
- **Combo**: hits within 1.3 s chain a multiplier (x1.15 per link, capped x2.5): COMBO / MEGA COMBO / UNSTOPPABLE, hit-stop, counter.
- **Setpieces (levels.js, 30 levels, 3 worlds, purpose line each)**: v1's ball, stairs, car, paddles, bumpers, crate (with options:
  fast, double, three paddles) plus new: **TNT** (blows on a hard touch, chain reaction, big bonus), **glass panes** (shatter for
  bonus and the dummy flies on), **spikes** (floor, x2.2 damage), **updraft fan** (lifts the dummy), **golden bullseye** (+60, bobs).
  World 1 TEST YARD teaches (1 idea per level, new thing L8 gold, L9 glass); World 2 FACTORY (L11 TNT, L13 spikes, L14 fan);
  World 3 FUNFAIR combines, two levels with only 2 throws, FINAL BOSS with 4 throws. L10 / L20 / L30 are bosses.
- **Meta**: level map with stars (3 worlds x 10), 8 dummies (hats and colours) unlocked by total stars, a daily level (+3 bonus
  stars first clear of the day), "next dummy at N stars" bar on every win card, per-world colours.
- **Feel**: speed trail, combo counter, stars light up with rising notes, BANK pulse, so-close lose card with a progress bar,
  one-tap retry, first-throw hint.
- Board score unchanged in meaning: "levels cleared" (WB.submit(1) per win).
- Star targets from qa/calib.mjs (seeded aimed rollouts without rendering), then adjusted by hand.

## Check list
qa/calib.mjs (rollouts), qa/shots.mjs (screens per level), critic FUN_REVIEW.md (BRIEF step 5), fps.
