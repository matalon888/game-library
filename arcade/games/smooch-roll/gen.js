// gen.js — module worker: solves upcoming levels off the main thread so level changes never stutter.
import { makeLevel } from './levels.js';
self.onmessage = (e) => { const n = e.data; self.postMessage({ n, L: makeLevel(n) }); };
