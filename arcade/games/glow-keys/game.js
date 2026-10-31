// Glow Keys — v1 (original run) and deep v2 (studio, 2026-10-31): 33 hand-arranged levels in 3 worlds, hearts, stars from timing,
// golden tiles, double tiles, ghost tiles, a map, tile skins and a daily melody. Half the arcade players get v2 (lab test
// deep-glow-keys). READY stays false until v2 is finished and checked: until then no player sees it (?deep=1 is for QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-glow-keys')) || /[?&]deep=1(&|$)/.test(location.search);
if (DEEP) import('./deep.js'); else import('./v1.js');
