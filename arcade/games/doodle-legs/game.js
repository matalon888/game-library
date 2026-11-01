// Doodle Legs — picks the version to play.
// deep v2 (studio lane 38, 2026-10-31): 30 authored races in 3 worlds, gaps, gems, stars, a map, hats, a daily race (deep.js; plan in DESIGN.md).
// Half the arcade players get it once the fun gate passes (lab test deep-doodle-legs); the rest play v1 (v1.js) unchanged.
// READY true: fun gate Verdict TEST 2026-11-01; ?deep=1 forces v2.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-doodle-legs')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
