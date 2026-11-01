// Blubbo loader: v1 (care + endless mini-games) or v2 (deep.js: 30 trips, stars, gift boxes). READY stays false until v2 is
// finished and checked: until then no player sees it (?deep=1 works on 127.0.0.1 for QA only).
import { ab } from './kit/xp.js';
const READY = true;
const Q = location.search, local = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
const forced = /[?&]deep=1(&|$)/.test(Q) && (READY || local);
const DEEP = (READY && ab('deep-blubbo')) || forced;
import(DEEP ? './deep.js' : './v1.js');
