"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format } from "date-fns/format";
import { parse } from "date-fns/parse";
import { startOfWeek } from "date-fns/startOfWeek";
import { getDay } from "date-fns/getDay";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { addDays, isSameDay, parseISO } from "date-fns";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useToast } from "@/components/ui/Toast";

/* ─── Calendar setup ────────────────────────────────────────────── */

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

/* ─── Types ─────────────────────────────────────────────────────── */

interface ClassSession {
  _id: string;
  courseCode: string;
  courseTitle: string;
  lecturer: string;
  day: string;
  startTime: string;
  endTime: string;
  venue: string;
  classType: "lecture" | "practical" | "tutorial";
  recurring: boolean;
  level: number;
  sessionId: string;
  createdBy: string;
  createdAt: string;
}

interface ClassCancellation {
  _id: string;
  classSessionId: string;
  date: string;
  reason: string;
  cancelledBy: string;
  cancelledAt: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    classSession: ClassSession;
    isCancelled: boolean;
    cancellationReason?: string;
  };
}

/* ─── Constants ─────────────────────────────────────────────────── */

const typeStyles: Record<string, { bg: string; text: string; calColor: string; dot: string }> = {
  lecture: { bg: "bg-navy", text: "text-snow", calColor: "#0F0F2D", dot: "bg-navy" },
  practical: { bg: "bg-coral", text: "text-snow", calColor: "#d45555", dot: "bg-coral" },
  tutorial: { bg: "bg-teal", text: "text-navy", calColor: "#5ec4b6", dot: "bg-teal" },
};

const todayCardColors = [
  { bg: "bg-snow", border: "border-navy", shadow: "shadow-[5px_5px_0_0_#000]", text: "text-navy", sub: "text-slate" },
  { bg: "bg-lavender-light", border: "border-navy", shadow: "shadow-[5px_5px_0_0_#000]", text: "text-navy", sub: "text-navy/50" },
  { bg: "bg-coral-light", border: "border-navy", shadow: "shadow-[5px_5px_0_0_#000]", text: "text-navy", sub: "text-navy/50" },
  { bg: "bg-teal-light", border: "border-navy", shadow: "shadow-[5px_5px_0_0_#000]", text: "text-navy", sub: "text-navy/50" },
  { bg: "bg-sunny-light", border: "border-navy", shadow: "shadow-[5px_5px_0_0_#000]", text: "text-navy", sub: "text-navy/50" },
  { bg: "bg-snow", border: "border-navy", shadow: "shadow-[5px_5px_0_0_#000]", text: "text-navy", sub: "text-slate" },
];

/* ─── Component ─────────────────────────────────────────────────── */

export default function TimetablePage() {
  const { user, getAccessToken } = useAuth();
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [cancellations, setCancellations] = useState<ClassCancellation[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassSession | null>(null);
  const [cancelDate, setCancelDate] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [screenSize, setScreenSize] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const calendarRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const userLevel = (user as { level?: number })?.level || 300;
  const canCancelClasses = (user as { permissions?: string[] })?.permissions?.includes("timetable:cancel") || false;

  /* ── Responsive ── */
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) { setScreenSize("mobile"); setView("day"); }
      else if (width < 1024) { setScreenSize("tablet"); if (view === "month" || view === "agenda") setView("week"); }
      else setScreenSize("desktop");
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [view]);

  /* ── Data fetching ── */
  const fetchTimetable = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const classesRes = await fetch(getApiUrl(`/api/v1/timetable/classes?level=${userLevel}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!classesRes.ok) throw new Error("Failed to fetch classes");
      setClasses(await classesRes.json());

      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const cancellationsRes = await fetch(getApiUrl(`/api/v1/timetable/week?level=${userLevel}&week_start=${format(weekStart, "yyyy-MM-dd")}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!cancellationsRes.ok) throw new Error("Failed to fetch cancellations");
      const weekData = await cancellationsRes.json();
      setCancellations(weekData.cancellations || []);
    } catch (error) {
      console.error("Error fetching timetable:", error);
    } finally {
      setLoading(false);
    }
  }, [user, userLevel, date]);

  useEffect(() => { fetchTimetable(); }, [fetchTimetable]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (!loading && calendarRef.current) {
      setTimeout(() => {
        const container = calendarRef.current;
        if (!container) return;
        const indicator = container.querySelector(".rbc-current-time-indicator");
        if (indicator) { indicator.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
        const slots = container.querySelectorAll(".rbc-time-slot");
        if (slots.length > 0) {
          const target = (new Date().getHours() - 7) * 2;
          if (target >= 0 && target < slots.length) (slots[target] as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
    }
  }, [loading, view, date]);

  /* ── Calendar events ── */
  const events: CalendarEvent[] = useMemo(() => {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const dayMap: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const calendarEvents: CalendarEvent[] = [];

    classes.forEach((cls) => {
      const dayNum = dayMap[cls.day];
      if (dayNum === undefined) return;
      const classDate = addDays(weekStart, dayNum);
      const [startH, startM] = cls.startTime.split(":").map(Number);
      const [endH, endM] = cls.endTime.split(":").map(Number);
      const startDT = new Date(classDate); startDT.setHours(startH, startM, 0, 0);
      const endDT = new Date(classDate); endDT.setHours(endH, endM, 0, 0);
      const cancellation = cancellations.find((c) => c.classSessionId === cls._id && isSameDay(parseISO(c.date), classDate));

      calendarEvents.push({
        id: `${cls._id}-${format(classDate, "yyyy-MM-dd")}`,
        title: `${cls.courseCode} - ${cls.courseTitle}`,
        start: startDT,
        end: endDT,
        resource: { classSession: cls, isCancelled: !!cancellation, cancellationReason: cancellation?.reason },
      });
    });
    return calendarEvents;
  }, [classes, cancellations, date]);

  const todaysClasses = useMemo(() => events.filter((e) => isSameDay(e.start, new Date())), [events]);
  const upcomingClasses = useMemo(() => {
    const now = new Date();
    return events.filter((e) => e.start > now && e.start <= addDays(now, 7)).sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, 5);
  }, [events]);

  const classStats = useMemo(() => ({
    total: events.length,
    lectures: events.filter((e) => e.resource.classSession.classType === "lecture").length,
    practicals: events.filter((e) => e.resource.classSession.classType === "practical").length,
    tutorials: events.filter((e) => e.resource.classSession.classType === "tutorial").length,
    cancelled: events.filter((e) => e.resource.isCancelled).length,
  }), [events]);

  /* ── Download ── */
  const downloadSchedule = () => {
    const rows = classes.map((cls) => ({ Course: `${cls.courseCode} - ${cls.courseTitle}`, Day: cls.day, Time: `${cls.startTime} - ${cls.endTime}`, Venue: cls.venue, Lecturer: cls.lecturer, Type: cls.classType }));
    const csv = [Object.keys(rows[0]).join(","), ...rows.map((r) => Object.values(r).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `timetable-level-${userLevel}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Cancel class ── */
  const handleCancelClass = async () => {
    if (!selectedClass || !cancelDate || !cancelReason) { toast.warning("Missing Fields", "Please fill in all fields"); return; }
    setCancelling(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/timetable/classes/${selectedClass._id}/cancel`), {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: cancelDate, reason: cancelReason }),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.detail || "Failed to cancel class"); }
      toast.success("Class Cancelled", "The class has been cancelled successfully");
      setShowCancelModal(false); setCancelDate(""); setCancelReason(""); setSelectedClass(null);
      fetchTimetable();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to cancel class";
      toast.error("Cancellation Failed", msg);
    } finally { setCancelling(false); }
  };

  /* ── Calendar styling ── */
  const eventStyleGetter = (event: CalendarEvent) => {
    const style = typeStyles[event.resource.classSession.classType] || typeStyles.lecture;
    return {
      style: {
        backgroundColor: style.calColor,
        borderRadius: "8px",
        opacity: event.resource.isCancelled ? 0.4 : 1,
        color: "white",
        border: "2px solid #0F0F2D",
        textDecoration: event.resource.isCancelled ? "line-through" : "none",
        fontSize: "12px",
      },
    };
  };

  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const { classSession, isCancelled } = event.resource;
    return (
      <div className="p-1">
        <div className="font-bold text-xs">{classSession.courseCode}</div>
        <div className="text-[10px] opacity-80">{classSession.venue}</div>
        {isCancelled && <div className="text-[10px] font-bold">CANCELLED</div>}
      </div>
    );
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader title="Timetable" />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-[3px] border-sunny border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate uppercase tracking-wider">Loading timetable…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Timetable" />

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">

        {/* ═══════════════════════════════════════════════════════
            HERO BENTO
            ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          {/* Title card */}
          <div className="lg:col-span-7 bg-sunny border-[5px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[200px] flex flex-col justify-between">
            <div className="absolute -bottom-12 -right-12 w-36 h-36 rounded-full bg-navy/8 pointer-events-none" />
            <svg className="absolute top-6 right-10 w-5 h-5 text-navy/12 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>

            <div>
              <p className="text-[10px] font-bold text-navy/40 uppercase tracking-[0.15em] mb-2">Level {userLevel}</p>
              <h1 className="font-display font-black text-3xl md:text-4xl text-navy leading-[0.95]">
                Class Schedule
              </h1>
              <p className="text-sm text-navy/50 mt-3 max-w-md">
                Lectures, practicals &amp; tutorials for the week.
              </p>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-3 mt-5">
              {[
                { label: `${classStats.lectures} Lectures`, dot: "bg-navy" },
                { label: `${classStats.practicals} Practicals`, dot: "bg-coral" },
                { label: `${classStats.tutorials} Tutorials`, dot: "bg-teal" },
                ...(classStats.cancelled > 0 ? [{ label: `${classStats.cancelled} Cancelled`, dot: "bg-slate" }] : []),
              ].map((s) => (
                <span key={s.label} className="flex items-center gap-1.5 text-[10px] font-bold text-navy/60 uppercase tracking-wider">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} /> {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Action cards */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-sunny-light flex items-center justify-center mb-3">
                <svg className="w-4.5 h-4.5 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Today</p>
              <p className="font-display font-black text-3xl text-navy">{todaysClasses.length}</p>
            </div>

            <div className="bg-teal-light border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-teal/20 flex items-center justify-center mb-3">
                <svg className="w-4.5 h-4.5 text-teal" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">This Week</p>
              <p className="font-display font-black text-3xl text-navy">{classStats.total}</p>
            </div>

            {/* Download button */}
            <button onClick={downloadSchedule} className="col-span-2 bg-navy border-[4px] border-navy rounded-2xl p-4 flex items-center gap-3 hover:bg-navy-light transition-colors group">
              <div className="w-9 h-9 rounded-xl bg-lime/15 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-display font-black text-sm text-snow group-hover:text-lime transition-colors">Download CSV</p>
                <p className="text-[10px] text-ghost/40">Export your schedule</p>
              </div>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            TODAY'S CLASSES
            ═══════════════════════════════════════════════════════ */}
        {todaysClasses.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-8 rounded-full bg-coral" />
              <h2 className="font-display font-black text-xl text-navy">Today&apos;s Classes</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {todaysClasses.map((event, i) => {
                const { classSession, isCancelled, cancellationReason } = event.resource;
                const style = typeStyles[classSession.classType] || typeStyles.lecture;
                const card = todayCardColors[i % todayCardColors.length];

                return (
                  <div key={event.id} className={`${card.bg} border-[4px] ${card.border} rounded-3xl p-5 ${card.shadow} ${isCancelled ? "opacity-50" : ""} transition-all`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`font-display font-black text-lg ${isCancelled ? "line-through text-slate" : card.text}`}>
                        {classSession.courseCode}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${style.bg} ${style.text}`}>
                          {classSession.classType}
                        </span>
                        {isCancelled && (
                          <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 bg-coral text-snow">Cancelled</span>
                        )}
                      </div>
                    </div>
                    <p className={`text-xs ${card.sub} mb-3`}>{classSession.courseTitle}</p>
                    <div className={`flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-wider ${card.sub}`}>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                        </svg>
                        {format(event.start, "h:mm a")} – {format(event.end, "h:mm a")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                        </svg>
                        {classSession.venue}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                        </svg>
                        {classSession.lecturer}
                      </span>
                    </div>
                    {isCancelled && cancellationReason && (
                      <p className="text-xs font-bold text-coral mt-2">Reason: {cancellationReason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            UPCOMING CLASSES
            ═══════════════════════════════════════════════════════ */}
        {upcomingClasses.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-8 rounded-full bg-lavender" />
              <h2 className="font-display font-black text-xl text-navy">Coming Up</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {upcomingClasses.map((event, i) => {
                const { classSession, isCancelled } = event.resource;
                const daysUntil = Math.ceil((event.start.getTime() - Date.now()) / 86400000);
                const rotation = i % 3 === 1 ? "rotate-[0.5deg] hover:rotate-0" : i % 3 === 2 ? "rotate-[-0.5deg] hover:rotate-0" : "";

                return (
                  <div key={event.id} className={`bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[4px_4px_0_0_#000] transition-all ${isCancelled ? "opacity-50" : ""} ${rotation}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display font-black text-base text-navy">{classSession.courseCode}</span>
                      <span className="text-[10px] font-bold text-slate uppercase tracking-wider bg-cloud rounded-full px-2 py-0.5">
                        {daysUntil}d
                      </span>
                    </div>
                    <div className="space-y-1 text-[10px] font-bold text-slate uppercase tracking-wider">
                      <p>{format(event.start, "EEE, MMM d")}</p>
                      <p>{format(event.start, "h:mm a")}</p>
                      <p className="truncate">{classSession.venue}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            CALENDAR
            ═══════════════════════════════════════════════════════ */}
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-4 md:p-6 shadow-[6px_6px_0_0_#000] overflow-hidden">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-3 h-8 rounded-full bg-sunny" />
            <h2 className="font-display font-black text-xl text-navy">Weekly View</h2>
          </div>

          <div className="timetable-calendar" ref={calendarRef}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: screenSize === "mobile" ? 450 : 500, minHeight: screenSize === "mobile" ? 400 : 450 }}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              eventPropGetter={eventStyleGetter}
              components={{ event: EventComponent }}
              views={screenSize === "mobile" ? ["day"] : screenSize === "tablet" ? ["day", "week"] : ["day", "week", "month", "agenda"]}
              defaultView={screenSize === "mobile" ? "day" : "week"}
              step={30}
              timeslots={2}
              min={new Date(0, 0, 0, 7, 0, 0)}
              max={new Date(0, 0, 0, 20, 0, 0)}
            />
          </div>

          {/* Legend */}
          <div className="mt-5 pt-5 border-t-[3px] border-navy/10 flex flex-wrap gap-5">
            {[
              { label: "Lecture", dot: "bg-navy" },
              { label: "Practical", dot: "bg-coral" },
              { label: "Tutorial", dot: "bg-teal" },
              { label: "Cancelled", dot: "bg-slate opacity-50" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full ${l.dot}`} />
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            CANCEL MODAL
            ═══════════════════════════════════════════════════════ */}
        {canCancelClasses && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="fixed bottom-24 md:bottom-8 right-6 bg-coral border-[4px] border-navy rounded-2xl px-5 py-3 shadow-[5px_5px_0_0_#000] hover:shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-2 z-30"
          >
            <svg className="w-5 h-5 text-snow" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
            </svg>
            <span className="font-bold text-xs text-snow uppercase tracking-wider">Cancel Class</span>
          </button>
        )}

        {showCancelModal && (
          <div className="fixed inset-0 bg-navy/80 z-50 flex items-center justify-center px-4 pt-4 pb-20 md:p-6" onClick={() => { setShowCancelModal(false); setSelectedClass(null); setCancelDate(""); setCancelReason(""); }}>
            <div className="bg-snow border-[4px] border-navy rounded-3xl w-full max-w-md max-h-[80vh] md:max-h-[85vh] overflow-y-auto shadow-[10px_10px_0_0_#000]" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="p-6 border-b-[3px] border-navy/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-coral-light flex items-center justify-center">
                    <svg className="w-5 h-5 text-coral" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Admin Action</p>
                    <h2 className="font-display font-black text-lg text-navy">Cancel a Class</h2>
                  </div>
                </div>
                <button onClick={() => { setShowCancelModal(false); setSelectedClass(null); setCancelDate(""); setCancelReason(""); }} className="w-10 h-10 rounded-xl hover:bg-cloud flex items-center justify-center transition-colors" disabled={cancelling} aria-label="Close">
                  <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Form */}
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="class-select" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Select Class</label>
                  <select id="class-select" value={selectedClass?._id || ""} onChange={(e) => setSelectedClass(classes.find((c) => c._id === e.target.value) || null)} className="w-full px-4 py-3 bg-ghost border-[3px] border-navy text-sm text-navy rounded-xl focus:outline-none focus:border-coral transition-all">
                    <option value="">Choose a class…</option>
                    {classes.map((cls) => (
                      <option key={cls._id} value={cls._id}>{cls.courseCode} - {cls.day} {cls.startTime} ({cls.venue})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cancel-date" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Date</label>
                  <input id="cancel-date" type="date" value={cancelDate} onChange={(e) => setCancelDate(e.target.value)} className="w-full px-4 py-3 bg-ghost border-[3px] border-navy text-sm text-navy rounded-xl focus:outline-none focus:border-coral transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cancel-reason" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Reason</label>
                  <textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} className="w-full px-4 py-3 bg-ghost border-[3px] border-navy text-sm text-navy rounded-xl focus:outline-none focus:border-coral transition-all resize-none" placeholder="e.g., Lecturer unavailable…" />
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-t-[3px] border-navy/10 flex gap-3">
                <button onClick={() => { setShowCancelModal(false); setSelectedClass(null); setCancelDate(""); setCancelReason(""); }} disabled={cancelling} className="flex-1 px-4 py-3 rounded-2xl border-[3px] border-navy text-navy font-bold text-xs uppercase tracking-wider hover:bg-cloud transition-colors">
                  Cancel
                </button>
                <button onClick={handleCancelClass} disabled={cancelling} className="flex-1 px-4 py-3 rounded-2xl bg-coral text-snow font-bold text-xs uppercase tracking-wider border-[3px] border-navy shadow-[3px_3px_0_0_#000] hover:shadow-[5px_5px_0_0_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {cancelling ? (
                    <>
                      <div className="w-4 h-4 border-[2px] border-snow border-t-transparent rounded-full animate-spin" />
                      Cancelling…
                    </>
                  ) : (
                    "Confirm Cancellation"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
