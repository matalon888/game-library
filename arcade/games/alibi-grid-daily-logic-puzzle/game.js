// Alibi Grid — picks the version to play.
// deep v2 (studio lane 19, 2026-10-29): 30 hand-drawn cases in 3 worlds (Maple Street, Harbor Docks, Grand Hotel where
// criminals lie), stars, evidence stickers, ranks, a case map, hints earned by clean solves (deep.js, levels.js; plan in
// DESIGN.md). Half the arcade players get it (lab test deep-alibi-grid); the rest play v1 (v1.js) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-alibi-grid')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
