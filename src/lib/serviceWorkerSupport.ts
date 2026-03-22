export function supportsServiceWorkerRegistration(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  try {
    if (typeof ServiceWorkerGlobalScope === "undefined") return false;
    return true;
  } catch {
    return false;
  }
}

export function supportsWebPush(): boolean {
  if (!supportsServiceWorkerRegistration()) return false;

  return "PushManager" in window && "Notification" in window;
}
