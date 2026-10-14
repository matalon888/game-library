// ChargeFish service worker — cache-first for the static app shell.
// Bump CACHE_NAME when shipping a release so old caches are evicted.

const CACHE_NAME = 'chargefish-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-maskable.svg',
  './src/main.js',
  './src/config.js',
  './src/i18n.js',
  './src/game.js',
  './src/storage.js',
  './src/settings.js',
  './src/catch.js',
  './src/events.js',
  './src/combo.js',
  './src/achievements.js',
  './src/quests.js',
  './src/upgrades.js',
  './src/haptic.js',
  './src/modes/mode.js',
  './src/sensors/battery.js',
  './src/sensors/orientation.js',
  './src/sensors/wakelock.js',
  './src/audio/audio.js',
  './src/render/renderer.js',
  './src/render/scene.js',
  './src/render/rod.js',
  './src/render/ui.js',
  './src/render/depthMeter.js',
  './src/render/particles.js',
  './src/render/timer.js',
  './src/render/weather.js',
  './src/render/comboOverlay.js',
  './src/render/toast.js',
  './src/entities/fish.js',
  './src/entities/fishSpawner.js',
  './src/entities/fishTypes.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Failure of any single asset shouldn't abort the install — addAll is
      // strict, so we addAll-with-fallback to individual puts.
      Promise.all(SHELL.map((url) =>
        fetch(url, { cache: 'no-cache' })
          .then((r) => (r.ok ? cache.put(url, r) : null))
          .catch(() => null),
      )),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Only handle same-origin requests; bypass anything cross-origin.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((resp) => {
        // Opportunistically cache successful responses for next time.
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return resp;
      }).catch(() => cached),
    ),
  );
});
