// Beatbuds entry: v1 (the sandbox beat maker) or deep v2 "Band Tour" (30 gigs, 3 worlds). READY stays false until v2 passes the fun gate.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = /[?&]deep=1/.test(location.search) || (READY && ab('deep-beatbuds'));
if (DEEP) await import('./deep.js'); else await import('./v1.js');
