# Chimebox deep v2 (lane 20, 2026-10-31) — status: built, READY=false, fun gate not run yet
Data: not in the 7-day top list (queue fallback, never played in the db copy). v1 = endless songs: one box, a ball that grows on every wall hit, golden walls shrink it, no levels, no goals past "finish the tune".
Layers today (v1): verb 2 (tap turns the box: timing + prediction), loop 1 (one song to finish, no decisions beyond the turn), levels 0 (seeded repeat), meta 0, feel 2. v2 target 3/3/3/3/3.
Verb unchanged: same physics, same notes (`_music/songs.js`), same golden-wall catch (v1.js untouched).
Mechanic plan (levels.js, 30 rows, a purpose line each, sawtooth with a BOSS at 10/20/30):
 W1 MUSIC BOX 1-10: one ball, gold walls, shapes (circle/hex/square/pentagon), 2nd and 3rd balls; L1 cannot be lost (g .5), L3 first one that can fill.
 W2 GLASS HALL 11-20: pegs (free note, no growth), sour walls (grow x2.6, no note), a box that spins by itself, combined; boss = Mountain King in an octagon.
 W3 STARLIGHT 21-30: moon gravity, shrink stars floating in the box, all together; finale = Turkish rondo, four balls.
Round loop: finish the (part of the) tune before a ball fills the box; each song is a verse / chorus / whole tune (note ranges), 12-81 notes.
Skill layer: GOLD CHAIN (golden hit within 3.2 s of the last = GOLD x2, x3 ...; bigger shrink and score) -> x3 = FEVER 5 s (every wall counts a little golden, double score, flash, hit-stop, zoom punch). Sour wall breaks the chain.
Stars: 1 = song done, 2 = biggest ball stayed under s2 of the box, 3 = under s3 (thresholds from the sloppy / good bot in qa/tune.cjs, per level). Saved (d_stars).
Meta: level map (3 worlds, 10 nodes, stars, next pulsing, boss outline), 9 ball skins (one per 10 stars, the first free; pick on the map), best score.
Tomorrow hook: the Daily box button on the map (?daily=1: seeded pick from the unlocked levels, the same for everyone that day, kit streak); result card says "Tomorrow: a new Daily box · day N streak".
Feel: ball trail, hit-stop + zoom on FEVER, GOLD xN pops that grow, OUCH shake on a sour wall, peg ring pulses, star pickups burst, near-miss "SO CLOSE: n notes left", 3-star pop animation, Again button is one tap (no card in between levels).
Board: same meaning as v1 (Songs finished, +1 per song, limits unchanged).
QA: `node qa/sim.cjs <port>` (headless fast sim: good bot / sloppy bot / no input), `qa/tune.cjs` (sets g and star thresholds), `qa/shots.cjs` (phone screenshots + fps). Serve hc-games on a port. Needs chrome flags --use-angle=swiftshader --enable-unsafe-swiftshader.
Calibration (bot): good bot wins 75-100%, sloppy bot 50-90%, no input 0-60% (lucky golds). Levels 12, 22-24 saturate g (pegs/stars/spin carry the ball): feel check in the critic.
Left: fresh replay as a new player + critic (needs load < 24), then fix the lowest test; hand-play the bosses; READY true; ticket.
