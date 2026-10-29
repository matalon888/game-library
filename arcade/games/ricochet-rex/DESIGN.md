# Ricochet Rex: design

deep v2: shipped 2026-10-29 (lab test deep-ricochet-rex: half the arcade players get v2).

## What it is
A suited agent, three bullets, a room of goons. Drag to aim (the laser shows the first two bounces), let go to fire.
Bullets bounce off walls and go through goons. TNT explodes, ropes drop weights, crates get shoved. Never hit a hostage.

## Numbers (diag_events type 'game', 2026-10-22 … 10-28)
311 visits logged, but 158 were robot runs (20 s, ~40 taps, closed; the smoke-test beacon leak fixed on 10-28). The 153 real
visits:
- median time per visit **47 s**; 24% quit under 15 s; 36% stay 60 s+; 13% reach 3 min
- 61% of visits end by jumping to another game ("next"), 39% close
- runs end at level 1 (29), 2 (44), 3 (29), 4 (23), 5+ (12): the deaths pile up at levels 3-4, where the generator
  starts asking for bank shots with 4-5 goons
- back on another day: **0 of 148** players
- traffic: ai-daily 57%, direct 22%, cpalead 12%, meta 8%

## The five layers in v1 (0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 2 | Drag-aim-release with a bounce sight: real skill (bank angles), and a better player does clear rooms with fewer bullets. |
| Core loop | 2 | Room → 3 bullets → slow-mo last kill. Decision per shot is real. The loss line shows goons left; no "why" beyond that. |
| Level design | 1 | Procedural: 4 templates, random props. Every room from level 2 has the same mix; nothing is introduced or taught; difficulty is a ramp (a goon every 2 levels). |
| Meta | 0 | A level number and a score. Nothing to collect, nothing to come back for. |
| Feel | 3 | Slow-mo final kill, ragdolls, shake, pops (DOUBLE KILL, RICOCHET), sounds with pitch, confetti. |

## Verb and skill ceiling
Same verb. The ceiling is now visible: every room has a par (fewest bullets the solver needs). Clearing on par = 3 stars,
par + 1 = 2, more = 1. A star meter under the ammo shows what the room is still worth as you shoot.

## The round
Goal in a glance (goons in the room, 3 bullets, ★★★ meter). Pressure = bullets left and the stars dropping. A decision per
shot (which goon, which bank, keg or snipe, glass now or later). Loss card: what's left standing + one tap retry + rooms.
Win card: stars pop in one by one, "★ N more → <suit>", Next / replay / rooms.

## Mechanic plan (in order)
1. goons + walls (bank shots) — rooms 1-4
2. crates (shove onto heads) — 5
3. weights on ropes — 6, 8
4. TNT + chains — 13-16
5. hostages — 17-19
6. glass panes (stop a bullet and shatter; TNT breaks them) — 20-22 — **new in v2**
7. armoured goons (two hits; a bounce back through counts twice) — 25-28 — **new in v2**
8. steel mirrors (angled bounce) — 29-32 — **new in v2**

## Worlds (36 hand-made rooms, `levels.js`, a purpose line on each)
- **Timber Woods** (forest, 1-12): bank shots, crates, ropes. HARD 9 and 12, breather 10.
- **Dust Gulch** (desert, 13-24): TNT, hostages, glass. HARD 16 and 24, breather 23.
- **Neon City** (city, 25-36): armour, mirrors, everything. HARD 33 and 36, breather 32.
- After 36: bonus rooms from the v1 generator at its level-10+ size (same flow/tuner multiplier as v1) with an armoured
  goon in half of them (kept only if the room stays clearable with 3 bullets).

First three rooms: 1 = one goon, the sight already on him (can't fail, ~5 s). 2 = two goons in one line (one bullet or
two: the first decision). 3 = the first room you can lose: a pillar hides him, bank off the ceiling.

Difficulty is a sawtooth: par 1-2 rooms, a HARD room (red frame, badge on the map) at 9/12, 16/24, 33/36, a breather right after.

## Meta
- **Room map** (🗺️ top right, and on win/lose cards): 3 world tabs, 12 rooms each, stars under every room, HARD rooms red,
  the next room pulsing, locked rooms show a lock. Worlds open as you reach them.
- **Stars → suits**: 8 suits for the agent (Navy … Gold) unlocked at 0/6/15/27/40/54/70/90 stars; pick one on the map.
  The win card always says how many stars to the next one. Cosmetic only.
- Progress saved on the device (`ricochetrex2_*`), separate from v1's level.

## Feel added in v2
Star pop-in with rising tones, PERFECT! on a par clear, CLANG! + helmet shards on armour, SMASH! + shards on glass, a ping
and flash on mirrors, HARD ROOM! intro, red frame on hard rooms, room name under the ammo.

## Fairness and the board
- Rooms are the same for everyone. In-round adaptation (laser length, the last-bullet full sight, the small aim magnet when
  struggling) is v1's, unchanged, and off for ranked players (RULES.md 5). flow.k() numbers untouched; the tuner's multiplier
  still sizes the bonus rooms after 36 exactly as it sizes v1's rooms.
- Board: "Levels cleared", mode sum, +1 per cleared room as in v1 (replays of a room count too: a cleared room is a
  cleared room). maxRun 2 / maxPerSec 1 unchanged, so limits.json needs no change.

## QA
- `node qa/rooms.cjs` — the solver's fewest bullets for each room = its par (all 36 match).
- `node qa/playall.cjs` — the bot plays every room with the real physics, aiming with the solver's plan.
- Lab: `ab('deep-ricochet-rex')` from kit/xp.js; `?deep=1` forces v2 for QA only.
