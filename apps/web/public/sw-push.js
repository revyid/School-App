// Service Worker: terima push notification dari server, tampilkan sebagai
// notifikasi browser. File ini harus ada di /public/sw-push.js (served static).
// Ditulis sebagai JS murni (bukan TS) karena SW tidak di-bundle Next.js.

self.addEventListener("push", (event) => {
  let data = { title: "Notifikasi baru", body: "", url: "/" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
      vibrate: [150, 50, 150],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const found = list.find((c) => c.url.includes(url) && "focus" in c);
      if (found) return found.focus();
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
