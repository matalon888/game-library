# Fling Feud: design

deep v2: in progress (lane 49, started 2026-10-31). `READY = false` in game.js until the fun gate passes; `?deep=1` is QA only.

## What it is
A cartoon side-view throwing duel on rolling hills: drag back to set angle and power, fling an axe (or pan, spear…) at your rival,
head = double damage, then the rival throws back. Hits pop with stars and confetti, never gore. Same name, same cast, same art.

## Numbers (diag_events type 'game', 2026-10-24 … 10-31)
32 visits from 25 players. median time per visit 35 s; 9 of 32 visits under 15 s; 18 end by jumping to another game ("next"), 12 close, 2 come back.
Runs end at duel 1-4 (the best session, 243 s, left at duel 4 still playing). Every duel in v1 is the same thing: flat
hills, the same weapon, a rival who is always visible only after panning, damage with random numbers.

## The five layers in v1 (0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 2 | Drag back for angle + power, release: a real skill (head patch is ~0.03 rad wide). But on a phone the camera showed only YOU while aiming, so the rival was off-screen: aiming blind. |
| Core loop | 1 | Turn-based trade of throws until HP runs out. Nothing changes round to round; no decision besides the aim. |
| Level design | 0 | Procedural: the rival's HP and the hill height grow by a formula, theme cycles. No level teaches or twists anything. |
| Meta | 0 | A level number and a "Wins" board. Nothing to collect. |
| Feel | 3 | Squash/lean spring ragdoll, stars, confetti, slow-mo KO, tone sweeps, shake. |

## Verb and skill ceiling
Same verb. The ceiling gets visible: every duel has a PAR (fewest throws if every throw is a head shot, +1). 3 stars = win in
par throws or fewer, 2 = par+2, 1 = a win. A star meter under the HUD shows what the next throw can still earn. Combos (hits
in a row: +25% then +50%) and the balloon (x1.5) reward planning; a miss resets the combo. The last landing spot stays marked
(pink cone) so you can correct from it: the skill is reading the correction.

## The round
Goal by picture (the rival's HP bar, the star meter). Pressure: the rival throws back, HP bars, stars dropping with every throw.
A decision per throw: head or safe body, lob over the fence or flat under it, take the balloon or not, lead the wind. Loss
card: "SO CLOSE: N HP left" + one tap retry. Win card: stars pop in, weapon distance, tomorrow's Daily Duel.

## Mechanic plan (in order)
1. Throw + head/body damage, hills (duels 1-4; 1-3 have the tap-to-throw assist and a longer aim line)
2. Rival steps to new spots (4, 11, 12…)
3. Walls: lob it (5-6, 8)
4. Balloons: fly through for x1.5 (7-9)
5. Combos (11)
6. Wind: flag + arrows, the aim line bends too (13-16)
7. Shields: body hits clang, aim for the head (17-19)
8. Volleys: the rival throws twice, each hit lighter (21-24)
9. Everything on longer, steeper hills (25-36)
Weapons (stars unlock): Axe, Pan (big hit area), Spear (far, shrugs off wind), Shoe (wind barely moves it), Wrench (one bounce),
Baton (small, hits head hard).

## Worlds (36 hand-made duels, `levels.js`, a purpose line on each)
- **Sunset Yard** (1-12): hills, fences, balloons. HARD 9 and 12, breather 10.
- **Neon Docks** (13-24): wind, shields, volleys. HARD 16 and 24, breather 20.
- **Midnight Peaks** (25-36): long, steep, everything. HARD 30, 33, 36, breather 32.
- After 36: Brawls from a seeded generator (every one checked: a head shot exists at every rival spot, for you and for the rival).
First three duels: 1 = rival with 50 HP, he barely fights back, tap anywhere to throw (the demo shows the aim); 2 = two hits;
3 = first duel you can lose (drag back, rival fights back).
Difficulty is a sawtooth: HARD duels have a red frame and badge on the map; a breather follows.

## Meta
- **Map** (🗺️ top right, and on win/lose cards): 3 world tabs, 12 duels each, stars under each, HARD red, next one pulsing.
- **Stars → weapons**: unlocks at 0/5/12/20/30/42 stars; pick on the map; the win card says how many stars to the next one.
- **Daily Duel** (tomorrow hook): a different seeded duel each day, the same for everyone; a medal per day won, a streak of days
  won; medals unlock Jack's shirts (0/1/3/5/8/12). Cards and map say "Tomorrow: Daily Duel #N · day K".
- Progress saved on the device (`flingfeud2_*`), separate from v1.

## Feel added in v2
Whole arena in view while aiming (v1 showed only you on a phone), wind pennant flutter, balloon pop + x1.5 text, CLANG/THUD
reactions with wobble, COMBO x N text and rising tones, SO CLOSE! marker, star pop-in on the win card, HARD DUEL! intro and red
frame, shove-and-spring on hits (replaces v1's permanent push so distances stay fair).

## Fairness and the board
- Same duels for everyone. The rival's HP is still multiplied by `flow.k()` exactly as v1; the tuner is untouched. The rival's
  aim error is the level's authored error divided by `flow.k()` like v1's formula.
- Damage is deterministic in v2 (head 50, body 25 x weapon x combo): v1's random +-4 is gone so par is exact.
- Board: "Wins", mode sum, +1 per won duel as v1; limits maxRun 2 / maxPerSec 1 unchanged, limits.json needs no change.

## QA
- `node qa/levels.mjs`: every level has a head shot at every rival spot (you and the rival), par = fewest head throws + 1, a
  Monte Carlo win-rate for a sharp / average / sloppy bot, generator fallbacks.
- `node qa/play.cjs <port> <n> "&level=N"`: the bot plays through the real game (phone viewport), screenshots in /tmp/ff49.
- `node qa/flows.cjs <port>`: lose card, Daily Duel (medal once), bonus brawl, no console errors.
- Lab: `ab('deep-fling-feud')`; `?deep=1&level=N` forces v2 at a level (QA only).
