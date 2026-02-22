"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/* ─── Types ─────────────────────────────────────────────────────── */

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

/* ─── Constants ─────────────────────────────────────────────────── */

const CATEGORIES = ["All", "Academic", "Social", "Career", "Workshop", "General"];

const categoryPills: Record<string, { active: string }> = {
  All: { active: "bg-navy text-snow border-navy" },
  Academic: { active: "bg-lavender text-snow border-navy" },
  Social: { active: "bg-coral text-snow border-navy" },
  Career: { active: "bg-teal text-snow border-navy" },
  Workshop: { active: "bg-sunny text-navy border-navy" },
  General: { active: "bg-navy text-snow border-navy" },
};

const cardAccents = [
  { header: "bg-coral", dateBg: "bg-snow/15", dateText: "text-snow", catBg: "bg-snow/20", catText: "text-snow", border: "border-navy" },
  { header: "bg-lavender", dateBg: "bg-snow/15", dateText: "text-snow", catBg: "bg-snow/20", catText: "text-snow", border: "border-navy" },
  { header: "bg-teal", dateBg: "bg-navy/15", dateText: "text-navy", catBg: "bg-navy/15", catText: "text-navy", border: "border-navy" },
  { header: "bg-navy", dateBg: "bg-lime/20", dateText: "text-snow", catBg: "bg-snow/15", catText: "text-snow/80", border: "border-navy" },
  { header: "bg-sunny", dateBg: "bg-navy/10", dateText: "text-navy", catBg: "bg-navy/10", catText: "text-navy", border: "border-navy" },
];

/* ─── Helpers ───────────────────────────────────────────────────── */

const formatTime = (dateString: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(dateString));

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateString));

/* ─── Component ─────────────────────────────────────────────────── */

export default function EventsPage() {
  const { user, getAccessToken } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [registeredEvents, setRegisteredEvents] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState<string | null>(null);
  const toast = useToast();

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
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/events/?upcoming_only=true"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
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
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/events/registrations/me"), {
        headers: { Authorization: `Bearer ${token}` },
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
      const token = await getAccessToken();
      const response = await fetch(getApiUrl(`/api/v1/events/${eventId}/register`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to register");
      }
      setRegisteredEvents((prev) => new Set([...prev, eventId]));
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, attendeeCount: e.attendeeCount + 1 } : e)));
      toast.success("Registered!", "You've been registered for this event");
    } catch (err: unknown) {
      console.error("Error registering:", err);
      const message = err instanceof Error ? err.message : "Failed to register for event";
      toast.error("Registration Failed", message);
    } finally {
      setRegistering(null);
    }
  };

  const handleUnregister = async (eventId: string) => {
    if (!user) return;
    try {
      setRegistering(eventId);
      const token = await getAccessToken();
      const response = await fetch(getApiUrl(`/api/v1/events/${eventId}/register`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to unregister");
      setRegisteredEvents((prev) => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, attendeeCount: Math.max(0, e.attendeeCount - 1) } : e)));
      toast.success("Unregistered", "You've been removed from this event");
    } catch (err) {
      console.error("Error unregistering:", err);
      toast.error("Unregister Failed", "Failed to unregister from event");
    } finally {
      setRegistering(null);
    }
  };

  const filteredEvents = activeCategory === "All" ? events : events.filter((e) => e.category === activeCategory);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader title="Events" />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-[3px] border-coral border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate uppercase tracking-wider">Loading events…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Events" />

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">

        {/* ═══════════════════════════════════════════════════════
            HERO BENTO
            ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
          {/* Title block */}
          <div className="md:col-span-8 bg-coral border-[5px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[180px] flex flex-col justify-between">
            <div className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full bg-navy/8 pointer-events-none" />
            <svg className="absolute top-6 right-10 w-5 h-5 text-navy/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <svg className="absolute bottom-10 right-24 w-4 h-4 text-snow/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>

            <div>
              <p className="text-[10px] font-bold text-snow/60 uppercase tracking-[0.15em] mb-2">Department Calendar</p>
              <h1 className="font-display font-black text-3xl md:text-4xl text-snow leading-[0.95]">
                Upcoming Events
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              <span className="text-[10px] font-bold text-navy bg-snow/90 rounded-full px-3 py-1 uppercase tracking-wider">
                {events.length} event{events.length !== 1 ? "s" : ""}
              </span>
              <span className="text-[10px] font-bold text-navy bg-sunny rounded-full px-3 py-1 uppercase tracking-wider">
                {registeredEvents.size} registered
              </span>
            </div>
          </div>

          {/* Stats cards */}
          <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-3">
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-lavender-light flex items-center justify-center mb-2">
                <svg className="w-4.5 h-4.5 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Total</p>
              <p className="font-display font-black text-3xl text-navy">{events.length}</p>
            </div>
            <div className="bg-teal-light border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-teal/20 flex items-center justify-center mb-2">
                <svg className="w-4.5 h-4.5 text-teal" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Going</p>
              <p className="font-display font-black text-3xl text-navy">{registeredEvents.size}</p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            ERROR
            ═══════════════════════════════════════════════════════ */}
        {error && (
          <div className="bg-coral-light border-[3px] border-navy rounded-2xl p-4 mb-5 shadow-[3px_3px_0_0_#000] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-coral flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-snow" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm font-medium text-navy">{error}</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            CATEGORY FILTERS
            ═══════════════════════════════════════════════════════ */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
          {CATEGORIES.map((cat) => {
            const pill = categoryPills[cat] || categoryPills.General;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl border-[3px] transition-all whitespace-nowrap ${
                  isActive
                    ? `${pill.active} shadow-[3px_3px_0_0_#000]`
                    : "text-slate hover:text-navy bg-snow border-navy/20 hover:border-navy"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════
            EVENT CARDS
            ═══════════════════════════════════════════════════════ */}
        {filteredEvents.length === 0 ? (
          <div className="bg-snow border-[4px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sunny-light flex items-center justify-center">
              <svg className="w-8 h-8 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-display font-black text-xl text-navy mb-2">
              {activeCategory === "All" ? "No upcoming events" : `No ${activeCategory.toLowerCase()} events`}
            </h3>
            <p className="text-sm text-slate">Check back later for new events</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event, index) => {
              const isRegistered = registeredEvents.has(event.id);
              const isProcessing = registering === event.id;
              const isFull = Boolean(event.maxAttendees && event.attendeeCount >= event.maxAttendees);
              const accent = cardAccents[index % cardAccents.length];
              const rotation = index % 3 === 1 ? "rotate-[0.5deg] hover:rotate-0" : index % 3 === 2 ? "rotate-[-0.5deg] hover:rotate-0" : "";

              return (
                <article
                  key={event.id}
                  className={`bg-snow border-[4px] ${accent.border} rounded-3xl overflow-hidden press-4 press-black transition-all ${rotation}`}
                >
                  {/* Colored Header */}
                  <div className={`${accent.header} p-5 relative overflow-hidden`}>
                    <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-black/5 pointer-events-none" />
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={`font-display font-black text-5xl leading-none ${accent.dateText}`}>
                          {new Date(event.date).getDate()}
                        </div>
                        <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${accent.dateText} opacity-70`}>
                          {new Date(event.date).toLocaleDateString("en-US", { month: "short" })} {new Date(event.date).getFullYear()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${accent.catBg} ${accent.catText}`}>
                          {event.category}
                        </span>
                        {isRegistered && (
                          <span className="text-[10px] font-bold text-navy bg-lime rounded-full px-2.5 py-1 uppercase tracking-wider">
                            Going
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-4">
                    <div>
                      <h3 className="font-display font-black text-lg text-navy mb-1.5 line-clamp-2 leading-snug">{event.title}</h3>
                      <p className="text-xs text-slate line-clamp-2 leading-relaxed">{event.description}</p>
                    </div>

                    {/* Meta */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 text-xs text-navy/60">
                        <svg className="w-4 h-4 text-slate shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">{formatTime(event.date)} &middot; {formatDate(event.date)}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-navy/60">
                        <svg className="w-4 h-4 text-slate shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium truncate">{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-navy/60">
                        <svg className="w-4 h-4 text-slate shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">
                          {event.attendeeCount} going{event.maxAttendees ? ` / ${event.maxAttendees} max` : ""}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    {isRegistered ? (
                      <button
                        onClick={() => handleUnregister(event.id)}
                        disabled={isProcessing}
                        className="w-full py-3 font-bold text-xs uppercase tracking-wider border-[3px] border-navy text-navy hover:bg-cloud transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded-2xl"
                      >
                        {isProcessing ? (
                          <>
                            <div className="w-4 h-4 border-[2px] border-navy border-t-transparent rounded-full animate-spin" />
                            Processing…
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                            </svg>
                            Unregister
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRegister(event.id)}
                        disabled={isProcessing || isFull}
                        className={`w-full py-3 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 rounded-2xl border-[3px] ${
 isFull
 ?"bg-cloud text-slate border-navy/20 cursor-not-allowed"
 :"bg-lime text-navy border-navy press-3 press-navy disabled:opacity-50"
 }`}
                      >
                        {isProcessing ? (
                          <>
                            <div className="w-4 h-4 border-[2px] border-navy border-t-transparent rounded-full animate-spin" />
                            Processing…
                          </>
                        ) : isFull ? (
                          "Event Full"
                        ) : (
                          <>
                            Register Now
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
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
