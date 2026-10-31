// Core Crusher — picks the version to play.
// deep v2 (studio lane 20, 2026-10-31): 30 hand-made towers in 3 worlds (gold, flame, holes, blinkers, steel), stars, a level map,
// chests that unlock ball skins, daily goals (deep.js, levels.js; plan in DESIGN.md). Half the arcade players get it (lab test
// deep-core-crusher) once READY is true; the rest play v1 (v1.js) unchanged. ?deep=1 forces v2 for QA.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-core-crusher')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
