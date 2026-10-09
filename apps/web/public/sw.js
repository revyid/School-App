// Service worker utama (SATU-SATUNYA, scope "/"): cache shell offline + Web Push.
// JANGAN daftarkan worker kedua (mis. /sw-push.js scope "/") — worker baru
// menggantikan worker lama, subscription push ikut mati, dan di Android/Chrome
// notif tidak pernah muncul walau izin sudah granted.
// Versi cache bump tiap rilis agar klien dapat shell baru.
const CACHE = "sms-shell-v2";
const SHELL = ["/login", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Hanya cache navigasi + aset statis same-origin; API tidak di-cache.
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("/login"))),
  );
});

// --- Web Push: terima push dari server, tampilkan sebagai notifikasi browser. ---
// Payload server: { title, body, url }.
self.addEventListener("push", (event) => {
  let data = { title: "Notifikasi baru", body: "", url: "/" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "sms-notif",
      renotify: true,
      data: { url: data.url || "/" },
      vibrate: [150, 50, 150],
      requireInteraction: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url === url || c.url.endsWith(url)) {
          if ("focus" in c) return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
