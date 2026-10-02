/* TurfBook service worker.
 *
 * Strategy:
 *  - App shell + static assets (/_expo/static, /assets, /icons, manifest):
 *      cache-first; cached on install so first paint works offline.
 *  - Navigation requests (HTML pages): network-first with an Arabic offline
 *      fallback page when the network is unavailable.
 *  - /api/* : network-only, never cached.
 *  - Web Push: shows incoming push messages as Arabic notifications.
 *
 * Registered from frontend/src/push.ts via registerServiceWorker().
 */
const CACHE_VERSION = 'turfbook-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>لا يوجد اتصال — ترف بوك</title>
<style>
  body { margin:0; font-family: system-ui, -apple-system, sans-serif; background:#0b3d2e; color:#fff;
         display:flex; align-items:center; justify-content:center; min-height:100vh; text-align:center; }
  .card { padding:32px; max-width:420px; }
  h1 { font-size:1.6rem; margin:0 0 12px; }
  p { opacity:.85; line-height:1.8; }
  button { margin-top:16px; padding:12px 28px; font-size:1rem; border:0; border-radius:12px;
           background:#f5b301; color:#0b3d2e; font-weight:700; cursor:pointer; }
</style>
</head>
<body>
  <div class="card">
    <h1>لا يوجد اتصال بالإنترنت</h1>
    <p>تعذّر تحميل ترف بوك. تحقق من اتصالك ثم حاول مجدداً.</p>
    <button onclick="location.reload()">إعادة المحاولة</button>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_expo/static') ||
    url.pathname.startsWith('/assets') ||
    url.pathname.startsWith('/icons') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API calls: never cache, always network.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // Navigations / everything else: network-first, Arabic offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      )
    );
  }
});

// ---- Web Push ----
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'ترف بوك';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    dir: 'rtl',
    lang: 'ar-JO',
    data: payload.data || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = '/';
  if (data.type === 'booking_reminder' && data.booking_id) url = `/bookings/${data.booking_id}`;
  if (data.type === 'match_reminder' && data.match_id) url = `/matches/${data.match_id}`;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
