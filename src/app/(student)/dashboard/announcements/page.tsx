"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Bell, Calendar, User, ChevronDown, ChevronUp } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  author: {
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
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAnnouncements();
    fetchReadStatus();
  }, [user]);

  const fetchAnnouncements = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/announcements", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch announcements");
      }

      const data = await response.json();
      setAnnouncements(data);
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
      const response = await fetch("/api/announcements/reads/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
      const token = await user.getIdToken();
      await fetch(`/api/announcements/${id}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setReadAnnouncements(prev => new Set([...prev, id]));
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

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "urgent":
        return "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200";
      case "high":
        return "text-orange-600 bg-orange-50 dark:bg-orange-950/30 border-orange-200";
      case "normal":
        return "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200";
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-950/30 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <DashboardHeader title="Announcements" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Announcements" />
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 md:space-y-8 w-full">
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-800 dark:text-red-200 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === "all"
                ? "bg-primary text-white shadow-lg"
                : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === "unread"
                ? "bg-primary text-white shadow-lg"
                : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setFilter("read")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === "read"
                ? "bg-primary text-white shadow-lg"
                : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
            }`}
          >
            Read
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 mx-auto text-foreground/20 mb-4" />
            <p className="text-foreground/60">No announcements found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((announcement) => {
              const isOpen = openId === announcement.id;
              const isRead = readAnnouncements.has(announcement.id);

              return (
                <article
                  key={announcement.id}
                  className={`group rounded-xl border-2 transition-all ${
                    isRead
                      ? "bg-foreground/5 border-foreground/10"
                      : "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border-[var(--glass-border)] shadow-lg"
                  }`}
                >
                  <button
                    onClick={() => handleToggle(announcement.id)}
                    className="w-full px-4 md:px-6 py-4 text-left flex items-start gap-4 hover:bg-foreground/5 rounded-xl transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3
                          className={`font-heading font-bold text-base md:text-lg leading-snug ${
                            isRead ? "text-foreground/60" : "text-foreground"
                          }`}
                        >
                          {announcement.title}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(announcement.priority)}`}>
                          {announcement.priority}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-foreground/50 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {announcement.author.firstName} {announcement.author.lastName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(announcement.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Bell className="w-3 h-3" />
                          {announcement.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                      )}
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-foreground/40" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-foreground/40" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 md:px-6 pb-4 pt-2 border-t border-foreground/10 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
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
