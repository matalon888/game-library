// Bonk Brawl — picks the version to play.
// deep v2 (studio lane 31, 2026-10-29): 30 hand-made arenas in 3 worlds, shields, curveballs, bank shots, catches, golden balls,
// pillars, conveyor belts, 3 bosses, stars + a level map + a closet of outfits (deep.js, levels.js; plan in DESIGN.md).
// Half the arcade players get it (lab test deep-bonk-brawl); the rest play v1 (v1.js, endless generated levels) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-bonk-brawl')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
