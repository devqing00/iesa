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
    },
    actions: [
      { action: "open", title: "Open" },
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

  const url = event.notification.data?.url || "/dashboard";

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
