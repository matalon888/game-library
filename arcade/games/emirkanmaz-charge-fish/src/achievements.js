// Achievements (badges). Definitions live here; tracking is by hooking
// into the existing event signals (catches, combos, survival time).

import { getStats } from './storage.js';
import * as Combo from './combo.js';
import * as Mode from './modes/mode.js';
import * as Game from './game.js';
import { State } from './game.js';

const KEY = 'chargefishing_achievements_v1';

// id, conditionKey + threshold, i18n title/desc keys
export const ACHIEVEMENTS = [
  { id: 'first-catch',   trigger: 'catches',      threshold: 1,   titleKey: 'achFirstCatchTitle',   descKey: 'achFirstCatchDesc'   },
  { id: 'ten-catches',   trigger: 'catches',      threshold: 10,  titleKey: 'achTenTitle',          descKey: 'achTenDesc'          },
  { id: 'fifty-catches', trigger: 'catches',      threshold: 50,  titleKey: 'achFiftyTitle',        descKey: 'achFiftyDesc'        },
  { id: 'first-golden',  trigger: 'goldenCatch',  threshold: 1,   titleKey: 'achGoldenTitle',       descKey: 'achGoldenDesc'       },
  { id: 'combo-5',       trigger: 'comboReached', threshold: 5,   titleKey: 'achCombo5Title',       descKey: 'achCombo5Desc'       },
  { id: 'combo-10',      trigger: 'comboReached', threshold: 10,  titleKey: 'achCombo10Title',      descKey: 'achCombo10Desc'      },
  { id: 'survived-60',   trigger: 'survivedMs',   threshold: 60000, titleKey: 'achSurvived60Title', descKey: 'achSurvived60Desc'   },
  { id: 'score-100',     trigger: 'scoreReached', threshold: 100, titleKey: 'achScore100Title',     descKey: 'achScore100Desc'     },
];

const unlocked = new Set();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) arr.forEach((id) => unlocked.add(id));
  } catch {}
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify([...unlocked])); } catch {}
}

load();

function unlock(id) {
  if (unlocked.has(id)) return;
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return;
  unlocked.add(id);
  save();
  for (const cb of listeners) cb(def);
}

export function onUnlock(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function isUnlocked(id) { return unlocked.has(id); }
export function unlockedIds() { return [...unlocked]; }

// --- Wire to game signals ---

Combo.subscribe((event) => {
  if (event.kind !== 'catch') return;
  if (event.streak >= 5) unlock('combo-5');
  if (event.streak >= 10) unlock('combo-10');
});

Game.subscribe((snapshot, prev) => {
  // Watch for caught state with a hooked fish to detect catches.
  if (snapshot.state === State.REELING && prev !== State.REELING && snapshot.reelReason === 'caught') {
    const fish = snapshot.hookedFish;
    if (fish?.type?.rarity === 'rare') unlock('first-golden');
  }
  if (snapshot.score >= 100) unlock('score-100');
});

Mode.subscribe((_mode, status) => {
  if (status?.isOver && status.survivedMs >= 60000) unlock('survived-60');
});

// Catch-count milestones are checked from getStats() periodically (storage
// is updated lazily by the catch sites).
setInterval(() => {
  const total = getStats().totalCatches;
  if (total >= 1) unlock('first-catch');
  if (total >= 10) unlock('ten-catches');
  if (total >= 50) unlock('fifty-catches');
}, 1000);
