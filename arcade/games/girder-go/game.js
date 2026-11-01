// Girder Go — picks the version to play.
// deep v2 (studio lane 3, 2026-11): 36 hand-made crossings in 3 worlds, stars, a level map, a garage of vehicles, a daily bridge (deep.js, levels2.js; plan in DESIGN.md).
// Half the arcade players get it (lab test deep-girder-go); the rest play v1 (v1.js) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-girder-go')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
