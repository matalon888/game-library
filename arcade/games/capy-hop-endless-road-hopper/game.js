// Capy Hop — picks the version to play.
// deep v2 (studio lane 33, 2026-10-31): 30 hand-made crossings in 3 worlds (Sunny Streets, Lazy River, Rail Yard), stars, a hat collection,
// a daily dash with a streak, and the endless run on the map (deep.js, levels.js; plan in DESIGN.md). Half the arcade players get it
// once the fun gate passes (lab test deep-capy-hop); the rest play v1 (v1.js) unchanged. READY false while it is being built; ?deep=1 forces v2.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-capy-hop')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
