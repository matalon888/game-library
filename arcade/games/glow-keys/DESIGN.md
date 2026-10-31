# Glow Keys: deep v2 plan (studio lane 40, 2026-10-31)

Game: piano-tiles rhythm. Tap dark tiles on the glow line; each tile plays the next note of a public-domain melody; hold long tiles.
Data (13 visits in db copy): median 19 s per visit, 5 of 13 quit under 15 s. v1: ONE miss ends the song, levels = same 11 songs
cycling longer and faster, stars on the bar are just progress marks (a win is always 3 stars), no meta.

## Five layers (v1 score → v2 target)
- Core verb 2 → 3: tap/hold + timing grades (PERFECT <110 ms, GREAT <220 ms, COOL) that now decide stars; two-finger double tiles.
- Core loop 1 → 3: 3 hearts (2 on boss levels) instead of instant death; combo, fever x2 after 20, golden tiles, near-miss lose card ("SO CLOSE 87%").
- Level design 1 → 3: levels.js, 33 hand-set levels (song, length, tempo, fall time, rules, purpose line), 3 worlds, bosses at 10/21/30/32/33, breathers after.
- Meta 0 → 3: map with stars, 5 tile colours unlocked by stars (+1 per 10 gold), gold counter, daily melody, streak.
- Feel 2 → 3: shake on a miss, fever glow, combo escalation every 10, gold chimes, star-pop cards.

## Mechanic plan
W1 Lantern Lane (1-11): tap only (1-6), gold tiles (4), hold tiles (7). W2 Neon Alley (12-22): + double tiles (play both). W3 Starlight Stage
(23-33): + ghost tiles that fade near the line (keep the beat). Past 33: the levels again, faster each lap.
Stars: f = weighted timing share (PERFECT 1, GREAT .75, COOL .5, miss 0). 1 = clear, 2 = f >= 62%, 3 = f >= 80% and at most 1 heart lost.
First 3 levels: 9-17 s, slow fall, 3 hearts; L1 plays its first beats by itself (demo bot), cannot be lost.
Tomorrow hook: daily melody (same for everyone, dailyOf in levels.js) + day streak, shown on the map and on every win card.
Board: score meaning unchanged (levels cleared today, +1 per win).

## Status
Cycle 1 (2026-10-31): built behind `READY=false` (`?deep=1` for QA): levels.js, deep.js (v1.js = untouched original), style.css.
Bot-checked in a phone viewport: levels 1, 4, 7, 12, 23 won 3 stars; density table by tools40/dens.mjs.
Left: bot-solve all 33, CPU-throttle frame rate, fun critic (next cycle, fresh replay first), polish what it finds, ticket.
deep v2: not shipped
