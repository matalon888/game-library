/* ============================================================
   sw.js — minimal cache-first service worker for offline play.
   Bump CACHE when shipping changes to invalidate old assets.
   ============================================================ */

const CACHE = "caldera-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
  "./src/leaderboard.js",
  "./styles/tokens.css",
  "./styles/base.css",
  "./styles/layout.css",
  "./styles/board.css",
  "./styles/animations.css",
  "./styles/extras.css",
  "./src/main.js",
  "./src/engine.js",
  "./src/board.js",
  "./src/render.js",
  "./src/input.js",
  "./src/timer.js",
  "./src/storage.js",
  "./src/settings.js",
  "./src/stats.js",
  "./src/solver.js",
  "./src/confetti.js",
  "./src/ui.js",
  "./src/metrics.js",
  "./src/generate.js",
  "./src/daily.js",
  "./src/sound.js",
  "./src/achievements.js",
  "./src/share.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // let cross-origin requests (Supabase API, esm.sh CDN) go straight to network
  if (url.origin !== location.origin) return;
  // never cache runtime config — it carries env-injected keys that may change
  if (url.pathname.endsWith("/config.js")) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }
  e.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html"))
    )
  );
});
