"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import Link from "next/link";

interface AnnouncementPreview {
  id: string;
  _id?: string;
  title: string;
  content: string;
  priority: string;
  authorName?: string;
  createdAt: string;
  isRead?: boolean;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-coral",
  high: "bg-sunny",
  normal: "bg-lavender",
  low: "bg-cloud",
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const { getAccessToken, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementPreview[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/announcements/?limit=10"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data: AnnouncementPreview[] = await res.json();
      const mapped = data.map((a) => ({ ...a, id: a.id || a._id || "" }));
      setAnnouncements(mapped);
      setUnreadCount(mapped.filter((a) => a.isRead === false).length);
    } catch {
      // silently fail — bell is non-critical
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, user]);

  /* Poll every 2 minutes */
  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAnnouncements]);

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
      const res = await fetch(getApiUrl(`/api/v1/announcements/${id}/read`), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // ignore
    }
  }, [getAccessToken]);

  const markAllRead = useCallback(async () => {
    const unread = announcements.filter((a) => a.isRead === false);
    await Promise.allSettled(unread.map((a) => markAsRead(a.id)));
  }, [announcements, markAsRead]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-xl bg-ghost border-[3px] border-navy flex items-center justify-center hover:bg-lime-light hover:border-lime transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <svg className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
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
        <div className="absolute right-0 top-[calc(100%+8px)] w-80 sm:w-96 bg-snow border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000] z-50 overflow-hidden">
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
              <button onClick={() => setOpen(false)} className="text-slate hover:text-navy">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-[3px] border-navy border-t-lime rounded-full animate-spin" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <svg className="w-8 h-8 text-cloud" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
                </svg>
                <p className="text-slate text-sm font-normal">No announcements</p>
              </div>
            ) : (
              announcements.map((a) => (
                <Link
                  key={a.id}
                  href={`/dashboard/announcements?highlight=${a.id}`}
                  onClick={() => {
                    setOpen(false);
                    if (a.isRead === false) markAsRead(a.id);
                  }}
                  className={`block border-b-[2px] border-cloud transition-colors cursor-pointer ${
                    a.isRead === false ? "bg-lime-light/60 hover:bg-lime-light/80" : "bg-snow hover:bg-ghost"
                  }`}
                >
                  <div className="flex gap-3 px-4 py-3">
                    {/* Priority dot */}
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[a.priority] ?? "bg-cloud"}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${a.isRead === false ? "font-display font-black text-navy" : "font-normal text-navy/80"}`}>
                          {a.title}
                        </p>
                        {a.isRead === false && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-coral mt-1.5" />
                        )}
                      </div>
                      <p className="text-slate text-xs mt-0.5 line-clamp-1 font-normal">{a.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate font-normal">{timeAgo(a.createdAt)}</span>
                        {a.authorName && (
                          <span className="text-[10px] text-slate font-normal">· {a.authorName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t-[3px] border-navy px-5 py-3 bg-ghost">
            <Link
              href="/dashboard/announcements"
              onClick={() => setOpen(false)}
              className="text-sm font-display font-black text-navy hover:text-lavender transition-colors"
            >
              View all announcements →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
