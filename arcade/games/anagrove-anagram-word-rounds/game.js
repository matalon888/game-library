// Anagrove — picks the version to play.
// deep v2 (studio lane 24, 2026-10-29): 30 hand-picked rounds in 3 groves with goals, stars, a grove map and a tree collection
// (deep.js, levels.js; plan in DESIGN.md). Half the arcade players get it (lab test deep-anagrove); the rest play v1 (v1.js) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-anagrove')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
