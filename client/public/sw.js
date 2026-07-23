/**
 * LifeSave - Smart Disaster & Emergency Controller Service Worker
 * Bypasses all Vite development server HMR and module loading endpoints,
 * and caches static production assets for offline reliability.
 */

const CACHE_NAME = 'lifesave-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg'
];

// Install event - Cache core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[LifeSave SW] Pre-caching static assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - Clean up old cache storage
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[LifeSave SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Serve production assets from cache with network fallbacks
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. DIRECT DEVELOPMENT PASS-THROUGH (CRITICAL BYPASS)
  // Let the browser handle these requests natively without SW interception.
  if (
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/src/') ||
    event.request.url.includes('vite') ||
    event.request.url.includes('hot-update') ||
    event.request.headers.get('Upgrade') === 'websocket'
  ) {
    // Return early without calling event.respondWith().
    // This allows browser to hit the network directly, preventing ERR_FAILED and TypeError.
    return;
  }

  // Skip handling non-GET requests (e.g. POST, PUT, DELETE)
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. CACHE-FIRST STRATEGY FOR STATIC PRODUCTION ASSETS
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          // If response is invalid or not a standard 200 request, return it directly
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Do NOT cache API endpoints or Socket.io polling loops
          if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) {
            return response;
          }

          // Cache dynamic static assets (JS, CSS, images) on fetch in production
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Fallback offline support for direct page navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
