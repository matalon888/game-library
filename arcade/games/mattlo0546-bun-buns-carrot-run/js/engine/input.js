/**
 * Keyboard input system with support for held keys and single-frame presses.
 * Also supports mouse/touch click as a substitute for Enter.
 */
const keys = {};
const justPressed = {};
let _enabled = true;

const PREVENT_DEFAULT_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (!_enabled) return;
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
    if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Click/tap on canvas acts as Enter (for starting/restarting)
  document.addEventListener('click', () => {
    if (!_enabled) return;
    justPressed['Enter'] = true;
  });

  document.addEventListener('touchstart', () => {
    if (!_enabled) return;
    justPressed['Enter'] = true;
  });
}

/** Enable or disable all game input. Call with false when showing UI overlays. */
export function setInputEnabled(enabled) {
  _enabled = enabled;
  if (!enabled) {
    // Flush held keys so nothing stays "stuck" while input is off
    for (const k in keys) keys[k] = false;
    for (const k in justPressed) justPressed[k] = false;
  }
}

/** Check if a key is currently held down. */
export function isDown(code) {
  return _enabled && !!keys[code];
}

/** Check if a key was pressed this frame (single-fire). Consumes the press. */
export function wasPressed(code) {
  const v = _enabled && !!justPressed[code];
  justPressed[code] = false;
  return v;
}

/** Clear all single-frame presses. Call at end of each game loop tick. */
export function clearJustPressed() {
  for (const k in justPressed) justPressed[k] = false;
}

/** Simulate a key being pressed down (for mobile controls). */
export function pressKey(code) {
  if (!_enabled) return;
  if (!keys[code]) justPressed[code] = true;
  keys[code] = true;
}

/** Simulate a key being released (for mobile controls). */
export function releaseKey(code) {
  keys[code] = false;
}
