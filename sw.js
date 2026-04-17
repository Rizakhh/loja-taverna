/**
 * Taverna do Rizakh - Service Worker
 * PWA with Push Notifications Support
 */

const CACHE_NAME = 'taverna-rizakh-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone response for caching
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'Taverna do Rizakh',
      body: event.data.text(),
      icon: '/icon-192.png',
      badge: '/badge-72.png'
    };
  }

  const options = {
    body: data.body || 'Nova atualização na Taverna!',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      id: data.id || Date.now()
    },
    actions: [
      {
        action: 'explore',
        title: 'Explorar',
        icon: '/icon-explore.png'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ],
    requireInteraction: true,
    tag: data.tag || 'taverna-notification'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Taverna do Rizakh', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  // Sync any pending notifications
  console.log('[SW] Syncing notifications...');
}
