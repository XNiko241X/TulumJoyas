// Service Worker - Tulum
// Archivos propios: se sirven de la caché al instante y se actualizan en segundo plano.
// Recursos externos (fuentes): cache-first, para que se vea igual sin internet.

const CACHE_NAME = 'tulum-v5';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Debe coincidir exactamente con el <link> de fuentes del index.html
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap'
];

// Únicos sitios externos que se cachean (fuentes y librerías de Firebase).
// Firestore, Auth y el resto de las APIs van directo a la red.
const HOSTS_CACHEABLES = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      // Las fuentes no bloquean la instalación si fallan
      await Promise.all(
        EXTERNAL_ASSETS.map((url) =>
          fetch(new Request(url, { mode: 'no-cors' }))
            .then((res) => cache.put(url, res))
            .catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const mismoOrigen = url.origin === self.location.origin;
  if (!mismoOrigen && !HOSTS_CACHEABLES.includes(url.hostname)) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const red = fetch(req)
        .then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copia = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copia));
          }
          return res;
        })
        .catch(() => {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });

      if (cached) {
        // Propios: devuelve la caché y refresca en segundo plano.
        // Externos: devuelve la caché sin volver a pedirlos.
        if (mismoOrigen) { red.catch(() => {}); }
        return cached;
      }
      return red;
    })
  );
});
