# Horde Blast - Fun Review (blind, new-player pass)

Method: Playwright + Chrome, 390x844 touch viewport, CDP touch events (press, thumb drag, hold, tap), ~10 min per version, v1 then v2 sequentially, all non-127.0.0.1 requests blocked. Judged only on what was visible; no design/state docs read.

**FPS caveat:** headless software rendering with video recording running. Idle measure: v1 23 fps at the start screen, 11-14 fps during heavy-horde play; v2 21-25 fps idle, 11-15 fps in play. Both are under 30 fps, so **Toy is provisional for both versions** (feel of the horde cannot be fully judged). My bot is also a dumb random-aim player, so Mastery/Almost are inferred partly from the feedback the game gave it.

## Scores

| Test | v1 | v2 (?deep=1) |
|---|---|---|
| 10-second | 7 | 8 |
| Toy (provisional, <30 fps) | 6 | 7 |
| Almost | 5 | 8 |
| One-more | 5 | 7 |
| Surprise | 5 | 7 |
| Mastery | 4 | 6 |
| Tomorrow | 2 | 7 |
| **Average** | **4.9** | **7.1** |

## v1 notes
Mob Control clone, reads instantly: tap to fire a stream of blue troops through x2/x3/x4 gates at a red fort, red gates halve you, boss at level 4, finite troop ammo. Levels 1-6 in 10 min. Honest weakness: no meta at all. Level bar and a trophy button that does nothing visible. "OUT OF TROOPS" and "OVERRUN" are bare, with no hint of how close you were, no reward, no reason to return. Same gate gimmick reshuffled; surprise is only the boss and spinning-log hazard. Fail states feel arbitrary.

## v2: first 2 minutes beat by beat
1. 0s: Same title card over a road, a pointing hand and "Tap left or right to fire - hold and drag to aim". New: a MAP pill top right and a 3-star bar over the fort, with the fort at 427 HP.
2. 3-8s: First tap and a stream of blue guys fires; counters (troop pool 268, crowd count) tick visibly. Gates pop "x2/x3" floaters. Instantly legible.
3. 20-40s: The crowd stacks into a big blob at the gates and a golden unit appears in the crowd (the "golden troop" goal). The fort number melts 427 to 308 to 48.
4. 54s: Toast "Lift your thumb for 3 stars". A teaching hint about releasing fire to conserve troops, with a live star counter dropping from 3 to 2. This is the first real decision.
5. 60s: FORT DOWN! confetti, "SIEGE 1 - First Blood", star grade vs a troop budget ("3 stars needs 120 troops, you used 142"), squad chest progress 2/5, a "Next: Pick the Bigger" teaser, a 1-day streak with "come back tomorrow for 3 new goals", big NEXT button. Strongest 5 seconds of the game.
6. 64s: Level 2 opens with a "SQUAD!" callout; fort is 1839 HP, tougher, and a bomb button appears bottom left with a cooldown ring.
7. 74-120s: "HORDE!!" / "BIG HORDE!" moments, gold pickups ("GOLD +8"), more gate rows with mixed x4. Fort chips from 1839 down toward 1313 over a long volley. Pacing is a bit slow here and the troop pool, not skill, decides outcomes.
8. Also available from MAP: 3 worlds (Sand Fort, Frost Pass, Magma Keep) with locked nodes, 108 star total, daily goals (win 16 sieges, land 24 golden troops, smash 1500 reds), a 7-slot squad collection grid shown as "?" silhouettes. Lots of "reasons to come back", but almost all locked at the start.

Later: level 3 (blocked me ~6 min with my bot): "SO CLOSE: fort had 71 left! Aim through the biggest blue gates" plus Retry/Map is a good near-miss screen; repeated OUT OF TROOPS with a bomb on cooldown felt grindy for a random-aim player.

## What the best app-store game in this genre still does that this one doesn't
Mob Control / Count Masters-class games make every second of the run a spatial decision with visible risk: enemies and obstacles move toward you, you steer a crowd between left/right gate choices with a clear good/bad trade, and the crowd itself is the character (it grows, you feel its weight, camera shakes, units fly, gigantic payoffs at the end). Here the cannon is bolted at the bottom and the player's only verbs are "hold" and "tilt a little", so outcome is decided mostly by total troop budget, not by clever play. Also lacking: a persistent upgrade loop (fire rate, starting troops, income) that makes failing level 3 feel like progress, varied enemies/hazards on a rhythm (v1 has a boss and logs; v2 mostly the same gate rows), a rewarded-chest/unlock reveal moment, and a haptic/sound/juice layer. Frame rate on mid phones is the other big risk when the horde grows.

## 5 biggest fixes, in order
1. Make the run a decision, not a hold: add moving/choosable threats and gates with real trade-offs (red vs blue lanes you must commit to), so aim matters more than ammo budget.
2. Add a persistent upgrade shop (troop count, fire rate, bomb cooldown, income) and spend gold on it at fort-down and overrun, so every failed run still pays.
3. Performance: cap rendered units and use instanced/sprite mass so the horde holds 30+ fps on mid phones; at 11-15 fps in play the core toy is not trustworthy.
4. Fix difficulty cliff at level 3 (fort HP jumps 427 to 1839 to 1313): tune so a random-aim player still gets 2 stars and a good player 3, and make the bomb recharge meaningful.
5. Show the meta at the start: unlock the squad grid and 1-2 worlds earlier, reveal a first squad chest within 3 sieges, and make the first-session streak/daily goals feel like a gift rather than a wall of "?" and locks.

Verdict: TEST
