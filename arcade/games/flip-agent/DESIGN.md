# Flip Agent: deep v2 design (lane 23, 2026-10-29)

No DB on the AWS server, so no play numbers. Scored from playing v1 and reading its code.

## Layer scores (v1)
Core verb 2 (timing a tap on the green laser) · core loop 1 (flip, shoot, repeat; generated stages) · level design 0 (generated)
· meta 0 (best score only) · feel 2 (slow-mo, ricochets, blasts). Target after v2: 3/3/3/2/3.

## Plan
- 30 authored missions (levels.js), each with a purpose line, 3 worlds of 10: Rooftop Run (goons, hostages, barrels, steel),
  Neon Docks (riot shields, chain blasts, tight ammo), Skyline Heist (bosses, long runs, no room to waste).
- Mechanic order: goon -> hostage -> beam goons -> barrels -> hanging goons -> steel plates -> shields (head only) -> chains ->
  tight ammo -> bosses (2-3 hits) -> combos of all.
- Sawtooth: each world = intro, practise, twist, a HARD mission (red badge), breathers (barrel parties, fireworks).
- First 3: mission 1 cannot be lost (auto-fires when green), missions 1-2 an off-target tap is free, mission 3 first real loss.
- Stars: 1 cleared, 2 no wasted bullet, 3 the mission's trick (spare bullets, headshots, blasts, ricochets, goons in one flip).
- Meta: level map with worlds and stars, 8 agent suits unlocked by total stars, daily streak, endless contracts after 30.
- Feel: hit-stop and kill-cam on boss/last kill, chain counters, headshot/blast/ricochet callouts, shield sparks.
- Same game: same name, art, agent, one-tap shooting.

## Validation
qa/levels.cjs (every goon has a fair green window), qa/playall.cjs (a bot plays every mission through the real game).

deep v2: not shipped yet (READY=false until the fun gate passes).
- deep v2: shipped 2026-10-31 (TEST)
