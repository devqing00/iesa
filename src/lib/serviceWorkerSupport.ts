export function supportsServiceWorkerRegistration(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && typeof navigator.serviceWorker !== "undefined";
}

export function supportsWebPush(): boolean {
  if (!supportsServiceWorkerRegistration()) return false;

  return "PushManager" in window && "Notification" in window;
}
