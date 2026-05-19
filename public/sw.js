self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Porosi e re! 🛵', {
      body: data.body ?? 'Ke një porosi të re.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.orderId ?? 'order',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 600],
      data: { url: '/driver', orderId: data.orderId },
      actions: [
        { action: 'open', title: 'Hap Driver Panel' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus existing /driver tab if already open
      for (const client of list) {
        if (client.url.includes('/driver') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/driver');
    })
  );
});
