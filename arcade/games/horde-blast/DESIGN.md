# Horde Blast: design

deep v2: in progress (lane 12, 2026-10-29). READY = false in game.js until the fun gate passes.

## What it is
Hold to fire a stream of little blue fighters from a cannon, drag to aim them through multiplier gates (x2..x5) and overrun the
red fortress. Red gates halve the crowd, crushers eat it, the fort sends waves of reds that trade 1-for-1 with your fighters; a
red that reaches the cannon ends the run. Every 4th level in v1 a brute walks down the lane first.

## Numbers (diag_events type 'game', 2026-10-22 … 10-29, real visits only)
~33 visits in the week (34 logged runs): median time per visit **~64 s**; 4 of 33 quit under 15 s; 1 in 3 stay 90 s+; the longest
runs (195-318 s) reach level 13-16. Ends: most visits leave by "next" (jumping to another game). Levels reached 2-9, a few 12+.
v1 is one procedural level shape: gates re-rolled per level, same three things from level 4 on, nothing new after level 7.

## The five layers in v1 (0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 2 | Hold to fire + drag to aim through gates: aim matters (which lane, dodge the crusher), but there is nothing to time or save. |
| Core loop | 2 | Fire, steer, watch the crowd multiply, win/lose by fort HP vs troop budget. The decision per second is lane choice only. |
| Level design | 1 | Procedural rows with a re-roll until the best column is x12-x36. Crusher at 4, second crusher at 7, a boss every 4th: then nothing new. |
| Meta | 0 | A level number. No stars, no map, nothing to collect. |
| Feel | 2 | Crowd instancing, recoil, gate pulse, win burst. No streak or crowd call-outs, no variable rewards. |

## Verb and skill ceiling
Same verb. The ceiling is now troop spend: every siege has a measured budget and star pars. 3★ = beat it with few troops
(stop firing when the crowd in flight already finishes the fort, take the best lane, time flip gates), 2★ = good, 1★ = cleared.
A star meter at the top shows what the siege is still worth as you fire. Extra decisions: bomb timing, crates, flip-gate timing,
dodging laser strips, golden troops (1 in 45 shots: 3 hits on a red, 8 damage on the fort and boss).

## The round (about 15-50 s)
Goal in a glance (fort number, troop bar with ★ meter). Pressure = troop budget (the bar), waves of reds, hazards. A decision
every 2-3 s (lane, wait for the gap, blue or red flip gate, bomb now or later, crate detour). The loss card shows the near
miss ("SO CLOSE: fort had 12 left!", fort-percent bar) and one tap retries at once. The win card pops ★ one by one, tells you
what 3★ needs ("★★★ needs 148 troops · you used 171"), shows chest progress and the next siege.

## Mechanic plan (in order)
1. x gates, fire and aim - sieges 1-2 (siege 1 cannot be lost, ~15 s, the demo fires the first burst)
2. red ÷2 gates - 3 (first siege you can lose)
3. crusher - 4
4. sliding gate - 5
5. the brute (boss) - 6
6. heavy reds, 3 hits each - 7
7. supply crates (+troops) - 8 · bomb button unlocks at 3 (charges from kills, blasts the red mob near you)
8. **flip gates** (blue then red on a timer, blink warning) - 13 (new world 2)
9. **boulders** - 15
10. **bomber reds** (fast, blow up a clump of your crowd) - 18
11. **laser lanes** (red strip warns, then the lane burns) - 25 (new world 3)

## Worlds (36 hand-made sieges, `levels.js`, a purpose line on each)
- **Sand Fort** (1-12): core verb, red gates, crusher, sliders, brute, heavies, crates. HARD 9 and 12, breather 10.
- **Frost Pass** (13-24): flip gates, boulders, bombers; white/ice look, ice-blue fort. HARD 16, 22, 24; breathers 17, 23.
- **Magma Keep** (25-36): laser lanes + everything; dark lava look, orange fort. HARD 29, 33, 36; breathers 30, 35.
- After 36: generated sieges from all unlocked elements (a brute every 4th), numbers scale, never random-hard.
First three: 1 = two big blue gates, 15 s, cannot lose. 2 = pick the x4 side. 3 = red gates: the first loss.

Difficulty is a sawtooth (hard +15 % troops, breather -25 %). The troop budgets and star pars are measured by `qa/calibrate.cjs`
(a bot that aims like a good player: right column, flip gates timed, stops firing when the crowd in flight is enough) and live in
`cal.js`; the layouts are hand-made. Sieges 1-2 get 2.2x the troops (the v1 hook), the sloppy bot (slow, wobbly) still clears.

## Meta
- **Siege map** (🗺 top right and on every card): 3 world tabs, 12 sieges each, stars under every node, HARD red, boss ringed, the
  next one pulsing, locked ones greyed. Progress saved (kit store 'hordeblast2').
- **Squad chests**: every 5 NEW stars opens a chest: a random squad colour not yet owned (8: Cobalt, Mint, Grape, Tangerine,
  Lime, Sunny, Frost, Shadow) which recolours the fighters and the cannon. Bar "★ 3/5 → squad chest" on the win card.
- Replay any siege for more stars (↺). Board score unchanged in meaning: +1 only for a siege's FIRST clear (levels cleared).

## Feel list
Crowd call-outs (HORDE! / BIG HORDE! / HORDE!!, flash + shake at 200), gate-pass tone that climbs with the chain, flip-gate blink
before it turns, golden troops with a GOLD +8 pop, crate pickup burst, bomb ring + shake + BOOM!, boss tint per world, PERFECT
pop and star animation on the win card, near-miss line + fort bar on the lose card, retry under 1 s.

## What changed in code
v1 -> `v1.js` untouched; `game.js` = switch (`READY && ab('deep-horde-blast')`, `?deep=1` for QA); v2 = `deep.js` + `levels.js` +
`cal.js` (+ `merge.js`). Rules the bot and the game share live in one file (`deep.js`): `window.__game.fast(n, sloppy)` plays a siege
headless at 60 steps a second for qa/calibrate.cjs and qa/playall.cjs.
Fairness: `flow.k()`, adapt and the tuner are used exactly as in v1 (never harder on 1-2, ±25 %); ranked players unaffected.
