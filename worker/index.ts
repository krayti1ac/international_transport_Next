// ============================================================================
// Trans Bodanon TMS — Driver PWA Service Worker Extension (Worker Script)
// Capabilities: Web Push Notifications, Background Sync, Periodic Sync & Actions
// ============================================================================

// 1. Web Push Notifications Handler
self.addEventListener('push', function (event: any) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'ترانس بودانون - تنبيه مأمورية';

    // Emergency vibration vs normal mission vibration
    const defaultVibrate = data.tag?.includes('emergency')
      ? [500, 150, 500, 150, 500, 150, 800]
      : [300, 100, 300, 100, 400];

    const options: any = {
      body: data.body || '',
      icon: data.icon || '/icon-192x192.png',
      badge: data.badge || '/icon-192x192.png',
      image: data.image || undefined,
      dir: data.dir || 'rtl',
      lang: data.lang || 'ar',
      tag: data.tag || 'general-dispatch',
      renotify: data.renotify ?? true,
      requireInteraction: data.requireInteraction ?? true,
      vibrate: data.vibrate || defaultVibrate,
      data: {
        url: data.data?.url || data.url || '/driver-tasks',
        tripId: data.data?.tripId || data.tripId || null,
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

// 2. Notification Click & Action Routing Handler
self.addEventListener('notificationclick', function (event: any) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/driver-tasks';

  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList: any[]) {
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
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

// 3. Background Sync API (Offline Outbox Upload on Connection Restore)
self.addEventListener('sync', function (event: any) {
  const syncTag = event.tag;

  if (
    syncTag === 'sync-offline-outbox' ||
    syncTag === 'sync-fuel-receipts' ||
    syncTag === 'sync-pod-signatures' ||
    (syncTag && syncTag.startsWith('sync-'))
  ) {
    event.waitUntil(
      (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList: any[]) {
        const promises = clientList.map(function (client: any) {
          return client.postMessage({
            type: 'TRIGGER_OFFLINE_SYNC',
            tag: syncTag,
            timestamp: Date.now(),
          });
        });
        return Promise.all(promises);
      })
    );
  }
});

// 4. Periodic Background Sync API (Telemetry Heartbeat & Reefer IoT Health)
self.addEventListener('periodicsync', function (event: any) {
  const periodicTag = event.tag;

  if (
    periodicTag === 'periodic-driver-heartbeat' ||
    periodicTag === 'periodic-truck-sync'
  ) {
    event.waitUntil(
      (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList: any[]) {
        const promises = clientList.map(function (client: any) {
          return client.postMessage({
            type: 'PERIODIC_HEARTBEAT_TICK',
            tag: periodicTag,
            timestamp: Date.now(),
          });
        });
        return Promise.all(promises);
      })
    );
  }
});
