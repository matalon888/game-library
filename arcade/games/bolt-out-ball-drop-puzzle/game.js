// Bolt Out — picks the version to play.
// deep v2 (studio lane 15, 2026-10-29): 36 hand-made vessels in 3 worlds (Garage, Lab, Foundry) with goo, twin bolts, padlocked
// bolts and merging lanes, three stars per vessel (cleared / no mistake / quick), a level map, a jar shelf unlocked by stars, hints
// (deep.js, levels.js, logic.js; plan in DESIGN.md). Half the arcade players get it (lab test deep-bolt-out); the rest play v1
// (v1.js, the generated vessels) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-bolt-out')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
