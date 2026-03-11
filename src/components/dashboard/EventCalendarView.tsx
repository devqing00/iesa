"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import {
  listAcademicEvents,
  EVENT_TYPE_LABELS,
  type AcademicEvent,
  type AcademicEventType,
} from "@/lib/api/academic-calendar";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addMonths, addWeeks, subMonths, subWeeks } from "date-fns";
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
  allDay?: boolean;
  resource: IESAEvent | (AcademicEvent & { _source: "academic" });
}

/* ─── Localizer ─────────────────────────────── */

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});

/* ─── Category colors — IESA events ──────────── */

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Academic:    { bg: "#C8B8FF", border: "#7C5CBF", text: "#1a0a3d" },
  Social:      { bg: "#ADEDD4", border: "#3BA882", text: "#0d3326" },
  Career:      { bg: "#FFE082", border: "#D4A800", text: "#332800" },
  Workshop:    { bg: "#FFB199", border: "#D4562A", text: "#3d0d00" },
  Competition: { bg: "#B8E8FF", border: "#2A7FB3", text: "#001f33" },
  General:     { bg: "#F0F0F0", border: "#888888", text: "#111111" },
};

/* ─── Academic event type colors ─────────────── */

const ACADEMIC_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  exam_period:   { bg: "#FFD6CC", border: "#D4562A", text: "#3d0d00" },
  registration:  { bg: "#C5F0DF", border: "#2A9D6B", text: "#0d3326" },
  add_drop:      { bg: "#FFF3C4", border: "#B8920A", text: "#332800" },
  holiday:       { bg: "#E0D4F5", border: "#7C5CBF", text: "#1a0a3d" },
  break_period:  { bg: "#E0D4F5", border: "#7C5CBF", text: "#1a0a3d" },
  orientation:   { bg: "#C5F0DF", border: "#2A9D6B", text: "#0d3326" },
  convocation:   { bg: "#D4F5D0", border: "#4A9F40", text: "#0d330d" },
  lecture_start: { bg: "#C5F0DF", border: "#2A9D6B", text: "#0d3326" },
  lecture_end:   { bg: "#FFD6CC", border: "#D4562A", text: "#3d0d00" },
  deadline:      { bg: "#FFF3C4", border: "#B8920A", text: "#332800" },
  other:         { bg: "#F0F0F0", border: "#888888", text: "#111111" },
};

/* ─── Helper: check if academic event ────────── */
function isAcademicResource(r: CalendarEvent["resource"]): r is AcademicEvent & { _source: "academic" } {
  return "_source" in r && r._source === "academic";
}

/* ─── Component ──────────────────────────────── */

export default function EventCalendarView() {
  const { getAccessToken } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent["resource"] | null>(null);
  const [currentView, setCurrentView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAcademic, setShowAcademic] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const token = await getAccessToken();

      // Fetch IESA events
      const iesaPromise = fetch(getApiUrl("/api/v1/events/"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then(async (res) => {
        if (!res.ok) return [];
        const raw = await res.json();
        const data: IESAEvent[] = raw.items ?? raw;
        return data.map((e): CalendarEvent => {
          const id = e.id || e._id || "";
          const start = new Date(e.date);
          const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
          return { id, title: e.title, start, end, resource: { ...e, id } };
        });
      });

      // Fetch Academic Calendar events
      const academicPromise = listAcademicEvents().then((acEvents) =>
        acEvents.map((ae): CalendarEvent => {
          const start = new Date(ae.startDate);
          const end = ae.endDate ? new Date(ae.endDate) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
          // Multi-day events should be allDay
          const allDay = ae.endDate ? true : false;
          return {
            id: `ac-${ae.id}`,
            title: `📅 ${ae.title}`,
            start,
            end,
            allDay,
            resource: { ...ae, _source: "academic" as const },
          };
        })
      ).catch(() => [] as CalendarEvent[]);

      const [iesaEvents, academicEvents] = await Promise.all([iesaPromise, academicPromise]);
      setEvents([...iesaEvents, ...academicEvents]);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const eventStyleGetter = (event: CalendarEvent) => {
    const res = event.resource;
    if (isAcademicResource(res)) {
      const colors = ACADEMIC_COLORS[res.eventType] ?? ACADEMIC_COLORS.other;
      return {
        style: {
          backgroundColor: colors.bg,
          border: `2px dashed ${colors.border}`,
          borderRadius: "8px",
          color: colors.text,
          fontWeight: "700",
          fontSize: "11px",
          padding: "2px 6px",
        },
      };
    }
    const cat = (res as IESAEvent).category ?? "General";
    const colors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.General;
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

  const displayEvents = showAcademic
    ? events
    : events.filter((e) => !isAcademicResource(e.resource));

  const navigateBack = () => {
    setCurrentDate((d) => (currentView === "month" ? subMonths(d, 1) : subWeeks(d, 1)));
  };

  const navigateForward = () => {
    setCurrentDate((d) => (currentView === "month" ? addMonths(d, 1) : addWeeks(d, 1)));
  };

  const upcomingEvents = displayEvents
    .filter((e) => e.start >= new Date())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-snow border-[3px] border-navy rounded-3xl shadow-[3px_3px_0_0_#000] overflow-hidden">
          {/* View switcher + navigation */}
          <div className="flex items-center gap-2 px-5 py-4 border-b-[3px] border-navy bg-ghost flex-wrap">
            {/* Prev / Next arrows */}
            <button
              onClick={navigateBack}
              className="w-9 h-9 rounded-xl border-[3px] border-navy bg-snow flex items-center justify-center hover:bg-cloud transition-colors"
              aria-label="Previous"
            >
              <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={navigateForward}
              className="w-9 h-9 rounded-xl border-[3px] border-navy bg-snow flex items-center justify-center hover:bg-cloud transition-colors"
              aria-label="Next"
            >
              <svg aria-hidden="true" className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {/* Current date label */}
            <span className="font-display font-black text-navy text-sm min-w-[120px]">
              {currentView === "month"
                ? format(currentDate, "MMMM yyyy")
                : currentView === "week"
                ? `Week of ${format(currentDate, "MMM d, yyyy")}`
                : format(currentDate, "MMMM yyyy")}
            </span>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
            {(["month", "week", "agenda"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setCurrentView(v)}
                className={`px-4 py-2 rounded-xl border-[3px] font-display text-sm capitalize transition-all ${
                  currentView === v
                    ? "bg-navy border-lime text-snow shadow-[3px_3px_0_0_#C8F31D]"
                    : "bg-ghost border-navy text-navy hover:bg-cloud"
                }`}
              >
                {v}
              </button>
            ))}
            {/* Academic calendar toggle */}
            <button
              onClick={() => setShowAcademic((p) => !p)}
              className={`px-4 py-2 rounded-xl border-[3px] font-display text-sm transition-all ${
                showAcademic
                  ? "bg-lavender border-navy text-snow shadow-[3px_3px_0_0_#0F0F2D]"
                  : "bg-ghost border-navy/30 text-slate hover:bg-cloud"
              }`}
            >
              📅 Academic
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="ml-auto px-4 py-2 rounded-xl border-[3px] border-navy bg-lime font-display text-navy text-sm press-3 press-navy transition-all"
            >
              Today
            </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-[520px]">
              <div className="w-10 h-10 border-[3px] border-navy border-t-lime rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-4 calendar-wrapper">
              <Calendar
                localizer={localizer}
                events={displayEvents}
                view={currentView}
                onView={setCurrentView}
                date={currentDate}
                onNavigate={setCurrentDate}
                toolbar={false}
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
          {/* Legend — IESA Events */}
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[3px_3px_0_0_#000]">
            <p className="font-display font-black text-navy text-sm uppercase tracking-wider mb-3">Event Categories</p>
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
            {showAcademic && (
              <>
                <div className="mt-4 pt-3 border-t-[2px] border-cloud">
                  <p className="font-display font-black text-navy text-xs uppercase tracking-wider mb-2">Academic Calendar</p>
                  <div className="space-y-1.5">
                    {(["exam_period", "registration", "holiday", "deadline", "lecture_start", "lecture_end"] as AcademicEventType[]).map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded shrink-0"
                          style={{ backgroundColor: ACADEMIC_COLORS[t].bg, border: `2px dashed ${ACADEMIC_COLORS[t].border}` }}
                        />
                        <span className="text-navy text-xs font-normal">{EVENT_TYPE_LABELS[t]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Upcoming events */}
          <div className="bg-navy border-[3px] border-ghost/20 rounded-3xl p-5">
            <p className="font-display font-black text-snow text-sm uppercase tracking-wider mb-3">
              Upcoming
            </p>
            {upcomingEvents.length === 0 ? (
              <p className="text-slate text-sm font-normal">No upcoming events</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((e) => {
                  const isAcad = isAcademicResource(e.resource);
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEvent(e.resource)}
                      className="w-full text-left group"
                    >
                      <p className="text-snow text-sm font-display font-black group-hover:text-snow transition-colors line-clamp-1">
                        {e.title}
                      </p>
                      <p className="text-slate text-xs font-normal mt-0.5">
                        {isAcad
                          ? format(e.start, "d MMM yyyy")
                          : format(e.start, "d MMM, h:mm a")}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-[70] bg-navy/60 flex items-center justify-center px-4 py-4 sm:p-6"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-snow border-[3px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {isAcademicResource(selectedEvent) ? (
              /* ─── Academic event detail ──── */
              <>
                <div className="flex items-start justify-between gap-3 px-6 py-5 border-b-[3px] border-navy">
                  <div className="flex-1 min-w-0">
                    <span
                      className="inline-block text-label uppercase tracking-wider text-xs px-3 py-1 rounded-lg mb-2"
                      style={{
                        backgroundColor: ACADEMIC_COLORS[selectedEvent.eventType]?.bg ?? "#F0F0F0",
                        color: ACADEMIC_COLORS[selectedEvent.eventType]?.text ?? "#111",
                        border: `2px dashed ${ACADEMIC_COLORS[selectedEvent.eventType]?.border ?? "#888"}`,
                      }}
                    >
                      {EVENT_TYPE_LABELS[selectedEvent.eventType] ?? selectedEvent.eventType}
                    </span>
                    <h2 className="font-display font-black text-navy text-xl leading-tight">{selectedEvent.title}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="shrink-0 w-8 h-8 rounded-xl border-[3px] border-navy flex items-center justify-center hover:bg-coral-light transition-colors"
                  >
                    <svg aria-hidden="true" className="w-4 h-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-ghost rounded-2xl border-[3px] border-navy p-3">
                      <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Start Date</p>
                      <p className="text-navy font-display font-black text-sm">
                        {format(new Date(selectedEvent.startDate), "EEEE, d MMM yyyy")}
                      </p>
                    </div>
                    {selectedEvent.endDate && (
                      <div className="bg-ghost rounded-2xl border-[3px] border-navy p-3">
                        <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">End Date</p>
                        <p className="text-navy font-display font-black text-sm">
                          {format(new Date(selectedEvent.endDate), "EEEE, d MMM yyyy")}
                        </p>
                      </div>
                    )}
                    <div className="bg-lavender-light rounded-2xl border-[3px] border-lavender p-3">
                      <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Semester</p>
                      <p className="text-navy font-display font-black text-sm">Semester {selectedEvent.semester}</p>
                    </div>
                  </div>
                  {selectedEvent.description && (
                    <div>
                      <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Description</p>
                      <p className="text-navy text-sm font-normal leading-relaxed">{selectedEvent.description}</p>
                    </div>
                  )}
                  <div className="bg-lavender-light border-[2px] border-lavender/30 rounded-2xl p-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-lavender shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                    </svg>
                    <p className="text-navy text-xs font-display font-bold">Academic Calendar Event</p>
                  </div>
                </div>
              </>
            ) : (
              /* ─── IESA event detail ──── */
              <>
                <div className="flex items-start justify-between gap-3 px-6 py-5 border-b-[3px] border-navy">
                  <div className="flex-1 min-w-0">
                    <span
                      className="inline-block text-label uppercase tracking-wider text-xs px-3 py-1 rounded-lg mb-2"
                      style={{
                        backgroundColor: CATEGORY_COLORS[(selectedEvent as IESAEvent).category]?.bg ?? "#F0F0F0",
                        color: CATEGORY_COLORS[(selectedEvent as IESAEvent).category]?.text ?? "#111",
                        border: `2px solid ${CATEGORY_COLORS[(selectedEvent as IESAEvent).category]?.border ?? "#888"}`,
                      }}
                    >
                      {(selectedEvent as IESAEvent).category}
                    </span>
                    <h2 className="font-display font-black text-navy text-xl leading-tight">{selectedEvent.title}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="shrink-0 w-8 h-8 rounded-xl border-[3px] border-navy flex items-center justify-center hover:bg-coral-light transition-colors"
                  >
                    <svg aria-hidden="true" className="w-4 h-4 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-ghost rounded-2xl border-[3px] border-navy p-3">
                      <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Date</p>
                      <p className="text-navy font-display font-black text-sm">
                        {format(new Date((selectedEvent as IESAEvent).date), "EEEE, d MMM yyyy")}
                      </p>
                      <p className="text-slate text-xs font-normal">
                        {format(new Date((selectedEvent as IESAEvent).date), "h:mm a")}
                      </p>
                    </div>
                    <div className="bg-ghost rounded-2xl border-[3px] border-navy p-3">
                      <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Location</p>
                      <p className="text-navy font-display font-black text-sm">{(selectedEvent as IESAEvent).location}</p>
                    </div>
                  </div>

                  {(selectedEvent as IESAEvent).description && (
                    <div>
                      <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Description</p>
                      <p className="text-navy text-sm font-normal leading-relaxed">{(selectedEvent as IESAEvent).description}</p>
                    </div>
                  )}

                  {((selectedEvent as IESAEvent).maxAttendees || (selectedEvent as IESAEvent).registrationDeadline) && (
                    <div className="grid grid-cols-2 gap-4">
                      {(selectedEvent as IESAEvent).maxAttendees && (
                        <div className="bg-lavender-light rounded-xl border-[3px] border-lavender p-3">
                          <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Capacity</p>
                          <p className="text-navy font-display font-black text-sm">{(selectedEvent as IESAEvent).maxAttendees} attendees</p>
                        </div>
                      )}
                      {(selectedEvent as IESAEvent).registrationDeadline && (
                        <div className="bg-sunny-light rounded-xl border-[3px] border-sunny p-3">
                          <p className="text-label text-slate uppercase text-xs tracking-wider mb-1">Deadline</p>
                          <p className="text-navy font-display font-black text-sm">
                            {format(new Date((selectedEvent as IESAEvent).registrationDeadline!), "d MMM yyyy")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {(selectedEvent as IESAEvent).requiresPayment && (
                    <div className="bg-coral-light border-[3px] border-coral rounded-2xl p-4 flex items-center gap-3">
                      <svg aria-hidden="true" className="w-5 h-5 text-coral shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" />
                        <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
                      </svg>
                      <p className="text-coral font-display font-black text-sm">
                        Payment required — ₦{(selectedEvent as IESAEvent).paymentAmount?.toLocaleString() ?? "TBD"}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
