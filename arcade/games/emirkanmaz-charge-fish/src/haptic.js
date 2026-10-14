// Haptic feedback helper. Wraps navigator.vibrate with a settings check
// so a single toggle in settings disables every call site.

import * as Settings from './settings.js';

function vib(pattern) {
  if (!Settings.get().hapticOn) return;
  if (!('vibrate' in navigator)) return;
  try { navigator.vibrate(pattern); } catch {}
}

export const Haptic = {
  bite()    { vib(40); },
  catchSmall() { vib([30, 40, 60]); },
  catchBig()   { vib([40, 50, 90, 50, 90]); },
  escape()  { vib([20, 30, 20]); },
  cast()    { vib(15); },
  splash()  { vib(20); },
  off()     { try { navigator.vibrate(0); } catch {} },
};
