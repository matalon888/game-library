/* ============================================================
   storage.js — localStorage wrapper that never throws.
   Safe in private mode / disabled storage; versioned key.
   ============================================================ */

const KEY = "minesweeper.caldera.v1";

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}

export function get(field, fallback) {
  const all = readAll();
  return field in all ? all[field] : fallback;
}

export function set(field, value) {
  const all = readAll();
  all[field] = value;
  return writeAll(all);
}

export function clear() {
  try { localStorage.removeItem(KEY); return true; } catch { return false; }
}
