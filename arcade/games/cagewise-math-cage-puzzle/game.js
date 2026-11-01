// Cagewise — entry. v1 is the original endless puzzle (v1.js). v2 (deep.js) adds a 30-level campaign with stars, hidden-sign
// cages, a chest/theme collection and a daily streak. READY stays false until the fun critic passes; ?deep=1 forces v2 for QA.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-cagewise')) || /[?&]deep=1(&|$)/.test(location.search);
if (DEEP) await import('./deep.js'); else await import('./v1.js');
