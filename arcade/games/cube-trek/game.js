// Cube Trek — switch between the old game (v1.js) and deep v2 (deep.js: 30 authored quests, ice, bombs, stars, map).
// A/B test deep-cube-trek decides for each player; READY stays false until the fun gate passes (?deep=1 forces v2 for QA).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-cube-trek')) || new URLSearchParams(location.search).get('deep') === '1';
await import(DEEP ? './deep.js' : './v1.js');
