// Blokko — picks the version to play.
// deep v2 (studio lane 13, 2026-10-29): 36 hand-shaped levels in 3 worlds (Candy Corner, Mystery Attic, Boom Factory) with gold,
// hidden-arrow, bomb and stone cubes, par taps and stars, a level map, a cube-skin collection and hints (deep.js, levels.js,
// logic.js; plan in DESIGN.md). Half the arcade players get it (lab test deep-blokko); the rest play v1 (v1.js) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-blokko')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
