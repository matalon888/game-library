// Offline support. Shell: network first (updates show up), cached fallback.
// Game files: cache first, filled the first time a game is played, so played games work offline.
const V = 'arcade-v1';
const SHELL = ['./', 'index.html', 'play.html', 'arcade.css', 'shell.js', 'games.json', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isGame = u.origin === location.origin && (u.pathname.includes('/games/') || u.pathname.includes('/thumbs/'));
  if (isGame) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); }
      return r;
    })));
  } else if (u.origin === location.origin || u.host.endsWith('gstatic.com') || u.host.endsWith('googleapis.com')) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: u.pathname.endsWith('play.html') })));
  }
});
