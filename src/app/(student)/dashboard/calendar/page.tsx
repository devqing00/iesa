"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

/* ─── Types ─────────────────────────────────── */

interface IESAEvent {
  id: string;
  _id?: string;
  title: string;
  date: string;
  location: string;
  category: string;
  description: string;
  requiresPayment: boolean;
  paymentAmount?: number;
  maxAttendees?: number;
  registrationDeadline?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: IESAEvent;
}

/* ─── Localizer ─────────────────────────────── */

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});

/* ─── Category colors ────────────────────────── */

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Academic:    { bg: "#C8B8FF", border: "#7C5CBF", text: "#1a0a3d" },
  Social:      { bg: "#ADEDD4", border: "#3BA882", text: "#0d3326" },
  Career:      { bg: "#FFE082", border: "#D4A800", text: "#332800" },
  Workshop:    { bg: "#FFB199", border: "#D4562A", text: "#3d0d00" },
  Competition: { bg: "#B8E8FF", border: "#2A7FB3", text: "#001f33" },
  Other:       { bg: "#F0F0F0", border: "#888888", text: "#111111" },
};

/* ─── Component ──────────────────────────────── */

export default function CalendarPage() {
  const { getAccessToken } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<IESAEvent | null>(null);
  const [currentView, setCurrentView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchEvents = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/events/"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch events");
      const data: IESAEvent[] = await res.json();
      const mapped: CalendarEvent[] = data.map((e) => {
        const id = e.id || e._id || "";
        const start = new Date(e.date);
        // Default duration 2 hours
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
        return { id, title: e.title, start, end, resource: { ...e, id } };
      });
      setEvents(mapped);
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /* Custom event style */
  const eventStyleGetter = (event: CalendarEvent) => {
    const cat = event.resource.category ?? "Other";
    const colors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;
    return {
      style: {
        backgroundColor: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: "8px",
        color: colors.text,
        fontWeight: "700",
        fontSize: "12px",
        padding: "2px 6px",
      },
    };
  };

  const upcomingEvents = events
    .filter((e) => e.start >= new Date())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 5);

  return (
    <div>
      <DashboardHeader title="Calendar" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div>
          <p className="text-label uppercase tracking-wider text-slate mb-1">Dashboard › Events</p>
          <h1 className="font-display font-black text-display-lg text-navy leading-tight">
            Event <span className="brush-highlight">Calendar</span>
          </h1>
          <p className="text-slate mt-2 font-normal">All upcoming and past events in one place.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-3 bg-snow border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000] overflow-hidden">
            {/* View switcher */}
            <div className="flex items-center gap-2 px-5 py-4 border-b-[3px] border-navy bg-ghost flex-wrap">
              {(["month", "week", "agenda"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setCurrentView(v)}
                  className={`px-4 py-2 rounded-xl border-[3px] font-display text-sm capitalize transition-all ${
                    currentView === v
                      ? "bg-navy border-navy text-lime shadow-[3px_3px_0_0_#0F0F2D]"
                      : "bg-ghost border-navy text-navy hover:bg-lime-light"
                  }`}
                >
                  {v}
                </button>
              ))}
              <button
                onClick={() => setCurrentDate(new Date())}
                className="ml-auto px-4 py-2 rounded-xl border-[3px] border-navy bg-lime font-display text-navy text-sm shadow-[3px_3px_0_0_#0F0F2D] hover:shadow-[5px_5px_0_0_#0F0F2D] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
              >
                Today
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-[520px]">
                <div className="w-10 h-10 border-[4px] border-navy border-t-lime rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-4 calendar-wrapper">
                <Calendar
                  localizer={localizer}
                  events={events}
                  view={currentView}
                  onView={setCurrentView}
                  date={currentDate}
                  onNavigate={setCurrentDate}
                  style={{ height: 520 }}
                  eventPropGetter={eventStyleGetter}
                  onSelectEvent={(event) => setSelectedEvent(event.resource)}
                  popup
                  showMultiDayTimes
                />
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-5">
            {/* Legend */}
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-5 shadow-[8px_8px_0_0_#000]">
              <p className="font-display font-black text-navy text-sm uppercase tracking-wider mb-3">Categories</p>
              <div className="space-y-2">
                {Object.entries(CATEGORY_COLORS).map(([cat, c]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.bg, border: `2px solid ${c.border}` }}
                    />
                    <span className="text-navy text-sm font-normal">{cat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming events */}
            <div className="bg-navy border-[4px] border-lime rounded-3xl p-5 shadow-[8px_8px_0_0_#C8F31D]">
              <p className="font-display font-black text-lime text-sm uppercase tracking-wider mb-3">
                Upcoming
              </p>
              {upcomingEvents.length === 0 ? (
                <p className="text-slate text-sm font-normal">No upcoming events</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEvent(e.resource)}
                      className="w-full text-left group"
                    >
                      <p className="text-snow text-sm font-display font-black group-hover:text-lime transition-colors line-clamp-1">
                        {e.title}
                      </p>
                      <p className="text-slate text-xs font-normal mt-0.5">
                        {format(e.start, "d MMM, h:mm a")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 bg-navy/60 flex items-center justify-center px-4 pt-4 pb-20 md:p-6"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-snow border-[4px] border-navy rounded-3xl shadow-[10px_10px_0_0_#000] w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between gap-3 px-6 py-5 border-b-[3px] border-navy">
              <div className="flex-1 min-w-0">
                <span
                  className="inline-block text-label uppercase tracking-wider text-xs px-3 py-1 rounded-lg mb-2"
                  style={{
                    backgroundColor: CATEGORY_COLORS[selectedEvent.category]?.bg ?? "#F0F0F0",
                    color: CATEGORY_COLORS[selectedEvent.category]?.text ?? "#111",
                    border: `2px solid ${CATEGORY_COLORS[selectedEvent.category]?.border ?? "#888"}`,
                  }}
                >
                  {selectedEvent.category}
                </span>
                <h2 className="font-display font-black text-navy text-xl leading-tight">{selectedEvent.title}</h2>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="shrink-0 w-8 h-8 rounded-xl border-[3px] border-navy flex items-center justify-center hover:bg-coral-light transition-colors"
              >
                <svg className="w-4 h-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-ghost rounded-2xl border-[3px] border-navy p-3">
                  <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Date</p>
                  <p className="text-navy font-display font-black text-sm">
                    {format(new Date(selectedEvent.date), "EEEE, d MMM yyyy")}
                  </p>
                  <p className="text-slate text-xs font-normal">
                    {format(new Date(selectedEvent.date), "h:mm a")}
                  </p>
                </div>
                <div className="bg-ghost rounded-2xl border-[3px] border-navy p-3">
                  <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Location</p>
                  <p className="text-navy font-display font-black text-sm">{selectedEvent.location}</p>
                </div>
              </div>

              {selectedEvent.description && (
                <div>
                  <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Description</p>
                  <p className="text-navy text-sm font-normal leading-relaxed">{selectedEvent.description}</p>
                </div>
              )}

              {(selectedEvent.maxAttendees || selectedEvent.registrationDeadline) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedEvent.maxAttendees && (
                    <div className="bg-lavender-light rounded-xl border-[3px] border-lavender p-3">
                      <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Capacity</p>
                      <p className="text-navy font-display font-black text-sm">{selectedEvent.maxAttendees} attendees</p>
                    </div>
                  )}
                  {selectedEvent.registrationDeadline && (
                    <div className="bg-sunny-light rounded-xl border-[3px] border-sunny p-3">
                      <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Deadline</p>
                      <p className="text-navy font-display font-black text-sm">
                        {format(new Date(selectedEvent.registrationDeadline), "d MMM yyyy")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedEvent.requiresPayment && (
                <div className="bg-coral-light border-[3px] border-coral rounded-2xl p-4 flex items-center gap-3">
                  <svg className="w-5 h-5 text-coral shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" />
                    <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
                  </svg>
                  <p className="text-coral font-display font-black text-sm">
                    Payment required — ₦{selectedEvent.paymentAmount?.toLocaleString() ?? "TBD"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
