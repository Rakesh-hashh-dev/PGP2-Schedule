/* Web Push handlers — imported into the generated Workbox SW via
   workbox.importScripts (see vite.config.js). Payload shape:
   { title, body, url?, tag?, image?, cta?, icon? } */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "TermFlow";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: data.icon || "/icon-push-bell.png",
      badge: "/badge-72.png",
      tag: data.tag || undefined,
      renotify: false,
      timestamp: Date.now(),
      // Short double-tap buzz — subtle, not alarm-like (Android only)
      vibrate: [80, 40, 80],
      image: data.image || undefined,
      data: { url: data.url || "/" },
      // Rendered as a tappable button on Android/Chrome; ignored on iOS
      actions: [{ action: "open", title: data.cta || "Open TermFlow" }],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          if (url !== "/" && client.navigate) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
