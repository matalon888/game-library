// Stretch Dash — picks the version to play.
// deep v2 (studio lane 3, 2026-10-29): 30 hand-made levels in 3 worlds, stars on the stairs, a level map, a jelly wardrobe
// filled by gem chests, combos and Jelly Rush (deep.js, levels.js; plan in DESIGN.md). Half the arcade players get it
// (lab test deep-stretch-dash); the rest play v1 (v1.js, the generated runs) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-stretch-dash')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
