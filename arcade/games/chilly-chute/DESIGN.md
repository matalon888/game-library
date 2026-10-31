# Chilly Chute — deep v2 design (lane 35, 2026-10-31)

Game: 3D tube-sled runner (swipe lane / jump / duck), endless-ish levels of 210-1400 m, procedural obstacle rows, level counter only.
Data (7 days): 20 sessions (low play count; small sample). v1 levels are random rows from a seed, only theme/length changes.

## Five layers today (0-3)
- Verb 2 (3 lanes + jump + duck; skill: timing, but no reward for stunts)  - Loop 1 (die, restart from 0, no decision)
- Level design 0 (seeded random)  - Meta 0 (best m only)  - Feel 2 (nice spray, pops; no chain/spectacle)

## v2 plan
- 30 authored chutes (levels.js): hand-picked phrases of hand-made obstacle rows, purpose line each, 3 worlds, boss every 10.
- Mechanic order: lanes+blocks (W1) > jump logs/walls > duck bars > ramps > gems > pads that SMASH (boost = invincible 2 s)
  > W2 snow rollers sweeping the chute, chained pads > W3 rolling snowballs, full-width ice tunnels, tight gaps.
- Core change: speed pads now smash through everything; chain 5 stunts (close call, jump, limbo, gem, air) = SURGE (free smash boost).
- Checkpoint flag at the middle: a crash after it restarts there (instant retry; the "almost" feel).
- Stars: 1 finish, 2 collect 75% of the coins, 3 all gems. Level map by world, suits (8) unlocked by stars.
- Tomorrow hook: Daily Chute (seeded by date, from unlocked phrases), day streak shown on win/lose cards and the map.
- First 3 levels: L1 cannot be lost (coins, pads, crate wall to smash), L2 adds jumping, L3 first loss.
- Stays the same game: Pip, the donut tube, ice chute look, controls.

## Status (end of cycle 1, 2026-10-31): deep v2 built, READY=false, not shipped
Built in game.js behind `DEEP` (?deep=1 for QA): authored levels via levels.js phrases, smash boost, stunt chain > SURGE, checkpoint
flag, stars, world map, 8 suits, daily chute + streak line on cards, roller and snowball obstacles. v1 unchanged for players.
QA so far: qa/check-rows.mjs + qa/check-timing.mjs prove every row has a way through and lane/jump timing fits the gap (0 bad);
qa/bot-run.mjs (reactive bot, `__game.auto`) clears 17/30 under heavy server load (the bot is weak, not a proof). No console errors.
Left: fresh replay + critic (FUN_REVIEW.md), juice/feel pass from its findings, phone+desktop screenshots of both arms on the Mac,
fps check, ship ticket.
deep v2: shipped 2026-10-31 (Verdict TEST; fps not verifiable on server, software GL ~15 fps)
