// Bumperlark — picks the version to play.
// deep v2 (studio lane 20, 2026-10-31): 30 authored missions in 3 tables (hot bumper, moving bumper, armored targets), stars, a
// mission map, a feather collection that unlocks ball skins (deep.js, levels.js; plan in DESIGN.md). Half the arcade players get it
// (lab test deep-bumperlark) once READY is true; the rest play v1 (v1.js) unchanged. ?deep=1 forces v2 for QA.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-bumperlark')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
