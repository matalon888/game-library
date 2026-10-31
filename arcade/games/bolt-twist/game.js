// Bolt Twist — picks the version to play.
// deep v2 (studio lane 25, 2026-10-29): 30 hand-built toys in 3 worlds (Toy Shop, Workshop, Factory), gold keys and padlocked
// bolts, ice bolts, a box preview, stars for clean parking, a toy map, a sticker shelf and bolt paints (deep.js, levels.js,
// blogic.js; plan in DESIGN.md). Half the arcade players get it (lab test deep-bolt-twist); the rest play v1 (v1.js) unchanged.
// READY true: shipped as a real-player test (FUN_REVIEW.md Verdict: TEST); ?deep=1 forces v2.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-bolt-twist')) || /[?&]deep=1(&|$)/.test(location.search);
import(DEEP ? './deep.js' : './v1.js');
