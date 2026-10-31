// Sticky Nook entry: v1 (the original) or v2 ("deep": 30 authored rooms, chain, stars, album). READY stays false while v2 is built;
// ?deep=1 / ?deep=0 force an arm for QA only.
import { ab } from './kit/xp.js';
const READY = true;
const Q = new URLSearchParams(location.search).get('deep');
const DEEP = Q === '1' ? true : Q === '0' ? false : (READY && ab('deep-sticky-nook'));
if (DEEP) await import('./deep.js'); else await import('./v1.js');
