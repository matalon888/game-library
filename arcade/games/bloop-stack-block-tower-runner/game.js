// Bloop Stack — picks the version to play.
// deep v2 (studio lane 14/4, 2026-10-31): 36 hand-made levels in 3 worlds, stars, a level map, hats (deep.js, levels.js, sim.js; plan in DESIGN.md).
// Half the arcade players get it (lab test deep-bloop-stack); the rest play v1 (v1.js) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-bloop-stack')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
