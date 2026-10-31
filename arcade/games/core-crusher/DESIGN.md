# Core Crusher deep v2 (lane 20, 2026-10-31) — status: built, READY=false, fun gate not run yet
Data (7 d, 37 visits): median 39 s, players die around level 5-9 of an endless chain, 6 quit <15 s, ~0 come back.
Layers today (v1): verb 2 (hold/release timing, fire), loop 1 (one tower, same each time), levels 0 (seeded random), meta 0, feel 2. v2 target: 3/3/3/3/3.
Verb unchanged: hold = smash, release = bounce, black kills unless on fire (physics numbers are v1's; flow.k() still scales spin).
Mechanic plan (levels.js, 30 towers, section strings, purpose per level): W1 CANDY HILL black, gold, flame, spiral, reversals (boss 10);
W2 NEON DUNES holes (free fall, THREADED), blinkers (purple safe / flash / black), faster reversals (boss 20); W3 SHADOW CORE steel (stops even fire), all at once (boss 30).
Levels 31+ generated (genLevel). Daily Dive = generated tower of the day (+3 chest stars, streak).
Meta: stars (1 clear, 2 no crash, 3 no crash and under par time from pars.js), level map with 3 worlds, chest every 6 stars -> 11 ball skins (variable reward), 3 daily goals (+1 chest star each).
Feel: speed lines + fov kick on hold, camera shake, hit-stop, rising smash pitch, GOLD / FLAME / CLOSE CALL / THREADED / combo callouts (10/20/35), crash card names the cause + SO CLOSE, retry in one tap.
First 3 levels: L1-2 have mercy bounces ("PHEW! SAVED"), new players start inside L1 with the demo hand, no menu.
QA: qa/playall.cjs (bot, no drawing; MARGIN=12 = sloppy human): all 30 won 3/3 at margin 1.5, 6 and 12; shots.cjs, cards.cjs for phone/desktop screens.
Board: WB.submit(1) per tower cleared, same meaning as v1.
Left: replay fresh, critic gate (FUN_REVIEW.md), fps check, desktop play shot, READY true, ticket.
