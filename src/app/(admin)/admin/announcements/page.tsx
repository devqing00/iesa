"use client";

import { useState } from "react";

export default function AdminAnnouncementsPage() {
  const [selectedLevel, setSelectedLevel] = useState("all");

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
        <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8 text-center">
          <svg
            className="h-12 w-12 mx-auto mb-4 text-[var(--foreground)]/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-[var(--foreground)]/60">
            No announcements yet
          </p>
          <button className="mt-4 text-[var(--primary)] hover:underline">
            Create your first announcement
          </button>
        </div>
      </div>
    </div>
  );
}
