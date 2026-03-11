"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

interface UrgentAnnouncement {
  _id?: string;
  id?: string;
  title: string;
  content: string;
  priority: string;
  createdAt: string;
  isRead?: boolean;
}

export default function UrgentBar() {
  const { user, getAccessToken } = useAuth();
  const [urgents, setUrgents] = useState<UrgentAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) return;
      try {
        const token = await getAccessToken();
        const res = await fetch(getApiUrl("/api/v1/announcements"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data: UrgentAnnouncement[] = await res.json();
        if (!cancelled) {
          setUrgents(
            data.filter((a) => (a.priority === "urgent" || a.priority === "high") && !a.isRead)
          );
        }
      } catch {
        // Silently fail
      }
    };

    load();
    const interval = setInterval(load, 180_000);

    // Instant refresh when SSE dispatches an announcement event
    const handleSSE = () => load();
    window.addEventListener("sse:notification", handleSSE);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("sse:notification", handleSSE);
    };
  }, [user, getAccessToken]);

  const markRead = async (id: string) => {
    try {
      const token = await getAccessToken();
      await fetch(getApiUrl(`/api/v1/announcements/${id}/read`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // silent
    }
    setDismissed((prev) => new Set(prev).add(id));
  };

  const visible = urgents.filter((a) => {
    const id = a._id || a.id || "";
    return !dismissed.has(id);
  });

  if (visible.length === 0) return null;

  return (
    <div className="bg-coral border-b-[3px] border-navy px-4 md:px-6 lg:px-8 py-2.5">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="shrink-0">
          <svg aria-hidden="true" className="w-5 h-5 text-snow animate-pulse" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Messages - show first urgent, or all if few */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {visible.length === 1 ? (
            <p className="text-snow text-sm font-bold truncate">{visible[0].title}</p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="bg-snow/20 text-snow text-xs font-black px-2 py-0.5 rounded-full shrink-0">
                {visible.length}
              </span>
              <p className="text-snow text-sm font-bold truncate">
                {visible[0].title}
                {visible.length > 1 && ` (+${visible.length - 1} more)`}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/dashboard/announcements"
            className="text-snow/80 text-xs font-bold hover:text-snow transition-colors underline underline-offset-2"
          >
            View All
          </a>
          <button
            onClick={() => {
              visible.forEach((a) => {
                const id = a._id || a.id || "";
                if (id) markRead(id);
              });
            }}
            className="p-1.5 rounded-lg hover:bg-snow/20 transition-colors"
            aria-label="Dismiss urgent notifications"
          >
            <svg aria-hidden="true" className="w-4 h-4 text-snow" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
