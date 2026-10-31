// Ring Peel — picks the version to play.
// deep v2 (studio lane 25, 2026-10-31): 30 hand-made piers in 3 worlds (Harbor Pier, Sunset Reef, Storm Dock), armored / bomb / gold
// rings, blinking shutters and gate rings, FEVER, near-miss grazes, stars (no crash + under par), a pier map, ball skins and daily
// goals (deep.js, levels.js, gmath.js; plan in DESIGN.md). Half the arcade players get it (lab test deep-ring-peel); the rest play v1.
// READY false while it is being built: ?deep=1 forces v2 for testing.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-ring-peel')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
