// Think Twice! — picks the version to play.
// deep v2 (studio lane 4, 2026-11): level map in 4 worlds, stars, Pip's hat collection, daily trick, 40 levels (deep.js, levels2.js; plan in DESIGN.md).
// Half the arcade players get it (lab test deep-think-twice); the rest play v1 (v1.js) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-think-twice')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
