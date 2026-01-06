"use client";

import { useState, useEffect } from "react";

interface Event {
  _id: string;
  id?: string;
  title: string;
  description: string;
  date: string;
  location: string;
  category: string;
  maxAttendees?: number;
  registeredCount?: number;
  imageUrl?: string;
}

export default function AdminEventsPage() {
  const [viewMode, setViewMode] = useState<"upcoming" | "past">("upcoming");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch("/api/v1/events");
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map((item: Event & { _id?: string }) => ({
          ...item,
          id: item.id || item._id,
        }));
        setEvents(mappedData);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const filteredEvents = events.filter((event) => {
    const eventDate = new Date(event.date);
    return viewMode === "upcoming" ? eventDate >= now : eventDate < now;
  });

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
        {loading ? (
          <div className="col-span-full rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8 text-center">
            <p className="text-[var(--foreground)]/60">Loading events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="col-span-full rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-8 text-center">
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-[var(--foreground)]/60">No {viewMode} events</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] overflow-hidden hover:border-[var(--primary)]/50 transition-colors"
            >
              {event.imageUrl && (
                <div className="aspect-video bg-[var(--foreground)]/5">
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-block px-2 py-1 rounded bg-blue-500/10 text-blue-500 text-xs font-medium">
                    {event.category}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                  {event.title}
                </h3>
                <p className="text-sm text-[var(--foreground)]/60 mb-4 line-clamp-2">
                  {event.description}
                </p>
                <div className="space-y-2 text-sm text-[var(--foreground)]/80">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {new Date(event.date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {event.location}
                  </div>
                  {event.maxAttendees && (
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      {event.registeredCount || 0}/{event.maxAttendees}{" "}
                      attendees
                    </div>
                  )}
                </div>
                <button className="mt-4 w-full px-4 py-2 rounded-lg border border-[var(--primary)] text-[var(--primary)] font-medium hover:bg-[var(--primary)] hover:text-white transition-colors">
                  Manage Event
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
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
