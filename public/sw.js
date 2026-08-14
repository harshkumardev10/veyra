// VEYRA Service Worker — enables PWA install, offline caching & push notifications
const CACHE_NAME = 'veyra-v5';
const PRECACHE = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
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

// Network-first strategy — show cached shell if offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firestore') || event.request.url.includes('firebase')) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Listen for messages from the app to show notifications
// This is triggered when app is backgrounded/minimized
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, chatId } = event.data.payload;
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: icon || './pwa-192x192.png',
        badge: './pwa-192x192.png',
        tag: tag || 'veyra-msg',
        renotify: true,
        vibrate: [200, 100, 200],
        data: { chatId },
        actions: [{ action: 'open', title: 'Open Chat' }],
      })
    );
  }
});

// FCM Push event — fires when app is fully closed (requires FCM server setup)
self.addEventListener('push', (event) => {
  let data = { title: 'VEYRA', body: 'You have a new message', icon: './pwa-192x192.png', chatId: '' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (_e) {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(`💬 ${data.title}`, {
      body: data.body,
      icon: data.icon,
      badge: './pwa-192x192.png',
      vibrate: [200, 100, 200],
      tag: 'veyra-push',
      renotify: true,
      data: { chatId: data.chatId },
    })
  );
});

// Notification click handler — focus existing VEYRA window or open new tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const urlToOpen = chatId
    ? self.registration.scope + '#chat=' + chatId
    : self.registration.scope;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing VEYRA window/tab if already open
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', chatId });
          return client.focus();
        }
      }
      // Open new VEYRA tab if not open
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
