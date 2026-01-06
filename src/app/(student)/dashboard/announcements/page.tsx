"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

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

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(
    new Set()
  );

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
      const token = await user.getIdToken();
      const apiUrl = getApiUrl("/api/v1/announcements");

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch announcements: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      // Map _id to id and ensure structure
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
      const token = await user.getIdToken();
      const response = await fetch(
        getApiUrl("/api/v1/announcements/reads/me"),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

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
      const token = await user.getIdToken();
      await fetch(getApiUrl(`/api/v1/announcements/${id}/read`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

  const getPriorityStyle = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "urgent":
        return "bg-charcoal dark:bg-cream text-cream dark:text-charcoal";
      case "high":
        return "border-border-dark text-text-primary";
      default:
        return "border-border text-text-secondary";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <DashboardHeader title="Announcements" />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border border-border-dark border-t-transparent animate-spin mx-auto" />
            <p className="text-label-sm text-text-muted">
              Loading announcements...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Announcements" />

      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 pb-24 md:pb-8">
        {/* Header Section */}
        <section className="border-t border-border pt-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-charcoal dark:bg-cream flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-cream dark:text-charcoal"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl text-text-primary">
                  Stay Updated
                </h2>
                <p className="text-label-sm text-text-muted">
                  {announcements.length} total •{" "}
                  {announcements.length - readAnnouncements.size} unread
                </p>
              </div>
            </div>
            <span className="page-number">Page 01</span>
          </div>
        </section>

        {error && (
          <div className="border border-border-dark p-4 text-body text-sm text-text-primary">
            <span className="text-label-sm text-text-muted mr-2">✦ Error</span>
            {error}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-border pb-4">
          {[
            { key: "all", label: `All (${announcements.length})` },
            {
              key: "unread",
              label: `Unread (${
                announcements.length - readAnnouncements.size
              })`,
            },
            { key: "read", label: `Read (${readAnnouncements.size})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-label-sm transition-colors ${
                filter === tab.key
                  ? "bg-charcoal dark:bg-cream text-cream dark:text-charcoal"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Announcements List */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 border border-border flex items-center justify-center">
              <svg
                className="w-8 h-8 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
            </div>
            <h3 className="font-display text-lg text-text-secondary mb-2">
              No announcements found
            </h3>
            <p className="text-body text-sm text-text-muted">
              {filter === "all"
                ? "Check back later for updates"
                : filter === "unread"
                ? "You're all caught up!"
                : "No read announcements yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((announcement, index) => {
              const isOpen = openId === announcement.id;
              const isRead = readAnnouncements.has(announcement.id);

              return (
                <article
                  key={announcement.id}
                  className={`border transition-colors ${
                    isRead
                      ? "border-border bg-bg-secondary"
                      : "border-border hover:border-border-dark"
                  }`}
                >
                  <button
                    onClick={() => handleToggle(announcement.id)}
                    className="w-full px-4 md:px-6 py-4 md:py-5 text-left flex items-start gap-4 transition-colors hover:bg-bg-secondary"
                  >
                    <span className="text-label-sm text-text-muted mt-0.5">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3
                          className={`font-display text-base leading-snug ${
                            isRead ? "text-text-secondary" : "text-text-primary"
                          }`}
                        >
                          {announcement.title}
                        </h3>
                        <span
                          className={`text-label-sm px-2 py-0.5 border shrink-0 ${getPriorityStyle(
                            announcement.priority
                          )}`}
                        >
                          {announcement.priority}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-label-sm text-text-muted flex-wrap">
                        <span className="flex items-center gap-1">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                            />
                          </svg>
                          {announcement.authorName ||
                            (announcement.author
                              ? `${announcement.author.firstName} ${announcement.author.lastName}`
                              : "IESA Admin")}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                            />
                          </svg>
                          {new Date(announcement.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </span>
                        <span>◆ {announcement.category}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isRead && (
                        <span className="w-1.5 h-1.5 bg-charcoal dark:bg-cream" />
                      )}
                      <svg
                        className={`w-4 h-4 text-text-muted transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 md:px-6 pb-4 md:pb-5 pt-0 border-t border-border ml-10 mr-4">
                      <p className="text-body text-sm text-text-secondary leading-relaxed whitespace-pre-wrap pt-4">
                        {announcement.content}
                      </p>
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
