"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

/* ─── Types ─────────────────────────────────────────────────────── */

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  authorName?: string;
  author?: {
    firstName: string;
    lastName: string;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
  viewCount: number;
}

/* ─── Helpers ───────────────────────────────────────────────────── */

const priorityConfig: Record<string, { tag: string; dot: string; border: string }> = {
  urgent: { tag: "bg-coral text-snow", dot: "bg-coral", border: "border-coral" },
  high: { tag: "bg-sunny text-navy", dot: "bg-sunny", border: "border-navy" },
  normal: { tag: "bg-cloud text-navy", dot: "bg-navy/30", border: "border-navy" },
  low: { tag: "bg-cloud text-slate", dot: "bg-slate/30", border: "border-navy/60" },
};

const categoryColors: Record<string, string> = {
  academic: "bg-lavender",
  event: "bg-teal",
  general: "bg-navy/50",
  financial: "bg-coral",
  social: "bg-sunny",
};

/* ─── Component ─────────────────────────────────────────────────── */

export default function AnnouncementsPage() {
  const { user, getAccessToken } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchAnnouncements();
      fetchReadStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchAnnouncements = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/announcements/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch announcements: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      const mappedData = data.map((item: Announcement & { _id?: string }) => ({
        ...item,
        id: item.id || item._id,
      }));
      setAnnouncements(mappedData);
    } catch (err) {
      console.error("Error fetching announcements:", err);
      setError("Failed to load announcements. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchReadStatus = async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/announcements/reads/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const readIds = await response.json();
        setReadAnnouncements(new Set(readIds));
      }
    } catch (err) {
      console.error("Error fetching read status:", err);
    }
  };

  const markAsRead = async (id: string) => {
    if (!user || readAnnouncements.has(id)) return;
    try {
      const token = await getAccessToken();
      await fetch(getApiUrl(`/api/v1/announcements/${id}/read`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setReadAnnouncements((prev) => new Set([...prev, id]));
    } catch (err) {
      console.error("Error marking announcement as read:", err);
    }
  };

  const handleToggle = (id: string) => {
    if (openId === id) {
      setOpenId(null);
    } else {
      setOpenId(id);
      markAsRead(id);
    }
  };

  const filtered = announcements.filter((a) => {
    if (filter === "all") return true;
    if (filter === "read") return readAnnouncements.has(a.id);
    if (filter === "unread") return !readAnnouncements.has(a.id);
    return true;
  });

  const unreadCount = announcements.length - readAnnouncements.size;

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader title="Announcements" />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-[3px] border-lavender border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate uppercase tracking-wider">Loading announcements…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Announcements" />

      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">

        {/* ═══════════════════════════════════════════════════════
            HERO — Bento header row
            ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">

          {/* Title block */}
          <div className="md:col-span-7 bg-lavender border-[5px] border-navy rounded-[2rem] p-8 relative overflow-hidden min-h-[170px] flex flex-col justify-between">
            {/* decorative */}
            <div className="absolute -bottom-10 -right-10 w-36 h-36 rounded-full bg-navy/8 pointer-events-none" />
            <svg className="absolute top-5 right-8 w-5 h-5 text-navy/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>

            <div>
              <p className="text-[10px] font-bold text-snow/60 uppercase tracking-[0.15em] mb-2">Department Updates</p>
              <h1 className="font-display font-black text-3xl md:text-4xl text-snow leading-[0.95]">
                Announcements
              </h1>
            </div>
            <p className="text-snow/60 text-xs font-medium mt-4">
              {announcements.length} total &middot; {unreadCount} unread
            </p>
          </div>

          {/* Stats mini-cards */}
          <div className="md:col-span-5 grid grid-cols-2 gap-3">
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-coral-light flex items-center justify-center mb-3">
                <svg className="w-4.5 h-4.5 text-coral" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Unread</p>
              <p className="font-display font-black text-3xl text-navy">{unreadCount}</p>
            </div>
            <div className="bg-teal-light border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-teal/20 flex items-center justify-center mb-3">
                <svg className="w-4.5 h-4.5 text-teal" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Read</p>
              <p className="font-display font-black text-3xl text-navy">{readAnnouncements.size}</p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            ERROR BANNER
            ═══════════════════════════════════════════════════════ */}
        {error && (
          <div className="bg-coral-light border-[3px] border-navy rounded-2xl p-4 mb-5 shadow-[4px_4px_0_0_#000] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-coral flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-snow" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm font-medium text-navy">{error}</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            FILTER TABS
            ═══════════════════════════════════════════════════════ */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {[
            { key: "all", label: `All (${announcements.length})`, activeBg: "bg-navy", activeText: "text-snow" },
            { key: "unread", label: `Unread (${unreadCount})`, activeBg: "bg-coral", activeText: "text-snow" },
            { key: "read", label: `Read (${readAnnouncements.size})`, activeBg: "bg-teal", activeText: "text-snow" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-5 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl border-[3px] transition-all whitespace-nowrap ${
                filter === tab.key
                  ? `${tab.activeBg} ${tab.activeText} border-navy shadow-[3px_3px_0_0_#000]`
                  : "text-slate hover:text-navy bg-snow border-navy/20 hover:border-navy"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════
            ANNOUNCEMENTS LIST
            ═══════════════════════════════════════════════════════ */}
        {filtered.length === 0 ? (
          <div className="bg-snow border-[4px] border-navy rounded-3xl p-12 text-center shadow-[6px_6px_0_0_#000]">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-lavender-light flex items-center justify-center">
              <svg className="w-8 h-8 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-display font-black text-xl text-navy mb-2">
              {filter === "all" ? "No announcements yet" : filter === "unread" ? "All caught up!" : "No read announcements"}
            </h3>
            <p className="text-sm text-slate">
              {filter === "all" ? "Check back later for department updates" : filter === "unread" ? "You've read every announcement" : "Open an announcement to mark it as read"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((announcement, index) => {
              const isOpen = openId === announcement.id;
              const isRead = readAnnouncements.has(announcement.id);
              const pConfig = priorityConfig[announcement.priority?.toLowerCase()] || priorityConfig.normal;
              const catColor = categoryColors[announcement.category?.toLowerCase()] || "bg-navy/30";

              return (
                <article
                  key={announcement.id}
                  className={`rounded-3xl overflow-hidden transition-all ${
                    isRead
                      ? "bg-cloud border-[3px] border-navy/15"
                      : "bg-snow border-[4px] border-navy shadow-[5px_5px_0_0_#000] hover:shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px]"
                  }`}
                >
                  <button
                    onClick={() => handleToggle(announcement.id)}
                    className="w-full px-5 md:px-7 py-5 md:py-6 text-left flex items-start gap-4"
                  >
                    {/* Number */}
                    <span className={`font-display font-black text-lg mt-0.5 w-8 text-center shrink-0 ${isRead ? "text-navy/15" : "text-navy/25"}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className={`font-display font-black text-base md:text-lg leading-snug ${isRead ? "text-navy/45" : "text-navy"}`}>
                          {announcement.title}
                        </h3>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${pConfig.tag}`}>
                          {announcement.priority?.toUpperCase()}
                        </span>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Category dot */}
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate uppercase tracking-[0.1em]">
                          <span className={`w-2 h-2 rounded-full ${catColor}`} />
                          {announcement.category}
                        </span>

                        <span className="text-navy/15">|</span>

                        {/* Author */}
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate uppercase tracking-[0.1em]">
                          <svg className="w-3 h-3 text-slate" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                          </svg>
                          {announcement.authorName ||
                            (announcement.author
                              ? `${announcement.author.firstName} ${announcement.author.lastName}`
                              : "IESA Admin")}
                        </span>

                        <span className="text-navy/15">|</span>

                        {/* Date */}
                        <span className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">
                          {new Date(announcement.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>

                    {/* Indicators */}
                    <div className="flex items-center gap-2 shrink-0 mt-1">
                      {!isRead && <span className="w-2 h-2 bg-coral rounded-full animate-pulse" />}
                      <svg className={`w-5 h-5 text-slate transition-transform ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isOpen && (
                    <div className="px-5 md:px-7 pb-6 pt-0 ml-12">
                      <div className="bg-ghost border-[3px] border-navy/10 rounded-2xl p-5 md:p-6">
                        <p className="text-sm text-navy/70 leading-relaxed whitespace-pre-wrap">
                          {announcement.content}
                        </p>
                        <div className="mt-4 pt-4 border-t border-navy/10 flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate uppercase tracking-wider flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-teal" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                            </svg>
                            Read
                          </span>
                          {announcement.viewCount > 0 && (
                            <span className="text-[10px] font-bold text-slate uppercase tracking-wider flex items-center gap-1.5">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                                <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clipRule="evenodd" />
                              </svg>
                              {announcement.viewCount} views
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
