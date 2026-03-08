"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

/**
 * Lightweight hook that tracks the notification unread count.
 * Fetches on mount, polls every 5 min, and listens for SSE push events.
 * Shared by NotificationBell, Sidebar, and MobileNav.
 */
export function useNotificationCount() {
  const { getAccessToken, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/notifications/unread-count"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const { count } = await res.json();
        setUnreadCount(count);
      }
    } catch {
      // non-critical
    }
  }, [getAccessToken, user]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);

    const handleSSE = () => refresh();
    window.addEventListener("sse:notification", handleSSE);

    return () => {
      clearInterval(interval);
      window.removeEventListener("sse:notification", handleSSE);
    };
  }, [refresh]);

  return { unreadCount, refreshNotificationCount: refresh };
}
