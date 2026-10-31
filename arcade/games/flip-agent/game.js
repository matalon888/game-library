// Flip Agent — picks the version to play.
// deep v2 (studio lane 23, 2026-10-29): 30 hand-made missions in 3 worlds, mission stars, shield goons and bosses, a level map,
// agent suits (deep.js, levels.js; plan in DESIGN.md). Half the arcade players get it (lab test deep-flip-agent); the rest play v1
// (v1.js, the generated levels) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-flip-agent')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
