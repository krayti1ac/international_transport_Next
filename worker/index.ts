// Web Push Notifications & Actions Handler for Driver PWA
self.addEventListener('push', function (event: any) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'ترانس بودانون - تنبيه مأمورية';

    const options = {
      body: data.body || '',
      icon: data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      image: data.image || null,
      dir: 'rtl' as const,
      lang: 'ar',
      tag: data.tag || 'general-dispatch',
      renotify: true,
      requireInteraction: data.requireInteraction || false,
      vibrate: data.vibrate || [200, 100, 200, 100, 400],
      data: {
        url: data.url || '/driver-tasks',
        tripId: data.tripId || null,
        timestamp: Date.now(),
      },
      actions: data.actions || [
        { action: 'open_mission', title: 'عرض تفاصيل الرحلة 🚛' },
        { action: 'dismiss', title: 'إغلاق' },
      ],
    };

    event.waitUntil((self as any).registration.showNotification(title, options));
  } catch (err) {
    console.error('[ServiceWorker] Push event parsing error:', err);
  }
});

self.addEventListener('notificationclick', function (event: any) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/driver-tasks';

  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList: any[]) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if ((self as any).clients.openWindow) {
        return (self as any).clients.openWindow(targetUrl);
      }
    })
  );
});

