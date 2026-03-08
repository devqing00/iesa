"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import Link from "next/link";

interface Notification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  relatedId?: string | null;
  isRead: boolean;
  createdAt: string;
}

/** Type-based color dot for each notification kind */
const TYPE_DOT: Record<string, string> = {
  announcement: "bg-lavender",
  event: "bg-teal",
  payment: "bg-sunny",
  transfer_approved: "bg-teal",
  transfer_rejected: "bg-coral",
  role_assigned: "bg-lime",
  enrollment: "bg-lavender",
  system: "bg-slate",
};

/** Human-readable type label */
const TYPE_LABEL: Record<string, string> = {
  announcement: "Announcement",
  event: "Event",
  payment: "Payment",
  transfer_approved: "Transfer",
  transfer_rejected: "Transfer",
  role_assigned: "Role",
  enrollment: "Enrollment",
  system: "System",
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const { getAccessToken, user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasFetchedRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      if (!token) return; // can't fetch without auth
      setFetching(true);
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };

      // Fetch notifications and unread count in parallel
      const [listRes, countRes] = await Promise.all([
        fetch(getApiUrl("/api/v1/notifications/?limit=20"), { headers }),
        fetch(getApiUrl("/api/v1/notifications/unread-count"), { headers }),
      ]);

      if (listRes.ok) {
        const data: Notification[] = await listRes.json();
        setNotifications(data);
      }
      if (countRes.ok) {
        const { count } = await countRes.json();
        setUnreadCount(count);
      }
      hasFetchedRef.current = true;
    } catch {
      // silently fail — bell is non-critical
    } finally {
      setFetching(false);
      setInitialLoading(false);
    }
  }, [getAccessToken, user]);

  /* Fetch when user becomes available + fallback poll every 60s + SSE push events */
  useEffect(() => {
    if (!user || authLoading) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60 * 1000);

    // Instant refresh when SSE dispatches a notification event
    const handleSSE = () => fetchNotifications();
    window.addEventListener("sse:notification", handleSSE);

    return () => {
      clearInterval(interval);
      window.removeEventListener("sse:notification", handleSSE);
    };
  }, [fetchNotifications, user, authLoading]);

  /* Close on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/notifications/${id}/read`), {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // ignore
    }
  }, [getAccessToken]);

  const markAllRead = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/notifications/mark-all-read"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch {
      // ignore
    }
  }, [getAccessToken]);

  /** Wrapper: renders Link when notification has a link, div otherwise */
  const NotificationRow = ({ n }: { n: Notification }) => {
    const inner = (
      <div className="flex gap-3 px-4 py-3">
        {/* Type dot */}
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${TYPE_DOT[n.type] ?? "bg-cloud"}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm leading-snug ${!n.isRead ? "font-display font-black text-navy" : "font-normal text-navy/80"}`}>
              {n.title}
            </p>
            {!n.isRead && (
              <span className="shrink-0 w-2 h-2 rounded-full bg-coral mt-1.5" />
            )}
          </div>
          <p className="text-slate text-xs mt-0.5 line-clamp-1 font-normal">{n.message}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate font-normal">{timeAgo(n.createdAt)}</span>
            <span className="text-[10px] text-slate font-normal">· {TYPE_LABEL[n.type] ?? n.type}</span>
          </div>
        </div>
      </div>
    );

    const className = `block border-b-[2px] border-cloud transition-colors cursor-pointer ${
      !n.isRead ? "bg-lime-light/60 hover:bg-cloud/80" : "bg-snow hover:bg-ghost"
    }`;

    const handleClick = () => {
      setOpen(false);
      if (!n.isRead) markAsRead(n._id);
    };

    if (n.link) {
      return (
        <Link href={n.link} onClick={handleClick} className={className}>
          {inner}
        </Link>
      );
    }
    return (
      <div onClick={handleClick} className={className} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleClick()}>
        {inner}
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-xl bg-ghost border-[3px] border-navy flex items-center justify-center hover:bg-cloud hover:border-navy transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <svg className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-coral border-[2px] border-snow rounded-full flex items-center justify-center">
            <span className="text-snow text-[10px] font-display font-black px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-80 sm:w-96 bg-snow border-[3px] border-navy rounded-3xl shadow-[3px_3px_0_0_#000] z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b-[3px] border-navy bg-ghost">
            <div className="flex items-center gap-2">
              <p className="font-display font-black text-navy text-base">Notifications</p>
              {unreadCount > 0 && (
                <span className="bg-coral text-snow text-xs font-display font-black px-2 py-0.5 rounded-lg">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-lavender font-display font-black hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate hover:text-navy" aria-label="Close notifications">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[60vh] overflow-y-auto">
            {initialLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-[3px] border-navy border-t-lime rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <svg className="w-8 h-8 text-cloud" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
                </svg>
                <p className="text-slate text-sm font-normal">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => <NotificationRow key={n._id} n={n} />)
            )}
          </div>

          {/* Footer */}
          <div className="border-t-[3px] border-navy px-5 py-3 bg-ghost">
            <Link
              href="/dashboard/announcements"
              onClick={() => setOpen(false)}
              className="text-sm font-display font-black text-navy hover:text-lavender transition-colors"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
