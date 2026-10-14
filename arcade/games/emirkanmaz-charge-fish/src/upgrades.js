// Persistent upgrades purchased with coins (1 coin per point scored).
// Each upgrade has a cost ladder; level N costs costs[N].
// Effects are read by config consumers via getMultiplier(upgradeId).

import * as Game from './game.js';
import { State } from './game.js';

const KEY = 'chargefishing_upgrades_v1';

export const UPGRADES = [
  {
    id: 'hitbox',
    titleKey: 'upgHitboxTitle',
    descKey: 'upgHitboxDesc',
    maxLevel: 4,
    costs: [50, 120, 300, 700],
    // effect: extra padding pixels per level
    effectPerLevel: 3,
  },
  {
    id: 'reel',
    titleKey: 'upgReelTitle',
    descKey: 'upgReelDesc',
    maxLevel: 3,
    costs: [80, 200, 450],
    // effect: % faster reel animation per level
    effectPerLevel: 0.12,
  },
  {
    id: 'spawn',
    titleKey: 'upgSpawnTitle',
    descKey: 'upgSpawnDesc',
    maxLevel: 3,
    costs: [60, 160, 380],
    // effect: spawn interval shrinks by this fraction per level
    effectPerLevel: 0.12,
  },
  {
    id: 'magnet',
    titleKey: 'upgMagnetTitle',
    descKey: 'upgMagnetDesc',
    maxLevel: 3,
    costs: [120, 300, 700],
    // effect: per-level pull radius added (px)
    effectPerLevel: 18,
  },
];

const DEFAULT_DATA = { coins: 0, levels: {}, lifetimeCoins: 0 };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_DATA };
    const parsed = JSON.parse(raw);
    return {
      coins: typeof parsed.coins === 'number' ? parsed.coins : 0,
      lifetimeCoins: typeof parsed.lifetimeCoins === 'number' ? parsed.lifetimeCoins : 0,
      levels: parsed.levels && typeof parsed.levels === 'object' ? parsed.levels : {},
    };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

let data = load();
const listeners = new Set();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

function notify() {
  for (const cb of listeners) cb();
}

export function getCoins() { return data.coins; }
export function getLifetimeCoins() { return data.lifetimeCoins; }
export function getLevel(id) { return data.levels[id] ?? 0; }

export function addCoins(amount) {
  data.coins += amount;
  data.lifetimeCoins += amount;
  save();
  notify();
}

export function canAfford(id) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return false;
  const lvl = getLevel(id);
  if (lvl >= def.maxLevel) return false;
  return data.coins >= def.costs[lvl];
}

export function purchase(id) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return false;
  const lvl = getLevel(id);
  if (lvl >= def.maxLevel) return false;
  const cost = def.costs[lvl];
  if (data.coins < cost) return false;
  data.coins -= cost;
  data.levels[id] = lvl + 1;
  save();
  notify();
  return true;
}

export function getEffect(id) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return 0;
  return def.effectPerLevel * getLevel(id);
}

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Wire to game catches — 1 coin per point. This runs alongside Game.addScore
// already happening at catch sites.
let lastScoreSeen = 0;
Game.subscribe((snap) => {
  // Resync on score resets (resetState() drops score to 0).
  if (snap.score < lastScoreSeen) {
    lastScoreSeen = snap.score;
    return;
  }
  const gained = snap.score - lastScoreSeen;
  // Sanity cap: any single jump > 200 is treated as a load anomaly.
  if (gained > 0 && gained < 200) addCoins(gained);
  lastScoreSeen = snap.score;
});
