// ai-worker.js — runs the Stonerow CPU off the main thread so the board never freezes. Our own code, MIT.
import { think } from './engine.js';
onmessage = (e) => { let move = null; try { move = think(e.data.payload); } catch (err) { move = null; } postMessage({ id: e.data.id, move }); };
