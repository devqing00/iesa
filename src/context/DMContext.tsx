"use client";

/**
 * DMContext — Persistent DM WebSocket connection for the entire dashboard session.
 *
 * Why this exists:
 *   Previously the WS was opened inside the messages page component, meaning
 *   real-time events only arrived while the user was actively on /dashboard/messages.
 *   Any message sent while the recipient was on another page was silently lost
 *   (backend called dm_manager.notify() but found no connected socket).
 *
 * Now:
 *   - WS is opened once when the user logs in (layout mounts DMProvider)
 *   - `totalUnread` is tracked globally and shown as a badge in Sidebar + MobileNav
 *   - The messages page subscribes to events via `subscribe()` for real-time UI updates
 *   - Heartbeat ping every 30 s keeps the connection alive through proxies / load balancers
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { getWsUrl } from "@/lib/api";
import { isExternalStudent } from "@/lib/studentAccess";

// ─── Types ────────────────────────────────────────────────────────────

export type DMEventType =
  | "new_message"
  | "messages_read"
  | "connection_request"
  | "connection_accepted"
  | "message_request"
  | "message_request_accepted"
  | "muted"
  | "pong"
  | "typing"
  | "message_deleted"
  | "message_pinned"
  | "reaction_updated";

export type DMEvent = {
  type: DMEventType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
};

interface DMContextValue {
  /** Total unread messages across all conversations (for sidebar badge) */
  totalUnread: number;
  /** Whether shared DM websocket is currently connected */
  isConnected: boolean;
  /**
   * Subscribe to raw DM WebSocket events (called from messages page).
   * Returns an unsubscribe function.
   */
  subscribe: (handler: (event: DMEvent) => void) => () => void;
  /**
   * Tell the context the messages page is mounted/unmounted.
   * While mounted the context does NOT increment totalUnread (the page
   * manages its own unread state using the subscribed events).
   */
  setMessagesPageOpen: (open: boolean) => void;
  /**
   * Decrement totalUnread by the unread count for a specific conversation.
   * Called when the user opens a specific conversation inside the messages page.
   */
  markConversationRead: (otherUserId: string, count: number) => void;
  /**
   * Sync the total unread when the messages page is closed (or on initial open).
   * Lets the context stay in sync after the page computed its own totals.
   */
  syncTotalUnread: (total: number) => void;
  /**
   * Send a JSON message through the shared WebSocket connection.
   * Used for typing indicators.
   */
  sendWsMessage: (data: Record<string, unknown>) => void;
}

const DMContext = createContext<DMContextValue>({
  totalUnread: 0,
  isConnected: false,
  subscribe: () => () => {},
  setMessagesPageOpen: () => {},
  markConversationRead: () => {},
  syncTotalUnread: () => {},
  sendWsMessage: () => {},
});

export function useDM() {
  return useContext(DMContext);
}

// ─── Provider ─────────────────────────────────────────────────────────

export function DMProvider({ children }: { children: React.ReactNode }) {
  const { getAccessToken, userProfile } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Refs so closures inside the WS handlers always see the latest value
  const totalUnreadRef = useRef(0);
  const messagesPageOpenRef = useRef(false);
  const userIdRef = useRef("");

  // Subscriber set (messages page attaches here)
  const subscribers = useRef<Set<(event: DMEvent) => void>>(new Set());

  // WS lifecycle refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Context API ────────────────────────────────────────────────────

  const subscribe = useCallback((handler: (event: DMEvent) => void) => {
    subscribers.current.add(handler);
    return () => { subscribers.current.delete(handler); };
  }, []);

  const setMessagesPageOpen = useCallback((open: boolean) => {
    messagesPageOpenRef.current = open;
  }, []);

  const markConversationRead = useCallback((_otherUserId: string, count: number) => {
    if (count > 0) {
      totalUnreadRef.current = Math.max(0, totalUnreadRef.current - count);
      setTotalUnread(totalUnreadRef.current);
    }
  }, []);

  const syncTotalUnread = useCallback((total: number) => {
    totalUnreadRef.current = total;
    setTotalUnread(total);
  }, []);

  const sendWsMessage = useCallback((data: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  // ── WebSocket management ───────────────────────────────────────────

  useEffect(() => {
    if (!userProfile) return;
    // External students can't use DM (backend blocks them)
    if (isExternalStudent(userProfile.department)) return;
    const userId = userProfile.id;
    if (!userId) return;

    userIdRef.current = userId;
    closedRef.current = false;

    const connect = async () => {
      if (closedRef.current) return;
      const token = await getAccessToken();
      if (!token || closedRef.current) return;

      const wsUrl = getWsUrl(`/api/v1/messages/ws?token=${token}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Start heartbeat to keep connection alive through proxies
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30_000);
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data) as DMEvent;

          // Track unread count — but ONLY when the messages page is not open
          // (while messages page is open it manages unread itself via subscribe)
          if (
            packet.type === "new_message" &&
            !messagesPageOpenRef.current
          ) {
            const msg = packet.data as { senderId?: string };
            // Only count messages that arrive FROM someone else
            if (msg?.senderId && msg.senderId !== userIdRef.current) {
              totalUnreadRef.current += 1;
              setTotalUnread(totalUnreadRef.current);
            }
          }

          // Broadcast to all subscribers (messages page, etc.)
          subscribers.current.forEach((h) => {
            try { h(packet); } catch { /* ignore subscriber errors */ }
          });
        } catch { /* ignore malformed packets */ }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        if (!closedRef.current) {
          reconnectTimer.current = setTimeout(connect, 4_000);
        }
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      closedRef.current = true;
      setIsConnected(false);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [userProfile, getAccessToken]);

  return (
    <DMContext.Provider
      value={{
        totalUnread,
        isConnected,
        subscribe,
        setMessagesPageOpen,
        markConversationRead,
        syncTotalUnread,
        sendWsMessage,
      }}
    >
      {children}
    </DMContext.Provider>
  );
}
