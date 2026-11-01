// Pose Rush — picks the version to play.
// deep v2 (studio lane 4, 2026-11): 36 hand-made levels in 3 worlds, stars, a level map, outfits, a daily gauntlet (deep.js, levels.js; plan in DESIGN.md).
// Half the arcade players get it (lab test deep-pose-rush); the rest play v1 (v1.js) unchanged.
// READY true since 2026-11-01 (Verdict TEST); was false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-pose-rush')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
