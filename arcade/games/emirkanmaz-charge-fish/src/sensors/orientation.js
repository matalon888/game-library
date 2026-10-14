// Orientation sensor — normalises gamma to -1..+1 with EMA smoothing.

import { GAMMA, DEBUG } from '../config.js';
import * as Settings from '../settings.js';

let rawDegrees = 0;       // raw gamma in degrees (-90..+90)
let offsetDegrees = 0;    // calibration offset (the user's "neutral" pose)
let rawGamma = 0;         // normalised + offset-corrected, -1..+1
let smoothedGamma = 0;
let lastUpdateMs = performance.now();
let initialized = false;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function recomputeNormalized() {
  const corrected = rawDegrees - offsetDegrees;
  // Settings sensitivity narrows or widens the effective range.
  const sens = Settings.get().tiltSensitivity;
  const effectiveRange = GAMMA.RANGE_DEG / Math.max(0.1, sens);
  rawGamma = clamp(corrected, -effectiveRange, effectiveRange) / effectiveRange;
}

function setRawDegrees(deg) {
  rawDegrees = deg;
  recomputeNormalized();
}

function handleDeviceOrientation(event) {
  if (event.gamma == null) return;
  setRawDegrees(event.gamma);
}

function initManualGamma() {
  // Debug: arrow keys simulate device tilt on desktop.
  const KEY_STEP_DEG = GAMMA.RANGE_DEG;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') setRawDegrees(-KEY_STEP_DEG);
    else if (e.key === 'ArrowRight') setRawDegrees(KEY_STEP_DEG);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setRawDegrees(0);
  });
}

export function initOrientation() {
  if (initialized) return;
  initialized = true;
  if (DEBUG.manualGamma) {
    initManualGamma();
  } else {
    window.addEventListener('deviceorientation', handleDeviceOrientation);
  }
}

// iOS 13+ requires explicit permission for DeviceOrientation. Must be
// called from inside a user gesture (a button click handler). On Android
// and desktop the API doesn't expose requestPermission() and this is a
// no-op that resolves to true.
let permissionGranted = true;
let permissionRequested = false;

export function isOrientationPermissionRequired() {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  );
}

export async function ensureOrientationPermission() {
  if (permissionRequested) return permissionGranted;
  if (!isOrientationPermissionRequired()) {
    permissionRequested = true;
    return true;
  }
  try {
    const result = await DeviceOrientationEvent.requestPermission();
    permissionGranted = result === 'granted';
  } catch (err) {
    console.warn('[orientation] permission request failed:', err?.message);
    permissionGranted = false;
  }
  permissionRequested = true;
  return permissionGranted;
}

export function isOrientationPermitted() {
  return permissionGranted;
}

// EMA smoothing: each read converges toward the raw value at a rate
// determined by the time delta and SMOOTHING_MS time constant.
// alpha = 1 - exp(-dt / tau)
export function readGamma() {
  const now = performance.now();
  const dt = now - lastUpdateMs;
  lastUpdateMs = now;
  const alpha = 1 - Math.exp(-dt / GAMMA.SMOOTHING_MS);
  smoothedGamma += (rawGamma - smoothedGamma) * alpha;
  return smoothedGamma;
}

export function readRawGamma() {
  return rawGamma;
}

// Treat the current raw gamma as zero. Invoked automatically at game start
// and manually via the on-screen reset button.
export function calibrate() {
  offsetDegrees = rawDegrees;
  recomputeNormalized();
  smoothedGamma = 0;
}
