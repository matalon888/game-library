// Liftoff Lab. v1 (agents build and launch rockets) always runs. v2 ("Mission Control", studio 2026-10-31) adds 30 flown
// missions on top of it, playable with or without agents. Half the arcade players get it (lab test deep-agent-rockets).
// READY stays false until v2 is finished and checked: until then no player sees it (?deep=1 is for QA only).
import { ab } from './kit/xp.js';
const READY = true;
const DEEP = (READY && ab('deep-agent-rockets')) || /[?&]deep=1(&|$)/.test(location.search);
if (DEEP) { const st = document.createElement('style'); st.textContent = 'body>*:not(#mx):not(script):not(style){visibility:hidden!important}'; document.head.appendChild(st); }
await import('./v1.js');
if (DEEP) await import('./deep.js');
