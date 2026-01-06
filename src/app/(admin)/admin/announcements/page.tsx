"use client";

import { useState, useEffect } from "react";

interface Announcement {
  _id: string;
  id?: string;
  title: string;
  content: string;
  targetAudience: string[];
  priority: string;
  createdAt: string;
  author?: {
    firstName: string;
    lastName: string;
  };
  authorName?: string;
}

export default function AdminAnnouncementsPage() {
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch("/api/v1/announcements");
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map(
          (item: Announcement & { _id?: string }) => ({
            ...item,
            id: item.id || item._id,
          })
        );
        setAnnouncements(mappedData);
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAnnouncements = announcements.filter((announcement) => {
    if (selectedLevel === "all") return true;
    return announcement.targetAudience.includes(selectedLevel);
  });

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-[var(--foreground)] mb-2">
          Announcements
        </h1>
        <p className="text-[var(--foreground)]/60">
          Create and manage announcements for students
        </p>
      </div>

      {/* Filters & Actions */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="px-4 py-2 rounded-lg bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="all">All Levels</option>
          <option value="100L">100 Level</option>
          <option value="200L">200 Level</option>
          <option value="300L">300 Level</option>
          <option value="400L">400 Level</option>
          <option value="500L">500 Level</option>
        </select>

        <button className="px-6 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity">
          Create Announcement
        </button>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8 text-center">
            <p className="text-[var(--foreground)]/60">
              Loading announcements...
            </p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8 text-center">
            <svg
              className="h-12 w-12 mx-auto mb-4 text-[var(--foreground)]/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
              />
            </svg>
            <p className="text-[var(--foreground)]/60">No announcements yet</p>
            <button className="mt-4 text-[var(--primary)] hover:underline">
              Create your first announcement
            </button>
          </div>
        ) : (
          filteredAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                    {announcement.title}
                  </h3>
                  <p className="text-sm text-[var(--foreground)]/60">
                    By{" "}
                    {announcement.authorName ||
                      (announcement.author
                        ? `${announcement.author.firstName} ${announcement.author.lastName}`
                        : "IESA Admin")}{" "}
                    • {new Date(announcement.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    announcement.priority === "high"
                      ? "bg-red-500/10 text-red-500"
                      : announcement.priority === "medium"
                      ? "bg-yellow-500/10 text-yellow-500"
                      : "bg-green-500/10 text-green-500"
                  }`}
                >
                  {announcement.priority}
                </span>
              </div>
              <p className="text-[var(--foreground)]/80 mb-4">
                {announcement.content}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--foreground)]/60">
                  Target:
                </span>
                {announcement.targetAudience.map((level, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2 py-1 rounded bg-blue-500/10 text-blue-500 text-xs font-medium"
                  >
                    {level}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
