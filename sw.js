// Caches the app files so the assistant opens with no internet.
// Bump V when you change files, so phones drop the old cache.
const V = 'pocket-assistant-v1';
const FILES = ['./', 'index.html', 'app.js', 'tools.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())
));

// Same-origin GETs: answer from cache at once, refresh the cache in the background.
// API calls to other origins are never touched.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(V).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit || Response.error());
    return hit || net;
  }));
});
