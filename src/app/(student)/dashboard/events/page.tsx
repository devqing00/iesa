"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  location: string;
  category: string;
  maxAttendees?: number;
  imageUrl?: string;
  requiresPayment: boolean;
  paymentAmount?: number;
  attendeeCount: number;
  organizer: {
    firstName: string;
    lastName: string;
    role: string;
  };
}

const CATEGORIES = [
  "All",
  "Academic",
  "Social",
  "Career",
  "Workshop",
  "General",
];

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [registeredEvents, setRegisteredEvents] = useState<Set<string>>(
    new Set()
  );
  const [registering, setRegistering] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchEvents();
      fetchRegistrations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchEvents = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const response = await fetch(
        getApiUrl("/api/v1/events?upcoming_only=true"),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      // Ensure id exists (map _id to id if needed)
      const mappedData = data.map((item: Event & { _id?: string }) => ({
        ...item,
        id: item.id || item._id,
      }));
      setEvents(mappedData);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to load events. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        getApiUrl("/api/v1/events/registrations/me"),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const eventIds = await response.json();
        setRegisteredEvents(new Set(eventIds));
      }
    } catch (err) {
      console.error("Error fetching registrations:", err);
    }
  };

  const handleRegister = async (eventId: string) => {
    if (!user) return;

    try {
      setRegistering(eventId);
      const token = await user.getIdToken();
      const response = await fetch(
        getApiUrl(`/api/v1/events/${eventId}/register`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to register");
      }

      setRegisteredEvents((prev) => new Set([...prev, eventId]));
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, attendeeCount: e.attendeeCount + 1 } : e
        )
      );
    } catch (err: unknown) {
      console.error("Error registering:", err);
      const message =
        err instanceof Error ? err.message : "Failed to register for event";
      alert(message);
    } finally {
      setRegistering(null);
    }
  };

  const handleUnregister = async (eventId: string) => {
    if (!user) return;

    try {
      setRegistering(eventId);
      const token = await user.getIdToken();
      const response = await fetch(
        getApiUrl(`/api/v1/events/${eventId}/register`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to unregister");
      }

      setRegisteredEvents((prev) => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, attendeeCount: Math.max(0, e.attendeeCount - 1) }
            : e
        )
      );
    } catch (err) {
      console.error("Error unregistering:", err);
      alert("Failed to unregister from event");
    } finally {
      setRegistering(null);
    }
  };

  const filteredEvents =
    activeCategory === "All"
      ? events
      : events.filter((e) => e.category === activeCategory);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <DashboardHeader title="Events" />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border border-border-dark border-t-transparent animate-spin mx-auto" />
            <p className="text-label-sm text-text-muted">Loading events...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Events" />

      <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
        {/* Header Section */}
        <section className="border-t border-border pt-8 mb-8">
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
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl text-text-primary">
                  Upcoming Events
                </h2>
                <p className="text-label-sm text-text-muted">
                  {filteredEvents.length}{" "}
                  {activeCategory === "All"
                    ? "total"
                    : activeCategory.toLowerCase()}{" "}
                  event{filteredEvents.length !== 1 ? "s" : ""} •{" "}
                  {registeredEvents.size} registered
                </p>
              </div>
            </div>
            <span className="page-number">Page 01</span>
          </div>
        </section>

        {error && (
          <div className="border border-border-dark p-4 text-body text-sm text-text-primary mb-6">
            <span className="text-label-sm text-text-muted mr-2">✦ Error</span>
            {error}
          </div>
        )}

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto border-b border-border pb-4 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 text-label-sm transition-colors whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-charcoal dark:bg-cream text-cream dark:text-charcoal"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filteredEvents.length === 0 ? (
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
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
            </div>
            <h3 className="font-display text-lg text-text-secondary mb-2">
              No events found
            </h3>
            <p className="text-body text-sm text-text-muted">
              {activeCategory === "All"
                ? "Check back later for upcoming events"
                : `No ${activeCategory.toLowerCase()} events scheduled`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event, index) => {
              const isRegistered = registeredEvents.has(event.id);
              const isProcessing = registering === event.id;
              const isFull = Boolean(
                event.maxAttendees && event.attendeeCount >= event.maxAttendees
              );

              return (
                <article
                  key={event.id}
                  className="border border-border hover:border-border-dark transition-colors"
                >
                  {/* Event Date Header */}
                  <div className="bg-charcoal dark:bg-cream p-6 relative">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-label-sm text-cream/60 dark:text-charcoal/60">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="font-display text-4xl text-cream dark:text-charcoal leading-none mt-1">
                          {new Date(event.date).getDate()}
                        </div>
                        <div className="text-label-sm text-cream/70 dark:text-charcoal/70 mt-1">
                          {formatDate(event.date).split(" ")[0]}{" "}
                          {new Date(event.date).getFullYear()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-label-sm text-cream/60 dark:text-charcoal/60">
                          ◆ {event.category}
                        </span>
                        {isRegistered && (
                          <span className="block text-label-sm text-cream dark:text-charcoal mt-2 border border-cream/30 dark:border-charcoal/30 px-2 py-0.5">
                            Registered
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="font-display text-lg text-text-primary mb-2 line-clamp-2">
                        {event.title}
                      </h3>
                      <p className="text-body text-sm text-text-secondary line-clamp-2">
                        {event.description}
                      </p>
                    </div>

                    <div className="space-y-2 text-label-sm text-text-muted">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>{formatTime(event.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                          />
                        </svg>
                        <span className="truncate">{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                          />
                        </svg>
                        <span>
                          {event.attendeeCount} registered
                          {event.maxAttendees && ` / ${event.maxAttendees} max`}
                        </span>
                      </div>
                    </div>

                    {isRegistered ? (
                      <button
                        onClick={() => handleUnregister(event.id)}
                        disabled={isProcessing}
                        className="w-full py-3 text-label-sm border border-border-dark text-text-primary hover:bg-bg-secondary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isProcessing ? (
                          <>
                            <div className="w-4 h-4 border border-border-dark border-t-transparent animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            Unregister
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRegister(event.id)}
                        disabled={isProcessing || isFull}
                        className={`w-full py-3 text-label-sm transition-colors flex items-center justify-center gap-2 ${
                          isFull
                            ? "bg-bg-secondary text-text-muted cursor-not-allowed"
                            : "bg-charcoal dark:bg-cream text-cream dark:text-charcoal hover:bg-charcoal-light dark:hover:bg-cream-dark disabled:opacity-50"
                        }`}
                      >
                        {isProcessing ? (
                          <>
                            <div className="w-4 h-4 border border-current border-t-transparent animate-spin" />
                            Processing...
                          </>
                        ) : isFull ? (
                          "Event Full"
                        ) : (
                          <>
                            Register Now
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 12.75l6 6 9-13.5"
                              />
                            </svg>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
