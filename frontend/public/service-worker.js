// Hand-written (no Workbox/eject) — deliberately simple runtime caching,
// not a build-time precache manifest, since that would need ejecting CRA
// or adding a webpack plugin just to inject hashed filenames. The tradeoff:
// the app shell (the hashed JS/CSS bundle) is cached opportunistically on
// first load rather than pre-populated at install time. After that first
// visit, it behaves exactly like a precached shell.
//
// Caching rules, by request type:
//  - /api/*            -> NEVER touched here (live numbers only, no stale cache)
//  - navigation (HTML) -> network-first, falls back to the cached shell offline
//  - everything else   -> cache-first, with a background fetch to refresh the cache
//
// Update flow: a new service worker install does NOT auto-activate over an
// existing one (no skipWaiting() in `install`) — it waits until the page
// explicitly confirms via postMessage (see src/pwa.js's update-available
// flow), so a customer mid-session never gets silently switched to a new
// build underneath them.
const SHELL_CACHE = 'ecocompute-shell-v1';
const RUNTIME_CACHE = 'ecocompute-runtime-v1';
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json', '/favicon.ico', '/logo192.png', '/logo512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.warn('Service worker precache failed (non-fatal):', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // don't intercept cross-origin (fonts CDN, etc.)
  if (url.pathname.startsWith('/api/')) return; // live data — never cached, never intercepted

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
