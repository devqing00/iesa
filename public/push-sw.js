/**
 * IESA Push Notification Service Worker
 *
 * Handles incoming push events from the Web Push API
 * and shows native browser notifications.
 *
 * This file lives in /public so it's served at the root scope.
 */

const SHELL_CACHE = "iesa-shell-v3";
const RUNTIME_CACHE = "iesa-runtime-v3";
const VALID_CACHES = [SHELL_CACHE, RUNTIME_CACHE];
const SHELL_ASSETS = [
  "/",
  "/offline.html",
  "/assets/images/iesa-logo.png",
];

const SAFE_SHELL_ROUTES = new Set([
  "/",
  "/about",
  "/contact",
  "/events",
  "/history",
  "/iepod",
  "/team",
  "/blog",
  "/login",
  "/register",
]);

const HAS_CACHE_API = typeof caches !== "undefined";

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isSensitiveAppRoute(url) {
  return url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/admin");
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/assets/") ||
    /\.(?:css|js|mjs|woff2?|ttf|otf|svg|png|jpe?g|gif|webp|ico)$/i.test(url.pathname)
  );
}

async function networkFirst(request, cacheName) {
  if (!HAS_CACHE_API) {
    return fetch(request);
  }

  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function matchCache(request) {
  if (!HAS_CACHE_API) return undefined;
  return caches.match(request);
}

self.addEventListener("install", (event) => {
  if (HAS_CACHE_API) {
    event.waitUntil(
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined),
    );
  }
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    if (HAS_CACHE_API) {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => !VALID_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  if (isApiRequest(url)) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  const isNavigation = request.mode === "navigate";
  if (isNavigation) {
    if (isSensitiveAppRoute(url)) {
      event.respondWith(
        fetch(request, { cache: "no-store" }).catch(async () => {
          const offline = await matchCache("/offline.html");
          return offline || Response.error();
        }),
      );
      return;
    }

    if (SAFE_SHELL_ROUTES.has(url.pathname)) {
      event.respondWith(
        networkFirst(request, RUNTIME_CACHE).catch(async () => {
          const fallback = await matchCache(request);
          if (fallback) return fallback;
          const offline = await matchCache("/offline.html");
          return offline || Response.error();
        }),
      );
      return;
    }

    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(async () => {
        const offline = await matchCache("/offline.html");
        return offline || Response.error();
      }),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      networkFirst(request, RUNTIME_CACHE).catch(() => matchCache(request)),
    );
  }
});

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
