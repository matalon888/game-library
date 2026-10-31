# Viral Den: design

deep v2: in progress (studio lane 4, started 2026-10-29). READY false until the fun gate passes.

## What it is
Kai films clips in a cosy cut-away bedroom. Tap to film, the HYPE meter climbs, at full hype Kai goes VIRAL. Followers fill
the level goal before the trend fades; sponsor cash buys gear (camera, lights, room, headphones) that rebuilds the room.

## Numbers (diag_events type 'game', 2026-10-22 … 10-28, smoke-test runs filtered)
- 106 visits, 102 players
- median time per visit **74 s**; **23%** quit under 15 s; 18% reach 3 min
- 57% of visits end by jumping to another game ("next"), 39% close
- where runs end: almost all still in **level 1** (`play|…|1`); a few cleared 3-40 levels with scores that overflow
  (1.4e21 at level 40: the goal grows ×2.85 a level and upgrades ×1.35 a tier, so numbers explode)
- back on another day: **0** players

## The five layers in v1 (0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 1 | Mash anywhere. The only skill is tap speed; a good player is not visibly better than a fast one. |
| Core loop | 1 | 45 s timer, mash, buy the cheapest card when it lights up. One decision (which card) every ~15 s. |
| Level design | 0 | A formula: goal ×2.85, time +2 s. Level 9 = level 2 with bigger numbers. |
| Meta | 2 | The room visibly rebuilds as you buy (strong), but nothing else carries over: no map, no stars, no collection. |
| Feel | 2 | Emoji, poses, +N pops, confetti on viral. Every tap feels the same; there is no music. |

## Verb and skill ceiling (v2)
Still "tap to film", now **on the beat**. Each level is a short track; clips (notes) slide along a timeline into the REC
ring and you tap as they land. PERFECT (±90 ms) / GOOD (±190 ms) / MISS. Every hit plays the next note of the tune and makes
Kai pose, so a clean run *is* a song. Mashing breaks the take (a tap with no clip near = a flub, combo reset). The ceiling:
perfect streaks fill HYPE faster; full HYPE = VIRAL (x5, golden notes, beat drop) for 8 beats. Same tap, good vs great.

## The round (one video, 20-50 s)
1. Goal in a glance: the progress bar with three star ticks; the video's title card ("Unboxing… a sock?").
2. Pressure: the track is the timer, density and tempo rise within it, misses drain HYPE.
3. Decisions: tap or let a 💀 troll comment pass; risk a golden ⭐ clip; hold a long take to the end or let go for the next.
4. End: the bar shows how close you were ("SO CLOSE: 4% short"), retry in one tap.
5. Win: stars pop one by one, cash for the den, the next video lights up on the channel map.

## Mechanic plan (in order)
1. **Tap clips** on quarter notes (1-3)
2. **Rests / off-beats** (flubs break the combo) (2-4)
3. **HYPE → VIRAL** fever (4)
4. **Double clips** (two quick eighths) (6)
5. **Golden clips** ⭐ (worth 3×, a coin, only on PERFECT) (8)
6. **Long takes** (hold until the end) (11)
7. **Troll comments** 💀 (don't tap; letting it pass keeps you cool) (14)
8. **Tempo spike** (a trend spike: the track speeds up mid-video) (18)
9. **Swipe-up clips** ⬆ (flick up to post) (21)
10. **Lag clips** 👻 (fade out before the ring: keep the beat in your head) (24)
11. **Collab echo**: a guest plays a phrase (purple, auto), you play it back as lag clips (27)

## Worlds (30 hand-made videos, `levels.js`, a purpose line on each)
- **Bedroom Vlogs** (1-10): taps, rests, viral, doubles, golden. HARD 7 and 10, breather 8.
- **Loft Streams** (11-20): long takes, trolls, syncopation, tempo spikes. HARD 16 and 20, breather 17.
- **Studio Hits** (21-30): swipe-ups, lag clips, collab echo, the finale medley. HARD 26 and 30, breather 27.
- After 30: generated videos from the unlocked elements (seeded per level; the flow tuner's multiplier scales their tempo).

First three: 1 = eight slow claps, the first two filmed by the demo, goal 25% (can't fail, ~12 s). 2 = rests appear (the first
"don't tap" moment). 3 = the first one you can lose: a flub-heavy groove; the loss card says how many flubs.

## Meta
- **Channel map** (📺 button and on the win/lose cards): 3 world tabs × 10 video tiles with stars, HARD tiles red, the next
  tile pulsing, locked tiles show a lock. World 2 and 3 open when the previous world is cleared.
- **Den makeover**: cash from each video (more for stars and golden clips) buys the 4 gear lines × 4 tiers from v1; the room
  rebuilds in front of you. Cosmetic: the score never depends on gear (same game for everyone).
- **Fan mail**: every 10 stars opens a fan-mail box with a random cash gift (sometimes a jackpot).
- **Subscribers**: the total followers number climbs across videos with plaques at 10K / 100K / 1M.
- Progress saved on the device (`vden2_*`), separate from v1.

## Feel added in v2
Each hit plays the next note of the video's tune (pentatonic, can't sound wrong), a soft kick/hat backing on the beat, a
PERFECT ring flash + particle burst, combo counter with rising pitch, "x10 COMBO!" callouts that grow, VIRAL beat drop
(screen flash, confetti, gold notes, double-time hats), flub = a camera-shake + 😬, troll pass = 😎, star pop-in with tones.

## Fairness and the board
- Charts are the same for everyone; no in-round adaptation in v2 (v1's adapt.js stays in v1). flow.k() untouched: it only
  scales the tempo of generated videos after 30, as it scaled v1's clock.
- Board: "Levels cleared", mode sum, +1 per cleared video (as in v1). limits unchanged (maxRun 1, maxPerSec 0.15: the
  shortest video is ~14 s).

## QA
- `node qa/charts.cjs` — parses every chart, simulates a perfect run and a "sloppy" run (GOOD on everything, 10% misses):
  perfect must reach 3★, sloppy must clear levels 1-10.
- A Playwright bot plays every level with the real timing via `__game.auto`.
