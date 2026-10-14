// User preferences persisted in localStorage. Defaults bias toward
// accessibility-on (everything enabled).

const KEY = 'chargefishing_settings_v1';

const DEFAULTS = Object.freeze({
  soundOn: true,
  hapticOn: true,
  colorBlind: false,
  // Sensitivity multiplier for gamma. 1.0 = default. Higher = more sensitive.
  tiltSensitivity: 1.0,
});

let current = { ...DEFAULTS };
const subscribers = new Set();

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      current = {
        soundOn: typeof parsed.soundOn === 'boolean' ? parsed.soundOn : DEFAULTS.soundOn,
        hapticOn: typeof parsed.hapticOn === 'boolean' ? parsed.hapticOn : DEFAULTS.hapticOn,
        colorBlind: typeof parsed.colorBlind === 'boolean' ? parsed.colorBlind : DEFAULTS.colorBlind,
        tiltSensitivity: typeof parsed.tiltSensitivity === 'number'
          ? clamp(parsed.tiltSensitivity, 0.5, 2.0)
          : DEFAULTS.tiltSensitivity,
      };
    }
  } catch {}
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {}
}

function notify() {
  for (const cb of subscribers) cb(current);
}

load();

export function get() {
  return { ...current };
}

export function set(key, value) {
  if (!(key in DEFAULTS)) return;
  if (key === 'tiltSensitivity') value = clamp(value, 0.5, 2.0);
  current[key] = value;
  save();
  notify();
}

export function toggle(key) {
  if (typeof current[key] !== 'boolean') return;
  set(key, !current[key]);
}

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function reset() {
  current = { ...DEFAULTS };
  save();
  notify();
}
