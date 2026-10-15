// ponytail: runtime cache-first for everything (app shell + CDN JS/WASM).
// Model weights are cached separately by WebLLM itself via the Cache API.
const CACHE = "offline-llm-v9";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "index.html", "game.html", "engine.js", "manifest.json"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("offline-llm-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

// Only cache the app shell + CDN JS/WASM. Model weights (huggingface.co etc.)
// are cached by WebLLM/wllama themselves — don't double-store hundreds of MB.
const CACHEABLE = ["localhost", "127.0.0.1", "cdn.jsdelivr.net", "esm.run"];

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || !CACHEABLE.includes(new URL(e.request.url).hostname)) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
