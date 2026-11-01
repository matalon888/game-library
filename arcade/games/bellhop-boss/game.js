// Bellhop Boss — picks the version to play. v1 = v1.js (unchanged); deep v2 = deep.js + levels.js (30 hotels, plan in DESIGN.md).
// READY false while v2 is in the studio; ?deep=1 forces v2 for QA.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-bellhop-boss')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
