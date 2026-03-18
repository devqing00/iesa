"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

/**
 * Hook to manage Web Push notification subscription.
 *
 * Returns:
 * - `supported` — whether the browser supports push
 * - `permission` — current Notification permission state
 * - `subscribed` — whether an active push subscription exists
 * - `loading` — in-progress subscribe/unsubscribe
 * - `subscribe()` — request permission + subscribe
 * - `unsubscribe()` — remove subscription
 */
export function usePushNotifications() {
  const { getAccessToken } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const isPushDebugEnabled = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("push_debug") === "1" || (window as Window & { __PUSH_DEBUG__?: boolean }).__PUSH_DEBUG__ === true;
    } catch {
      return false;
    }
  }, []);

  const logPushDebug = useCallback((message: string, details?: Record<string, unknown>) => {
    if (!isPushDebugEnabled()) return;
    void message;
    void details;
  }, [isPushDebugEnabled]);

  // Check support + current state on mount
  useEffect(() => {
    let cleanupPermissionListener: (() => void) | undefined;

    const canPush =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(canPush);
    if (!canPush) return;

    setPermission(Notification.permission);

    if ("permissions" in navigator && typeof navigator.permissions.query === "function") {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((status) => {
          setPermission(status.state as NotificationPermission);
          const handleChange = () => setPermission(status.state as NotificationPermission);

          if (typeof status.addEventListener === "function") {
            status.addEventListener("change", handleChange);
            cleanupPermissionListener = () => {
              status.removeEventListener("change", handleChange);
            };
          } else {
            status.onchange = handleChange;
            cleanupPermissionListener = () => {
              status.onchange = null;
            };
          }
        })
        .catch(() => {
          /* Permissions API unavailable for notifications in this browser */
        });
    }

    // Register push service worker (separate from any app SW)
    navigator.serviceWorker
      .register("/push-sw.js")
      .then((reg) => {
        logPushDebug("service worker registered", {
          scope: reg.scope,
        });
        registrationRef.current = reg;
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        setSubscribed(!!sub);
        logPushDebug("existing push subscription check", {
          hasSubscription: !!sub,
          endpointHost: sub?.endpoint ? new URL(sub.endpoint).host : null,
        });
      })
      .catch((registrationError) => {
        logPushDebug("service worker registration failed", {
          error: String(registrationError),
        });
        /* SW registration failed — push not available */
      });

    return () => {
      cleanupPermissionListener?.();
    };
  }, [logPushDebug]);

  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const token = await getAccessToken();
      return fetch(getApiUrl(`/api/v1/push${path}`), {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options?.headers || {}),
        },
      });
    },
    [getAccessToken],
  );

  /**
   * Convert a base64url VAPID public key to a Uint8Array
   * for the PushManager.subscribe() applicationServerKey param.
   */
  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function toPushErrorMessage(err: unknown): string {
    const isBrave = typeof navigator !== "undefined" && !!(navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave;

    if (err instanceof DOMException) {
      if (err.name === "NotAllowedError") {
        return "Notification permission was denied. Enable notifications for this site in your browser settings.";
      }
      if (err.name === "InvalidStateError") {
        return "Your browser has a stale push subscription. Please try again.";
      }
      if (err.name === "AbortError") {
        if (isBrave) {
          return "Brave interrupted push registration. Disable Shields for this site, allow Notifications, then try again.";
        }
        return "Push registration was interrupted by the browser push service. Please try again.";
      }
    }

    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Registration failed - push service error")) {
      if (isBrave) {
        return "Brave push service blocked registration. Turn off Shields for this site and ensure Notifications are allowed in Brave site settings.";
      }
      return "Browser push service failed to register this device. Please retry; if it persists, re-enable notifications for this site and try again.";
    }

    return message || "Failed to enable push notifications";
  }

  const subscribe = useCallback(async () => {
    if (!supported || loading) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Get VAPID public key from backend
      const keyRes = await apiFetch("/vapid-public-key");
      if (!keyRes.ok) throw new Error("Push notifications are not configured on the server");
      const { publicKey } = await keyRes.json();
      logPushDebug("received VAPID public key", {
        publicKeyLength: String(publicKey || "").length,
      });

      // 2. Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      logPushDebug("notification permission result", { permission: perm });
      if (perm !== "granted") {
        setLoading(false);
        return;
      }

      // 3. Ensure SW is registered (re-register if the ref is still null due to async timing)
      let reg = registrationRef.current;
      if (!reg) {
        reg = await navigator.serviceWorker.register("/push-sw.js");
        registrationRef.current = reg;
        logPushDebug("service worker registered during subscribe", { scope: reg.scope });
      }

      // Wait until browser activates the worker and push service is fully ready.
      const readyReg = await navigator.serviceWorker.ready;
      if (readyReg) {
        reg = readyReg;
        registrationRef.current = readyReg;
      }

      const saveSubscriptionToBackend = async (subscription: PushSubscriptionJSON) => {
        const res = await apiFetch("/subscribe", {
          method: "POST",
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          logPushDebug("subscription rejected by backend", {
            status: res.status,
            detail: body?.detail || null,
          });
          throw new Error(body.detail || "Failed to save subscription");
        }
      };

      const subscribeWithRetry = async (registration: ServiceWorkerRegistration) => {
        try {
          return await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
          });
        } catch {
          const waitMs = 350;
          await new Promise((resolve) => window.setTimeout(resolve, waitMs));
          return await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
          });
        }
      };

      // 4. Reuse an existing subscription when available; otherwise create one.
      let pushSub = await reg.pushManager.getSubscription();
      if (pushSub) {
        // Existing subscription may never have been saved to backend (e.g., cleared server DB).
        const existingJson = pushSub.toJSON();
        if (existingJson.endpoint && existingJson.keys?.p256dh && existingJson.keys?.auth) {
          await saveSubscriptionToBackend(existingJson);
          setSubscribed(true);
          logPushDebug("existing subscription synced to backend", {
            endpointHost: existingJson.endpoint ? new URL(existingJson.endpoint).host : null,
          });
          return;
        }
      }

      if (!pushSub) {
        try {
          pushSub = await subscribeWithRetry(reg);
        } catch (subscribeError) {
          const message = subscribeError instanceof Error ? subscribeError.message : String(subscribeError);
          const domName = subscribeError instanceof DOMException ? subscribeError.name : "";
          const canRetryWithReset =
            domName === "InvalidStateError" ||
            domName === "AbortError" ||
            message.includes("Registration failed - push service error");

          if (canRetryWithReset) {
            logPushDebug("subscribe retry path triggered", { domName, message });
            try {
              const existing = await reg.pushManager.getSubscription();
              if (existing) {
                await existing.unsubscribe().catch(() => undefined);
              }

              await reg.unregister().catch(() => undefined);
              reg = await navigator.serviceWorker.register("/push-sw.js");
              registrationRef.current = reg;
              const readyAfterReset = await navigator.serviceWorker.ready;
              if (readyAfterReset) {
                reg = readyAfterReset;
                registrationRef.current = readyAfterReset;
              }

              pushSub = await subscribeWithRetry(reg);
            } catch (retryError) {
              throw retryError;
            }
          } else {
            throw subscribeError;
          }
        }
      }

      if (!pushSub) {
        throw new Error("Failed to create push subscription");
      }
      logPushDebug("pushManager.subscribe success", {
        endpointHost: pushSub.endpoint ? new URL(pushSub.endpoint).host : null,
      });

      // 5. Send subscription to backend
      const subJson = pushSub.toJSON();
      logPushDebug("sending subscription payload", {
        endpointHost: subJson.endpoint ? new URL(subJson.endpoint).host : null,
        p256dhLength: String(subJson.keys?.p256dh || "").length,
        authLength: String(subJson.keys?.auth || "").length,
      });
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Push subscription payload is incomplete");
      }
      await saveSubscriptionToBackend(subJson);
      setSubscribed(true);
      logPushDebug("subscription saved on backend");
    } catch (err) {
      logPushDebug("subscribe failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(toPushErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supported, loading, apiFetch, logPushDebug]);

  const unsubscribe = useCallback(async () => {
    if (!supported || loading) return;
    setLoading(true);
    setError(null);

    try {
      const reg = registrationRef.current;
      if (!reg) return;

      const pushSub = await reg.pushManager.getSubscription();
      if (pushSub) {
        const subJson = pushSub.toJSON();
        logPushDebug("unsubscribe payload", {
          endpointHost: subJson.endpoint ? new URL(subJson.endpoint).host : null,
        });

        // Remove from backend
        await apiFetch("/unsubscribe", {
          method: "DELETE",
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          }),
        });

        // Unsubscribe locally
        await pushSub.unsubscribe();
        logPushDebug("local push subscription removed");
      }
      setSubscribed(false);
    } catch (err) {
      logPushDebug("unsubscribe failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : "Failed to disable push notifications");
    } finally {
      setLoading(false);
    }
  }, [supported, loading, apiFetch, logPushDebug]);

  return {
    supported,
    permission,
    subscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
  };
}
