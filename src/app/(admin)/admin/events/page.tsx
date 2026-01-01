"use client";

import { useState } from "react";

export default function AdminEventsPage() {
  const [viewMode, setViewMode] = useState<"upcoming" | "past">("upcoming");

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-[var(--foreground)] mb-2">
          Event Management
        </h1>
        <p className="text-[var(--foreground)]/60">
          Create and manage departmental events
        </p>
      </div>

      {/* Actions & Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("upcoming")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === "upcoming"
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--glass-bg)] text-[var(--foreground)]/60 border border-[var(--glass-border)] hover:text-[var(--foreground)]"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setViewMode("past")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === "past"
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--glass-bg)] text-[var(--foreground)]/60 border border-[var(--glass-border)] hover:text-[var(--foreground)]"
            }`}
          >
            Past Events
          </button>
        </div>

        <button className="px-6 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity">
          Create Event
        </button>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8 text-center">
          <svg
            className="h-12 w-12 mx-auto mb-4 text-[var(--foreground)]/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-[var(--foreground)]/60">
            No {viewMode} events yet
          </p>
          <button className="mt-4 text-[var(--primary)] hover:underline">
            Create your first event
          </button>
        </div>
      </div>
    </div>
  );
}
