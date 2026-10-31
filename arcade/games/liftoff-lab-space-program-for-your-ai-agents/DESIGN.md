# Liftoff Lab (agent-rockets) — deep v2 plan (lane 43, 2026-10-31)

## What it is today
"Connect your AI" game: real Claude Code/Codex events build rockets on pads (edits = parts, tokens = fuel, passing tests = GO,
commit = launch). The player's only skill moment is the FLIGHT (~13 s): steer inside a wobbling corridor (drag/hold sides),
tap shrinking rings for stage separation. Result = which planet (7 worlds, reach thresholds), science -> shop (pads, tiers, decos).
Data: 0 visits in 7 days (the game is gated on having a connected agent; with none it sits on "waiting for your agents").

## Five layers (0-3)
- Core verb 1: steer + ring tap exist but corridor is random and the autopilot flies for you until you touch.
- Core loop 1: one 13 s flight, no fail state, no decision; outcome mostly set by parts built by agents, not the player.
- Level design 0: corridor is a seeded random sine; no authored missions.
- Meta 2: planets, pads, tiers, decos, daily list, streak, board. But all gated on agent events.
- Feel 2: good launch spectacle (smoke, shake, vapor, countdown).
Biggest gap: a player with NO agents has nothing to play. v2 must be playable and deep alone, with agents as a bonus.

## v2 plan: "Mission Control" (same name, same toy-rocket look)
Core idea kept: build a rocket, fly it to worlds. Depth comes from 30 authored missions flown by the player, usable with or without agents
(agents' parts/fuel become a bonus stock: free parts, a GO that widens the lane).
1. **Verb with skill**: no autopilot; hold-to-steer plus a BOOST tap (burn fuel for a short speed burst, fuel is a bar of 3 charges).
2. **Round**: 25-45 s mission = authored track of gates (rings to fly through), hazards, fuel cans, stage-sep rings. Lose = hull 0
   (3 hull pips) with "so close: 1 gate" retry in <1 s; win = reach target world with stars.
3. **Mechanic plan (30 missions, 3 worlds x 10)**:
   - World 1 "Sky" (Home orbit->Moon): gates only (m1 can't fail), wind gusts, max-Q shake band, staging ring, fuel cans, boost.
   - World 2 "Rocks" (Rust Rock->Halo): asteroid fields, moving debris, satellites to snap a photo of (tap), magnet gate, tight lanes.
   - World 3 "Deep" (Frostbite->Far Dark): gravity wells (pull), solar flares (timed beams), wormhole gate pairs, boss mission with 3 phases.
   Sawtooth: hard mission every 7th (red HARD badge, double science), breather after.
4. **Stars**: 1 = arrive, 2 = no hull loss, 3 = every gate + par fuel left. Per-mission best saved.
5. **Meta**: mission map (3 worlds, path, next node pulsing, stars), stars -> chests (rocket paint / flame colour / mission patch collection,
   24 patches, empty slots shown); keep existing pads/shop/decos. Tomorrow hook: Daily Mission (fixed seed, one per day) + streak,
   shown on result card and map. Agents bonus: each commit launched today = +1 spare hull on the daily.
6. **Juice**: gate-pass chime climbing pitch per consecutive gate, combo "x5 PERFECT LINE", near-miss slow-mo, hull-hit hit-stop, boost
   flame bloom, star pop with count-up, confetti on world clear.
7. First 3 missions: m1 big gates in a straight line, win in 15 s; m2 adds drift (1 decision); m3 first loseable (asteroid) with clear why.

## Build steps (READY false, switch ab('deep-agent-rockets'), v1.js = copy of old game.js)
A. v1.js copy + game.js switch.  B. missions.js (30 authored, each with purpose line) + qa solver (bot flies, every mission winnable,
3-star reachable).  C. flight rewrite for missions (gates/hazards/boost/hull) reusing Rocket, flame, smoke, corridor look.
D. map + stars + patches + daily.  E. juice, phone/desktop QA, fps at 4x.  F. next cycle: fresh replay, critic, ticket.

## Status
Cycle 1 (2026-10-31): claimed, read, plan written. No game code changed.
- Cycle 3 (2026-10-31 10:xx): deep.js built; bot flew 6 missions in browser, all won, no errors. Critic next cycle.
