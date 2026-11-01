# Bricklash: deep v2 plan (lane 53, started 2026-10-31)

## Five layers today (0-3)
- Core verb 2: paddle angle + 6 capsules (multi, wide, fire, laser, slow, life); skill is in where the ball meets the paddle.
- Core loop 1: endless, seeded symmetric layouts, 3 lives, no goal beyond score.
- Level design 0: all procedural.
- Meta 0: best score only. Tomorrow hook: kit daily streak only.
- Feel 2: glow, particles, chain x-multiplier, shake.

## v2 (same game, same art)
`levels2.js`: 30 hand-made levels, 3 worlds x 10, each with a purpose line, HARD badges (7, 10, 16, 20, 25, 29, 30).
- W1 NEON ROW: 1-hit, 2-hit, steel (#), gold capsule bricks (G), lanes, 3-hit boss (Gatekeeper, 10).
- W2 BLAST FOUNDRY: explosive bricks (X, chain blasts), sliding rows, bombs + steel; boss Furnace (20).
- W3 COLD VAULT: everything combined, steel mazes, 3-hit lattices; final boss Vault Heart (30).
- Levels 1-3 carry free ball saves ("net"), level 1 cannot be lost.
- Stars: 3 = no ball lost, 2 = one lost, 1 = cleared. Map with worlds, locks, pulsing next node, saved.
- Meta: a chest every 10 stars -> random paddle colour (8 paddles); Daily Lash (seeded endless run, best saved).
- Tomorrow hook: win card + map say "Tomorrow: new Daily Lash · day N".
- Fail card: bricks left ("SO CLOSE!" at 4 or fewer) + one-tap retry. Board score = running total of level scores this session.
- Switch: `READY` in game.js (false); `?deep=1` forces v2 for QA. v1 untouched when off.

## Check so far
`window.__game.sim(n, maxSec, missRate)` plays a level with the bot in fixed steps. Last run (bot miss 2%): 22/30 cleared
within 240 s; slow (60-180 s) because the bot never aims. Not cleared: 6,7,9,10,21,23,28,29 (bot stuck in loops, or loses balls).

## Left
1. Tune: shorten levels (fewer hp / bricks where bot >100 s), make sure 6,7,9,10,21,23,28,29 are clearable (bot with aim).
2. Juice: bigger combo escalation, fever after a long chain, near-miss text on last-brick, second hit-stop on bomb.
3. Replay cold next cycle, run the fun critic (PLAYBOOK 0), fix, set READY true, write the ship ticket.
