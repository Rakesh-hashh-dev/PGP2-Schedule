/* Imported by Workbox. Supports legacy { title, body, url, cta } payloads too. */
function notificationUrl(raw) {
  try {
    const url = new URL(typeof raw === "string" ? raw : "/", self.location.origin);
    if (url.protocol === "https:" || (url.protocol === "http:" && url.origin === self.location.origin)) return url.href;
  } catch { /* malformed destinations open TermFlow */ }
  return self.location.origin + "/";
}

self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) data = {};

  // Silent cache bust / emergency purge command from Admin Tools
  if (data.type === "cache_bust" || data.action === "purge_cache") {
    event.waitUntil(
      (async () => {
        try {
          if ("caches" in self) {
            const names = await caches.keys();
            await Promise.all(names.map((n) => caches.delete(n)));
          }
          await self.registration.update();
        } catch { /* ignore */ }
      })()
    );
    return;
  }
  const url = notificationUrl(data.url);
  const proposed = Array.isArray(data.actions) ? data.actions : [{ action: "open", title: data.cta || "Open TermFlow", url }];
  const maxActions = typeof self.Notification?.maxActions === "number" ? Math.max(0, self.Notification.maxActions) : 2;
  const actions = proposed.filter(a => a && typeof a.action === "string" && typeof a.title === "string").slice(0, Math.min(2, maxActions));
  const actionUrls = Object.fromEntries(actions.filter(a => a.action !== "dismiss").map(a => [a.action, notificationUrl(a.url || url)]));
  const image = typeof data.image === "string" && /^(https:\/\/|\/(?!\/))/.test(data.image) ? notificationUrl(data.image) : undefined;
  const title = typeof data.title === "string" && data.title ? data.title : "TermFlow";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      // The app logo stays present even when an old producer supplies a bell/avatar.
      icon: "/icon-notification.png",
      badge: "/badge-notification.png",
      tag: data.tag || undefined,
      renotify: false,
      timestamp: Number.isFinite(data.timestamp) ? data.timestamp : Date.now(),
      vibrate: [80, 40, 80],
      image,
      data: { url, actionUrls },
      actions: actions.map(({ action, title }) => ({ action, title })),
    }).then(syncBadge)
  );
});

// Badge the installed-app icon with the number of TermFlow notifications
// still in the tray — a real count, not a dot. Tapping or swiping one away
// re-syncs it; App.jsx overwrites with the exact unread total on next open.
async function syncBadge() {
  if (!navigator.setAppBadge) return;
  try {
    const shown = await self.registration.getNotifications();
    if (shown.length > 0) await navigator.setAppBadge(shown.length);
    else await navigator.clearAppBadge();
  } catch { /* badge is best-effort */ }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") {
    event.waitUntil(syncBadge());
    return;
  }
  const data = event.notification.data || {};
  const url = notificationUrl(data.actionUrls?.[event.action] || data.url);
  event.waitUntil((async () => {
    // External announcement links open separately, preserving an existing app.
    if (new URL(url).origin === self.location.origin) {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of list) {
        if (new URL(client.url).origin !== self.location.origin || !("focus" in client)) continue;
        try {
          const navigated = client.url === url ? client : await client.navigate(url);
          if (navigated) { await navigated.focus(); return; }
        } catch { /* a closing tab should not swallow the action */ }
      }
    }
    await self.clients.openWindow(url);
  })().then(syncBadge));
});

self.addEventListener("notificationclose", (event) => {
  event.waitUntil(syncBadge());
});
