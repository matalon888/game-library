// Rack Attack — picks the version to play.
// deep v2 (studio lane 20, 2026-10-29): a tour of 36 hand-made tables in 3 worlds (trick tables + duels vs nine rivals), table
// gimmicks (posts, order rule, corked pockets, ice, bumpers, mud), stars, a level map, a cue case (deep.js, levels.js, phys.js;
// plan in DESIGN.md). Half the arcade players get it (lab test deep-rack-attack); the rest play v1 (v1.js) unchanged.
// READY true: shipped as a real-player test (Verdict: TEST in FUN_REVIEW.md, round 2 avg 7.7, none under 7); ?deep=1 forces v2.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-rack-attack')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
