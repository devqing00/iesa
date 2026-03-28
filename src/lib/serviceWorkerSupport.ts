export function supportsServiceWorkerRegistration(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  try {
    // Avoid referencing a potentially undeclared global identifier directly.
    const swGlobalScope = (globalThis as { ServiceWorkerGlobalScope?: unknown }).ServiceWorkerGlobalScope;
    if (typeof swGlobalScope === "undefined") return false;
    return true;
  } catch {
    return false;
  }
}

export function supportsWebPush(): boolean {
  if (!supportsServiceWorkerRegistration()) return false;

  return "PushManager" in window && "Notification" in window;
}
