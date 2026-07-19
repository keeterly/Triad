// KIZUNA service worker.  Its main job is to make the game INSTALLABLE on
// Android (Chrome surfaces "Install app" only when there's a fetch handler +
// proper PNG icons).  It's deliberately NETWORK-FIRST, and it never serves a
// stale document or version.json — so an online player always gets the freshest
// build and the in-game auto-update keeps working — while still giving an
// offline fallback from the last-seen cache.
const CACHE = 'kizuna-rt-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // The update-check must always hit the network (no-store already, but be sure).
  if (url.pathname.endsWith('version.json')) return;
  // Everything else: network-first (fresh when online), cache fallback when not.
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok && url.origin === self.location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});
