# Bonk Brawl: deep v2 design (studio lane 31, 2026-10-29)

Status: v2 built behind `READY = false` (game.js). Fun gate (FUN_REVIEW.md) NOT run yet: do it in a later cycle with a fresh replay.
No DB on this server: no play numbers (v1: endless procedural levels, rivals+speed rise, nothing carries over but best/level).

## The game
Dodgeball arena, 3D bean brawlers. Drag to run (thumbstick), run over a ball to grab it, lift the finger to throw. Rivals telegraph
every throw with a red landing ring. Three hearts. Same name, same beans, same arena art, same controls as v1.

## Five layers (v1 -> v2, 0-3)
| Layer | v1 | v2 |
|---|---|---|
| Core verb | 1 (move, auto-throw at nearest) | 2: mark a rival (tap), bank shots, catch (tap before a ball hits), gold ball pierce |
| Core loop | 1 (survive until all out) | 2: dodge -> pick up their ball -> counter-throw; rival hp, shields drop only while they throw; ring locks 0.35 s before the throw |
| Level design | 0 (procedural) | 3: 30 hand-made arenas, 3 worlds, purpose line each (levels.js) + generator after 30 and for the daily |
| Meta | 0 | 2: level map with stars, a chest every 6 stars (random outfit), closet of 12 outfits (12 hats) |
| Feel | 2 | 3: hit-stop, camera punch, shockwaves, ball trails, world-space combo pops, style meter, star reveal card |

## Mechanic plan (unlock order)
World 1 REC CENTER (1-10): run/grab/throw (L1 cannot be lost: rival aims wide) -> ring dodge (L2-3) -> dodger (4) -> tank (5, 2 hits)
-> pillars (6) -> crossfire (7) -> heart pickup (8) -> twin tanks (9) -> boss Coach Whistle (10, 6 hp, 2-ball volleys).
World 2 NEON RINK (11-20): shield rival (front blocked; drops while it winds up/recovers; side hits and the auto bank shot beat it) ->
bank shot behind a pillar (12) -> curve ball (13) -> catch (14) -> sprinter (15) -> gold ball (16) -> mixed (17-19) -> boss Captain Curve (20).
World 3 SKY DOME (21-30): conveyor belts (21-23) -> crowds (24) -> gold + belt (25) -> fortress (26) -> speed demons (27) -> everything (28)
-> last stand, 2 hearts (29) -> King Bonk (30, 10 hp, shield, 3-ball volleys). World bonus: rivals get more hp, speed and dodge per world.

## Skill and the 3rd star
1 star = clear, 2 = clear with 2+ hearts, 3 = the level's trick: BANK (KO off glass/pillar), CATCH, FAST (par s), FLAWLESS, COMBO (2 KOs in 3 s),
PIERCE (2 KOs with one gold ball), CLOSE CALLS (3 near misses). Shown under the score all level; star pops when done.
Style meter (bottom): close calls, catches, KOs, bank shots fill it; full = gold ball, or a heart if hurt (variable reward).

## Meta
Stars -> chest every 6 -> random locked outfit, auto-worn (hat + colours). Map after each win; start card goes straight to the next level.
Levels after 30: endless generated arenas (sticks to the unlocked rival types). Daily (?daily=1): one generated arena for everyone.

## Fairness / board
Board score "Points" (sum, daily) keeps its meaning; score per level capped at 199 (limits maxRun 200 unchanged). flow.k() still scales
ball speed and throw interval like v1; ranked/humanbot rules untouched. Hero Lab hero still replaces the bean.

## QA
`node qa/playall.cjs <port> 1-30 4` (serve hc-games): bot plays every level through the real code (`__game.sim` steps without rendering).
All 30 won by the bot (shield levels need the bot to wait for the drop); bank/catch/combo tricks reachable. Mac still has to run smoke.mjs.

## Left before shipping
Fresh replay + critic gate (FUN_REVIEW.md), fix lowest tests, phone + desktop screenshots of v1 and v2, fps check (4x throttle), ship ticket.
