/**
 * useSSE — Real-time WebSocket events hook
 *
 * Opens a persistent WebSocket connection to the backend realtime stream.
 * When an event arrives, it calls SWR `mutate()` on the relevant cache
 * keys so dashboard data refreshes automatically.
 *
 * @example
 * ```tsx
 * import { useSSE } from "@/hooks/useSSE";
 *
 * function DashboardLayout() {
 *   useSSE(); // auto-connects when authenticated
 * }
 * ```
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { mutate } from "swr";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/lib/api/client";

// Map SSE event types → SWR cache keys that should be revalidated
const EVENT_KEY_MAP: Record<string, string[]> = {
  announcement_created: ["/api/v1/announcements/", "/api/v1/student/dashboard", "/api/v1/admin/stats"],
  announcement_updated: ["/api/v1/announcements/", "/api/v1/student/dashboard"],
  announcement_deleted: ["/api/v1/announcements/", "/api/v1/student/dashboard", "/api/v1/admin/stats"],
  event_created:        ["/api/v1/events/", "/api/v1/student/dashboard", "/api/v1/admin/stats"],
  event_updated:        ["/api/v1/events/", "/api/v1/student/dashboard", "/api/v1/admin/stats"],
  event_deleted:        ["/api/v1/events/", "/api/v1/student/dashboard", "/api/v1/admin/stats"],
  payment_created:      ["/api/v1/payments/", "/api/v1/student/dashboard", "/api/v1/admin/stats"],
  enrollment_created:   ["/api/v1/admin/stats"],
  enrollment_deleted:   ["/api/v1/admin/stats"],
  notification_created: ["/api/v1/notifications/"],
  class_status_updated: ["/api/v1/student/dashboard", "/api/v1/timetable/classes"],
  class_cancelled: ["/api/v1/student/dashboard", "/api/v1/timetable/classes"],
};

// Realtime events that should also trigger a notification bell refresh
const NOTIFICATION_EVENTS = new Set([
  "notification_created",
  "announcement_created",
  "announcement_updated",
  "announcement_deleted",
  "event_created",
  "payment_created",
  "class_status_updated",
  "class_cancelled",
]);

const TIMETABLE_EVENTS = new Set([
  "class_status_updated",
  "class_cancelled",
]);

/** Revalidate all SWR keys associated with an event type. */
function revalidateForEvent(eventType: string) {
  const keys = EVENT_KEY_MAP[eventType];
  if (!keys) return;
  for (const key of keys) {
    mutate(key);
  }
  // Dispatch custom event so NotificationBell can refresh without waiting for poll
  if (NOTIFICATION_EVENTS.has(eventType)) {
    window.dispatchEvent(new CustomEvent("sse:notification"));
  }
  if (TIMETABLE_EVENTS.has(eventType)) {
    window.dispatchEvent(new CustomEvent("sse:timetable"));
  }
}

function buildRealtimeWsUrl(token: string): string {
  const base = new URL(API_BASE_URL);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `${base.pathname.replace(/\/$/, "")}/api/v1/sse/ws`;
  base.search = new URLSearchParams({ token }).toString();
  return base.toString();
}

/**
 * Hook that opens a WebSocket connection when the user is authenticated.
 * Automatically reconnects on disconnection with exponential back-off.
 */
export function useSSE() {
  const { user, getAccessToken } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<(() => Promise<void>) | null>(null);

  const connect = useCallback(async () => {
    // Don't connect if no user or SSR
    if (!user || typeof window === "undefined") return;

    const token = await getAccessToken();
    if (!token) return;

    // Close existing connection
    wsRef.current?.close();

    const wsUrl = buildRealtimeWsUrl(token);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0; // reset back-off on successful connect
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        const eventType = parsed?.type;
        if (!eventType || eventType === "heartbeat" || eventType === "pong") return;
        revalidateForEvent(eventType);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onclose = () => {
      wsRef.current = null;

      // Exponential back-off: 1s, 2s, 4s, 8s … capped at 30s
      const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
      retryRef.current += 1;

      timerRef.current = setTimeout(() => {
        void connectRef.current?.();
      }, delay);
    };
  }, [user, getAccessToken]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    void connect();

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connect]);
}
