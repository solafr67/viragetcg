/* Virage TCG : service worker (appli installable et notifications push).
   Ne met jamais le jeu en cache : chaque ouverture charge la dernière version.
   Hors connexion, une page d'attente s'affiche à la place. */
const V = 'virage-v1', OFF = 'offline.html';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll([OFF, 'icon-192.png', 'badge-72.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(async () => (await caches.match(OFF)) || Response.error()));
});
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { b: e.data ? e.data.text() : '' }; }
  const opt = { body: d.b || '', icon: 'icon-192.png', badge: 'badge-72.png', lang: d.l || 'fr', data: { url: d.url || './' } };
  if (d.tag) { opt.tag = d.tag; opt.renotify = true; }
  e.waitUntil(self.registration.showNotification(d.t || 'Virage TCG', opt));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) {
        try { await c.focus(); } catch (x) {}
        c.postMessage({ go: url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
