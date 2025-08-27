// Service Worker for Cache Management (Mobile Focus)
const CACHE_NAME = 'webinar-ai-v' + Date.now();
const urlsToCache = [
  // Don't cache anything - force fresh requests for mobile devices
];

self.addEventListener('install', function(event) {
  console.log('📱 Service Worker: Installing for mobile cache management');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('📱 Service Worker: Activating and clearing old caches');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Delete all old caches to ensure fresh content
          if (cacheName !== CACHE_NAME) {
            console.log('📱 Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  // For mobile devices, always fetch fresh content (no caching)
  event.respondWith(
    fetch(event.request.clone()).then(function(response) {
      // Add no-cache headers to response for mobile
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      newHeaders.set('Pragma', 'no-cache');
      newHeaders.set('Expires', '0');
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }).catch(function(error) {
      console.error('📱 Service Worker: Fetch failed:', error);
      throw error;
    })
  );
});

// Message handler for manual cache clearing
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('📱 Service Worker: Manual cache clear requested');
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      event.ports[0].postMessage({ success: true });
    });
  }
});
