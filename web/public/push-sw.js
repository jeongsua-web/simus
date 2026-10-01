self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { /* use generic notification */ }
  const title = typeof data.title === 'string' ? data.title : 'SIM:US 결과 알림';
  const url = typeof data.url === 'string' && /^\/result\/[0-9a-f-]{36}$/.test(data.url) ? data.url : '/participate';
  event.waitUntil(self.registration.showNotification(title, {
    body: '회차 결과를 확인해 주세요.', tag: typeof data.tag === 'string' ? data.tag : 'simus-result', data: { url },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? '/participate', self.location.origin);
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    const existing = windows.find(window => window.url === url.href);
    if (existing) return existing.focus();
    return clients.openWindow(url.href);
  }));
});
