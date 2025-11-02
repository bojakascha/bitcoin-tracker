// Service Worker for monoticker PWA
const CACHE_NAME = 'monoticker-v1';

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Take control of all pages immediately
    })
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Never intercept manifest.json or service worker - let browser fetch directly
  if (url.pathname.includes('manifest.json') || url.pathname.includes('sw.js')) {
    return; // Don't intercept, let browser handle normally
  }

  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip caching for API calls - let them pass through directly
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('api.coinbase.com') ||
      event.request.url.includes('api.exchange.coinbase.com') ||
      event.request.url.includes('data-api.ecb.europa.eu') ||
      event.request.url.includes('api.coinlore.net')) {
    return; // Don't intercept, let browser handle API calls directly
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type === 'error') {
          // If network fails, try cache
          return caches.match(event.request);
        }

        // Clone the response
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});

