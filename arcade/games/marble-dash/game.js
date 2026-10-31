// Marble Dash — picks the version: v1 (original) or deep v2 (30 authored courses, worlds, stars, balls). READY stays false until v2 is checked.
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-marble-dash')) || /[?&]deep=1(&|$)/.test(location.search);
if (DEEP) await import('./deep.js'); else await import('./v1.js');
