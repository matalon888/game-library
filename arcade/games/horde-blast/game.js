// Horde Blast — picks the version to play.
// deep v2 (studio lane 12, 2026-10-29): 36 hand-made sieges in 3 worlds (Sand Fort, Frost Pass, Magma Keep) with flip gates,
// boulders, heavy and bomber reds, laser lanes, supply crates, a bomb button, stars per siege, a level map and a squad-colour
// collection from star chests (deep.js, levels.js, cal.js; plan in DESIGN.md). Half the arcade players get it (lab test
// deep-horde-blast); the rest play v1 (v1.js, the generated levels) unchanged.
// READY stays false until v2 is finished and has passed the fun gate: until then no player sees it (?deep=1 is QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-horde-blast')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
