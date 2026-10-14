// Daily quest. One quest per day, deterministically chosen by date so the
// same quest is shown all day. Progress persists in localStorage; resets
// when the day changes.

import { recordCatch } from './storage.js';
import * as Game from './game.js';
import { State } from './game.js';

const KEY = 'chargefishing_quest_v1';

export const QUESTS = [
  { id: 'catch10', kind: 'catches',       target: 10, reward: 25, titleKey: 'questCatch10Title' },
  { id: 'catch20', kind: 'catches',       target: 20, reward: 60, titleKey: 'questCatch20Title' },
  { id: 'golden1', kind: 'goldenCatches', target: 1,  reward: 30, titleKey: 'questGolden1Title' },
  { id: 'score50', kind: 'singleRunScore',target: 50, reward: 40, titleKey: 'questScore50Title' },
];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function hashStringToInt(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function loadOrInit() {
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { data = {}; }
  const today = todayKey();
  if (data.day !== today) {
    const quest = QUESTS[hashStringToInt(today) % QUESTS.length];
    data = { day: today, questId: quest.id, progress: 0, completed: false, claimedBonus: 0 };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }
  return data;
}

let state = loadOrInit();
const listeners = new Set();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

function notify(event) {
  for (const cb of listeners) cb(event);
}

export function getQuest() {
  return QUESTS.find((q) => q.id === state.questId) ?? QUESTS[0];
}

export function getProgress() {
  return { progress: state.progress, completed: state.completed, target: getQuest().target };
}

function bump(amount = 1) {
  if (state.completed) return;
  const quest = getQuest();
  state.progress = Math.min(quest.target, state.progress + amount);
  if (state.progress >= quest.target) {
    state.completed = true;
    state.claimedBonus = quest.reward;
    save();
    Game.addScore(quest.reward);
    notify({ kind: 'complete', quest });
  } else {
    save();
    notify({ kind: 'progress', quest, progress: state.progress });
  }
}

let runHighScore = 0;

Game.subscribe((snap, prev) => {
  // Track caught reels.
  if (snap.state === State.REELING && prev !== State.REELING && snap.reelReason === 'caught') {
    const q = getQuest();
    if (q.kind === 'catches') bump(1);
    if (q.kind === 'goldenCatches' && snap.hookedFish?.type?.rarity === 'rare') bump(1);
  }
  // Track single-run score quests.
  if (snap.score > runHighScore) {
    runHighScore = snap.score;
    const q = getQuest();
    if (q.kind === 'singleRunScore' && runHighScore >= q.target && !state.completed) {
      bump(q.target);
    }
  }
  // Reset run-score tracking when returning to IDLE from REELING (round end).
  if (snap.state === State.IDLE && prev !== State.IDLE) {
    runHighScore = snap.score;
  }
});

export function onQuestEvent(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
