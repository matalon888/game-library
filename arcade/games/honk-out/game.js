// Honk Out! — picks the version to play.
// deep v2 (studio lane 33, 2026-10-31): 30 hand-drawn car parks in 3 worlds, taxis, sleepy cars, a rainbow bus, 4 spots in world 3, stars, a
// hop booster, a town map with stickers and paints, a daily rush (deep.js, levels.js, blogic.js; plan in DESIGN.md). Half the arcade players
// get it once the fun gate passes (lab test deep-honk-out); the rest play v1 (v1.js) unchanged. READY false while it is being built; ?deep=1 forces v2.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-honk-out')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
