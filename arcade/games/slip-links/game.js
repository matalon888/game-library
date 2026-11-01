// Slip Links — picks the version to play.
// deep v2 (studio lane 2, 2026-11-01): 30 authored knots in 3 worlds (Pond, Snowfield, Shore), padlock / gold / spark chains,
// stars, a level map, chests that unlock chain paints, a daily knot with a streak (deep.js, levels.js; plan in DESIGN.md).
// READY false while it is being built: players only get v1 (v1.js). ?deep=1 forces v2 for QA.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-slip-links')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
