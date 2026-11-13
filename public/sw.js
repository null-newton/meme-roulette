// Service worker (Workbox). App files: network first, so updates arrive at once; offline falls back to cache.
// Decks: network first, so card fixes ship without a release. Safety model + CDN libs: cache first (large, versioned).
// Photos are never cached here: they live only in page memory for the room.
const V = 'v6', SHELL = ['./', 'index.html', 'style.css', 'app.js', 'net.js', 'engine.js', 'cards.js', 'photos.js', 'decks/base.json', 'privacy.html', 'manifest.webmanifest', 'icon.svg'];
const skip = u => u.origin === location.origin && /\/config$/.test(u.pathname);
self.addEventListener('install', e => e.waitUntil(caches.open('mr-app-' + V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (/^mr-(app|decks)-/.test(k) && !k.endsWith(V)) || /^mr-v\d+$/.test(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())));
let wb = null;
try { importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js'); wb = self.workbox; } catch {}
if (wb) {
  wb.setConfig({ debug: false });
  const { registerRoute } = wb.routing, { NetworkFirst, CacheFirst, StaleWhileRevalidate } = wb.strategies, { CacheableResponsePlugin } = wb.cacheableResponse, { ExpirationPlugin } = wb.expiration;
  const ok = new CacheableResponsePlugin({ statuses: [0, 200] });
  registerRoute(({ url }) => url.origin === location.origin && url.pathname.includes('/vendor/'), new CacheFirst({ cacheName: 'mr-model', plugins: [ok, new ExpirationPlugin({ maxEntries: 10 })] }));
  registerRoute(({ url }) => url.origin === location.origin && url.pathname.includes('/decks/'), new NetworkFirst({ cacheName: 'mr-decks-' + V, networkTimeoutSeconds: 4 }));
  registerRoute(({ url, request }) => url.origin === location.origin && request.method === 'GET' && !skip(url), new NetworkFirst({ cacheName: 'mr-app-' + V, networkTimeoutSeconds: 4 }));
  registerRoute(({ url }) => /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(url.host), new CacheFirst({ cacheName: 'mr-libs', plugins: [ok, new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 90 * 86400 })] }));
  registerRoute(({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url.host), new StaleWhileRevalidate({ cacheName: 'mr-fonts', plugins: [ok] }));
} else {
  // Fallback if Workbox can't load: same network-first behaviour by hand for our own files
  self.addEventListener('fetch', e => {
    const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin || skip(u)) return;
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open('mr-app-' + V).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  });
}
