# Doodle Legs — deep v2 plan (lane 38, 2026-10-31)

Game: draw a scribble in the pad, it becomes the spinning legs of your cube; race 3 rivals to the flag over steps, walls,
tunnels. Endless seeded courses (physics.js `course(level)`), one race per level, no stars, no meta.
Data (db, 7 days): 13 visits; median ~19 s, 2 of 5 sampled under 10 s (quick_quit), one 209 s player with 71 taps.

## Five layers today (0-3)
- Core verb 2: drawing legs is a genuinely fun, unique toy; but a tap gives ready-made legs and nothing rewards a clever shape.
- Core loop 1: one race, win/lose, no reason to redraw except "stuck".
- Level design 0: random pool, same shapes bigger. Tunnel can appear at random.
- Meta 0: only a level counter. Feel 2: squash/dust/shake exist; no gems, no combo.

## Plan (v2)
Authored `levels.js` (DONE): 30 races, 3 worlds, one idea each — Meadow (big legs climb), Tunnel Town (small legs squeeze,
chicane = wall then roof), Gap Peaks (pits: bridge with a big loop). Purpose line per level, HARD every 9-10, breather after.
`buildCourse(spec)` adds new piece kinds to physics rects: gap (no floor), chicane; 3 gems per level on the hardest lines.
Solver `~/agentpark-studio/tools38/solve.mjs` (headless bot): all 30 solved (7-34 s bot time).

Still to build in game.js (DEEP branch, READY false):
1. Load LEVELS via buildCourse for level<=30, `course()` after. Gaps: fall = respawn at edge (-1 s).
2. Gems: 3 per level (pickup burst, pitch rises); stars: ★ win, ★★ win + 2 gems, ★★★ win + 3 gems + under par.
   Win by 1st place only (as v1). Rival speed per level `rv` * flow.k() (tuner untouched).
3. Shape skill: "tight loop" bonus — a drawn shape whose size fits the next obstacle (big for walls, small for roofs) = +"PERFECT FIT" popup and a
   short speed puff ("draw bonus": omega x1.1 for 1.5 s; same for every player).
4. Map screen (3 worlds x 10 nodes, stars, next node pulses), saved by store; result card with near-miss line ("0.4 s behind Mia!").
5. Meta: 12 cube hats/skins unlocked by stars (every 4 stars), shown on the map; Daily Race (date-seeded course from the unlocked pieces)
   + streak, "Tomorrow: Daily Race · day N" line on win/lose cards.
6. Juice: gem chain pitch, overtake slow-mo, finish photo-flash, rivals bump trash-talk emoji, fever after 3 gems in a row (trail).
7. First 3 levels: L1 can't be lost (rv 0.55, tap hand), L2 a decision, L3 first wall to lose to.
8. Then: fresh replay + critic next cycle (never same cycle), ticket.

Layers target: verb 3, loop 3, levels 3, meta 2, feel 3.

## Cycle 2 status (2026-10-31)
deep.js now has: 30 authored races via buildCourse, rival speed from level rv, pits (respawn at the edge, rivals too), 3 gems per race,
stars (1 win, 2 with 2+ gems, 3 with all gems and under par), "perfect fit" popups, gem fever trail, win/lose cards (near-miss line, tip on why you lost),
map of 3 worlds with stars, 12 hats unlocked every 4 stars, Daily Race + streak + "tomorrow" line, endless road after 30. Board = levels cleared (first clears only).
Bot wins L1,3,11,21 in a real browser; L26 lost once (rival race, normal). READY false. Not yet: fun gate, fps check, desktop shot, overtake slow-mo (skipped).

Cycle 34 (2026-11-01): critic 6.4 vs v1 4.3 FAIL (Toy tie 7, fps env 15). Added draw juice (squash, size-scaled ping, ROUND!/NICE LOOP!), win card tap-anywhere = Next, fixed openMap crash (stray line), hint now names the hardest obstacle (walls L3-5 said "any legs climb"). Left: ghost shape shown after the first fail, aid after 2 losses (exists: -5%/loss), live shape feedback while drawing, surprise earlier.

deep v2: ticketed 2026-11-01 (Verdict TEST, critic avg 7.0 vs v1 3.3)
