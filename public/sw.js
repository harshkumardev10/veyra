// VEYRA Service Worker — PWA install, offline cache & Firebase Cloud Messaging push notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Initialize Firebase in SW
firebase.initializeApp({
  apiKey: 'AIzaSyAYHO2GCdvtmPr8lXzsJM1Lf0fCBCzeSBE',
  authDomain: 'veyra-app-d297a.firebaseapp.com',
  projectId: 'veyra-app-d297a',
  storageBucket: 'veyra-app-d297a.firebasestorage.app',
  messagingSenderId: '397763809738',
  appId: '1:397763809738:web:7037502e08415a38bdff33',
});

const messaging = firebase.messaging();

// Handle background FCM push messages (app closed or backgrounded)
// Firebase SDK handles this automatically and shows the notification
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || '💬 New Message';
  const body = payload.notification?.body || 'You have a new message on VEYRA';
  const icon = payload.notification?.icon || './pwa-192x192.png';
  const chatId = payload.data?.chatId || '';

  return self.registration.showNotification(title, {
    body,
    icon,
    badge: './pwa-192x192.png',
    tag: chatId || 'veyra-msg',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { chatId },
  });
});

// --- PWA Caching ---
const CACHE_NAME = 'veyra-v6';
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

// Network-first strategy for app shell
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firestore') || event.request.url.includes('firebase') || event.request.url.includes('gstatic')) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Listen for messages from the app to show notifications when app is backgrounded
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
      })
    );
  }
});

// Notification click — focus VEYRA tab or open new one, then post chatId to app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId || '';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', chatId });
          return client.focus();
        }
      }
      // Open app if no window is open
      const openUrl = self.registration.scope + (chatId ? '?chatId=' + chatId : '');
      if (self.clients.openWindow) return self.clients.openWindow(openUrl);
    })
  );
});
