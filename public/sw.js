const CACHE_VERSION = 'electromen-pwa-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const MEDIA_CACHE = `${CACHE_VERSION}-media`;
const VALID_CACHES = new Set([APP_SHELL_CACHE, RUNTIME_CACHE, MEDIA_CACHE]);

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/assets/aistudio/Image_1_397aca35.jpeg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL_URLS.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: 'reload' }));
            if (response && response.ok) {
              await cache.put(url, response);
            }
          } catch {
            // Keep SW installation resilient even if an optional asset fails momentarily
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (!VALID_CACHES.has(key)) {
            return caches.delete(key);
          }
          return Promise.resolve(false);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET and byte-range requests
  if (request.method !== 'GET' || request.headers.has('range')) {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Only handle http/https
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;

  // Never cache or intercept API calls or video streams
  if (isSameOrigin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/videos/'))) {
    return;
  }

  // Navigation requests (App Shell SPA): Network-First -> fallback to cached /index.html
  if (request.mode === 'navigate' && isSameOrigin) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const shellCache = await caches.open(APP_SHELL_CACHE);
            shellCache.put('/index.html', networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch {
          const cachedIndex =
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (cachedIndex) return cachedIndex;
          return new Response(
            '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ELECTRO-MEN | Mode hors ligne</title></head><body style="font-family:sans-serif;padding:24px;text-align:center;color:#0f172a"><h1>ELECTRO-MEN</h1><p>Vous êtes actuellement hors ligne. Reconnectez-vous pour charger cette page.</p></body></html>',
            {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        }
      })()
    );
    return;
  }

  // Uploaded media (/uploads/*): Network-First so admin image updates appear immediately online, with offline cache fallback
  if (isSameOrigin && url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const mediaCache = await caches.open(MEDIA_CACHE);
            mediaCache.put(request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response('', { status: 404, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Static App Shell / Vite bundles (/assets/*, icons, manifest)
  if (isSameOrigin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) {
          // Background refresh for unhashed shell icons/manifest
          if (!url.pathname.startsWith('/assets/')) {
            fetch(request)
              .then(async (res) => {
                if (res && res.ok) {
                  const shellCache = await caches.open(APP_SHELL_CACHE);
                  await shellCache.put(request, res);
                }
              })
              .catch(() => {});
          }
          return cached;
        }
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const runtimeCache = await caches.open(RUNTIME_CACHE);
            runtimeCache.put(request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch {
          return new Response('', { status: 504, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Google Fonts: Stale-While-Revalidate
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const networkPromise = fetch(request)
          .then(async (res) => {
            if (res && res.ok) {
              const runtimeCache = await caches.open(RUNTIME_CACHE);
              await runtimeCache.put(request, res.clone());
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          return cached;
        }
        const net = await networkPromise;
        return net || new Response('', { status: 504, statusText: 'Offline' });
      })()
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
