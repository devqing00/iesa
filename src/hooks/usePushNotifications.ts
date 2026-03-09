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
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Check support + current state on mount
  useEffect(() => {
    const canPush =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(canPush);
    if (!canPush) return;

    setPermission(Notification.permission);

    // Register push service worker (separate from any app SW)
    navigator.serviceWorker
      .register("/push-sw.js", { scope: "/push/" })
      .then((reg) => {
        registrationRef.current = reg;
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        setSubscribed(!!sub);
      })
      .catch(() => {
        /* SW registration failed — push not available */
      });
  }, []);

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
  function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer as ArrayBuffer;
  }

  const subscribe = useCallback(async () => {
    if (!supported || loading) return;
    setLoading(true);

    try {
      // 1. Get VAPID public key from backend
      const keyRes = await apiFetch("/vapid-public-key");
      if (!keyRes.ok) throw new Error("Push not available");
      const { publicKey } = await keyRes.json();

      // 2. Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setLoading(false);
        return;
      }

      // 3. Subscribe via PushManager
      const reg = registrationRef.current;
      if (!reg) throw new Error("Service worker not registered");

      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 4. Send subscription to backend
      const subJson = pushSub.toJSON();
      const res = await apiFetch("/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });

      if (res.ok) {
        setSubscribed(true);
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [supported, loading, apiFetch]);

  const unsubscribe = useCallback(async () => {
    if (!supported || loading) return;
    setLoading(true);

    try {
      const reg = registrationRef.current;
      if (!reg) return;

      const pushSub = await reg.pushManager.getSubscription();
      if (pushSub) {
        const subJson = pushSub.toJSON();

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
      }
      setSubscribed(false);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [supported, loading, apiFetch]);

  return {
    supported,
    permission,
    subscribed,
    loading,
    subscribe,
    unsubscribe,
  };
}
