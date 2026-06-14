const CACHE_NAME = 'cherkitime-v2';
const ASSETS = ['/app.html', '/app.js', '/manifest.json', '/icon-512.png'];

// Installation du service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS.filter(a => a !== '/icon-512.png')))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => clients.claim())
  );
});

// Cache first pour les assets
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Réception d'une notification push (même app fermée / écran verrouillé)
self.addEventListener('push', (event) => {
  let data = { title: '🔴 CHERKITIME !', body: 'Cherki est en jeu !' };
  try {
    data = event.data.json();
  } catch (e) {}

  const options = {
    body: data.body || data.notification?.body,
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true,
    tag: 'cherkitime',
    renotify: true,
    data: { url: '/app.html', ...data.data },
    actions: [
      { action: 'open', title: '⚽ Voir le match' },
    ],
  };

  const title = data.title || data.notification?.title || '🔴 CHERKITIME !';
  const isStats = title.includes('📊') || data.data?.type === 'stats';

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      if (isStats && self.navigator?.setAppBadge) {
        return self.navigator.setAppBadge(1);
      }
    })
  );
});

// Clic sur la notification → ouvre l'app + efface le badge
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    Promise.all([
      self.navigator?.clearAppBadge?.(),
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        const target = event.notification.data?.url || '/app.html';
        for (const client of clientList) {
          if (client.url.includes('/app.html') && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(target);
      }),
    ])
  );
});
