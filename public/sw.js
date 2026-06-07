// Service Worker for Web Push Notifications
const CACHE_NAME = 'calendar-tracker-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener('push', (e) => {
  const data = e.data?.json() || {};
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    silent: false,
    requireInteraction: data.requireInteraction || false,
    tag: data.tag || 'calendar',
    data: { url: data.url || '/' },
  };
  e.waitUntil(self.registration.showNotification(data.title || 'Calendar', options));
});

// Click notification → open app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((list) => {
      for (const client of list) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// Background sync for scheduled notifications
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SCHEDULE_CHECK') {
    // Handled by the app
  }
});
