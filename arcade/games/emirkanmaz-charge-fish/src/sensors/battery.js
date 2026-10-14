// Battery sensor with automatic tap-to-toggle fallback.
// When the Battery Status API is unavailable (iOS Safari, Firefox, etc.),
// taps on the game area toggle the charging state instead. The tap
// listener is only active while the game screen is showing — UI taps on
// menu / settings / game-over screens are isolated by setListenerEnabled.

import { DEBUG } from '../config.js';

const subscribers = new Set();
let currentCharging = false;
let usingFallback = false;
let listenerActive = false;

function notify() {
  for (const cb of subscribers) cb(currentCharging);
}

async function initRealBattery() {
  if (!('getBattery' in navigator)) {
    throw new Error('Battery API not available');
  }
  const battery = await navigator.getBattery();
  currentCharging = battery.charging;
  battery.addEventListener('chargingchange', () => {
    currentCharging = battery.charging;
    notify();
  });
}

function handleTap(e) {
  if (!listenerActive) return;
  // Defensive: ignore taps that originated on any HTML control. The game
  // canvas is always the bottom layer; anything else is UI.
  if (e.target && e.target.tagName !== 'CANVAS' && e.target.id !== 'game-canvas') return;
  currentCharging = !currentCharging;
  notify();
}

function initTapFallback() {
  window.addEventListener('pointerdown', handleTap);
  usingFallback = true;
}

let initPromise = null;

export function initBattery() {
  if (initPromise) return initPromise;
  if (DEBUG.fakeCharging) {
    initTapFallback();
    initPromise = Promise.resolve();
    return initPromise;
  }
  initPromise = initRealBattery().catch((err) => {
    console.warn('[battery] Falling back to tap-to-toggle:', err.message);
    initTapFallback();
  });
  return initPromise;
}

// main.js calls this when entering / leaving the game screen so taps on
// menu and overlay screens don't accidentally toggle charging.
export function setListenerEnabled(enabled) {
  listenerActive = enabled;
  if (!enabled) currentCharging = false; // resync to a known state
}

export function subscribeCharging(callback) {
  subscribers.add(callback);
  callback(currentCharging);
  return () => subscribers.delete(callback);
}

export function isCharging() {
  return currentCharging;
}

export function isUsingFallback() {
  return usingFallback;
}
