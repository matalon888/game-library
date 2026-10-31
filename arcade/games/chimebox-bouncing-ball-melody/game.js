// Chimebox — picks the version to play.
// deep v2 (studio lane 20, 2026-10-31): 30 authored songs in 3 worlds (pegs, sour walls, a spinning box, moon gravity, shrink stars),
// gold chains and FEVER, stars, a level map, ball skins and a daily (deep.js, levels.js; plan in DESIGN.md). Half the arcade players get it
// (lab test deep-chimebox); the rest play v1 (v1.js, endless songs) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-chimebox')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
