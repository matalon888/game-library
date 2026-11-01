// Dust Descent entry: v1 (the original) or v2 ("deep": 30 authored descents in 3 worlds, flow chain, tricks, stars, map, bike garage,
// daily descent). READY stays false while v2 is built; ?deep=1 / ?deep=0 force an arm for QA only.
import { ab } from './kit/xp.js';
const READY = true;
const Q = new URLSearchParams(location.search).get('deep');
const DEEP = Q === '1' ? true : Q === '0' ? false : (READY && ab('deep-dust-descent'));
if (DEEP) await import('./deep.js'); else await import('./v1.js');
