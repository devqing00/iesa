"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Calendar, MapPin, Users, Clock, Tag, Check, X } from "lucide-react";

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

const CATEGORIES = ["All", "Academic", "Social", "Career", "Workshop", "General"];

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [registeredEvents, setRegisteredEvents] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
    fetchRegistrations();
  }, [user]);

  const fetchEvents = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/events?upcoming_only=true", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      setEvents(data);
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
      const response = await fetch("/api/events/registrations/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
      const response = await fetch(`/api/events/${eventId}/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to register");
      }

      setRegisteredEvents(prev => new Set([...prev, eventId]));
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, attendeeCount: e.attendeeCount + 1 } : e
      ));
    } catch (err: any) {
      console.error("Error registering:", err);
      alert(err.message || "Failed to register for event");
    } finally {
      setRegistering(null);
    }
  };

  const handleUnregister = async (eventId: string) => {
    if (!user) return;

    try {
      setRegistering(eventId);
      const token = await user.getIdToken();
      const response = await fetch(`/api/events/${eventId}/register`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to unregister");
      }

      setRegisteredEvents(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, attendeeCount: Math.max(0, e.attendeeCount - 1) } : e
      ));
    } catch (err) {
      console.error("Error unregistering:", err);
      alert("Failed to unregister from event");
    } finally {
      setRegistering(null);
    }
  };

  const filteredEvents = activeCategory === "All" 
    ? events 
    : events.filter(e => e.category === activeCategory);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <DashboardHeader title="Events" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Events" />
      <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-800 dark:text-red-200 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold font-heading text-foreground">Upcoming Events</h2>
            <p className="text-sm md:text-base text-foreground/60">Register for department activities and workshops.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-primary text-white shadow-lg"
                    : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 mx-auto text-foreground/20 mb-4" />
            <h3 className="text-xl font-bold text-foreground/40 mb-2">No events found</h3>
            <p className="text-foreground/60">Check back later for upcoming events</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const isRegistered = registeredEvents.has(event.id);
              const isProcessing = registering === event.id;
              const isFull = Boolean(event.maxAttendees && event.attendeeCount >= event.maxAttendees);

              return (
                <article 
                  key={event.id}
                  className="group relative bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-2xl flex flex-col"
                >
                  {/* Category Badge */}
                  <div className="absolute top-4 left-4 z-10">
                    <span className="bg-background/95 backdrop-blur-sm text-foreground px-3 py-1.5 rounded-lg text-xs font-bold border border-foreground/10">
                      <Tag className="w-3 h-3 inline-block mr-1" />
                      {event.category}
                    </span>
                  </div>

                  {/* Registration Status Badge */}
                  {isRegistered && (
                    <div className="absolute top-4 right-4 z-10">
                      <span className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Registered
                      </span>
                    </div>
                  )}

                  {/* Event Date Banner */}
                  <div className="h-40 bg-gradient-to-br from-primary to-primary/60 relative p-6 flex items-end">
                    <div className="relative z-10 bg-background/95 backdrop-blur-sm px-4 py-3 rounded-xl border border-foreground/10 text-center min-w-[90px]">
                      <div className="text-xs font-bold text-primary uppercase">{formatDate(event.date).split(' ')[0]}</div>
                      <div className="text-3xl font-bold font-heading text-foreground leading-none">{new Date(event.date).getDate()}</div>
                      <div className="text-xs text-foreground/60">{new Date(event.date).getFullYear()}</div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold font-heading text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {event.title}
                    </h3>
                    <p className="text-sm text-foreground/60 mb-4 line-clamp-2 flex-1">
                      {event.description}
                    </p>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-foreground/70">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>{formatTime(event.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-foreground/70">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span>{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-foreground/70">
                        <Users className="w-4 h-4 text-primary" />
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
                        className="w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 bg-red-50 dark:bg-red-950/30 text-red-600 border border-red-200 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <X className="w-4 h-4" />
                            Unregister
                          </>
                        )}
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleRegister(event.id)}
                        disabled={isProcessing || isFull}
                        className={`w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                          isFull
                            ? "bg-foreground/5 text-foreground/40 cursor-not-allowed"
                            : "bg-primary text-white hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        }`}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : isFull ? (
                          "Event Full"
                        ) : (
                          <>
                            Register Now
                            <Check className="w-4 h-4" />
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
