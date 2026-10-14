// Screen Wake Lock — prevents the screen from sleeping during play.
// The lock is released automatically when the tab is hidden; we re-acquire
// it when the tab becomes visible again.

let lock = null;
let wantActive = false;

async function acquire() {
  if (!('wakeLock' in navigator)) return;
  if (lock) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => {
      lock = null;
    });
  } catch (err) {
    console.warn('[wakelock] acquire failed:', err.message);
  }
}

function release() {
  if (lock) {
    lock.release().catch(() => {});
    lock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (wantActive && document.visibilityState === 'visible') {
    acquire();
  }
});

export async function enableWakeLock() {
  wantActive = true;
  await acquire();
}

export function disableWakeLock() {
  wantActive = false;
  release();
}
