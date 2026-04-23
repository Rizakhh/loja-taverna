/** 
 * Taverna do Rizakh - Service Worker v2
 * Corrigido para GitHub Pages subpath
 */

const CACHE_NAME = 'taverna-rizakh-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(err => console.warn('[SW] Falha ao cachear', url)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) return;
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
      return res;
    }).catch(() => caches.match(event.request))
  );
});

// push, notificationclick, sync permanecem iguais...
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: 'Taverna do Rizakh', body: event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body || 'Nova atualização!',
    icon: './icon-192.png',
    badge: './badge-72.png'
  }));
});
