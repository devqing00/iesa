/* eslint-disable no-restricted-globals */
/**
 * IESA Push Notification Service Worker
 *
 * Handles incoming push events from the Web Push API
 * and shows native browser notifications.
 *
 * This file lives in /public so it's served at the root scope.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: "IESA",
      body: event.data.text(),
      url: "/dashboard",
    };
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/assets/images/iesa-logo.png",
    badge: "/assets/images/iesa-logo.png",
    tag: data.tag || "iesa-notification",
    renotify: true,
    data: {
      url: data.url || "/dashboard",
      actionUrls: Array.isArray(data.actions)
        ? data.actions.reduce((acc, action) => {
            if (action && typeof action.action === "string" && typeof action.url === "string") {
              acc[action.action] = action.url;
            }
            return acc;
          }, {})
        : {},
    },
    actions: Array.isArray(data.actions)
      ? data.actions
          .filter((action) => action && typeof action.action === "string" && typeof action.title === "string")
          .map((action) => ({ action: action.action, title: action.title }))
      : [
          { action: "open_main", title: "Open" },
          { action: "dismiss", title: "Dismiss" },
        ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "IESA", options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const defaultUrl = event.notification.data?.url || "/dashboard";
  const actionUrl = event.notification.data?.actionUrls?.[event.action];
  const targetUrl = actionUrl || defaultUrl;
  const url = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      return self.clients.openWindow(url);
    }),
  );
});

// Activate immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
