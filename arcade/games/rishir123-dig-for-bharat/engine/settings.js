/* ============================================================
   Settings, stored on the machine and applied live.
   ============================================================ */
const KEY = "dig-for-bharat/settings/v1";

export const DEFAULTS = {
  master: 0.85, music: 0.5, sfx: 0.9,
  sensitivity: 2.2,          // x1000, applied to raw mouse delta
  fov: 75,
  invertY: false,
  renderDistance: 82,        // metres before fog closes
  headBob: true,
  showFps: false,
  crackOverlay: true,
  music_on: true,
  lang: "en"
};

export const RANGES = {
  master: [0, 1, 0.01], music: [0, 1, 0.01], sfx: [0, 1, 0.01],
  sensitivity: [0.4, 6, 0.1], fov: [60, 100, 1], renderDistance: [40, 140, 2]
};

const listeners = new Set();
export const settings = load();

function load() {
  const s = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      for (const k of Object.keys(DEFAULTS)) if (k in d) s[k] = d[k];
    }
  } catch (e) {}
  return s;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {}
}
export function set(key, value) {
  if (!(key in DEFAULTS)) return;
  settings[key] = value;
  save();
  for (const fn of listeners) fn(key, value);
}
export function reset() {
  Object.assign(settings, DEFAULTS);
  save();
  for (const fn of listeners) fn("*", null);
}
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
