"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format } from "date-fns/format";
import { parse } from "date-fns/parse";
import { startOfWeek } from "date-fns/startOfWeek";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { getDay } from "date-fns/getDay";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { addDays, isSameDay, parseISO, startOfDay, endOfDay } from "date-fns";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { toast } from "sonner";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

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
    hasCollision?: boolean;
    cancellationReason?: string;
  };
}

interface ExamEntry {
  _id: string;
  courseCode: string;
  courseTitle: string;
  level: number;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  examType: string;
}

/* ─── Constants ─────────────────────────────────────────────────── */

const typeStyles: Record<string, { bg: string; text: string; calColor: string; dot: string }> = {
  lecture: { bg: "bg-navy", text: "text-snow", calColor: "#0F0F2D", dot: "bg-navy" },
  practical: { bg: "bg-coral", text: "text-snow", calColor: "#d45555", dot: "bg-coral" },
  tutorial: { bg: "bg-teal", text: "text-navy", calColor: "#5ec4b6", dot: "bg-teal" },
};

const examTypeStyles: Record<string, { bg: string; text: string }> = {
  written: { bg: "bg-navy", text: "text-snow" },
  practical: { bg: "bg-coral", text: "text-snow" },
  oral: { bg: "bg-lavender", text: "text-snow" },
  cbt: { bg: "bg-teal", text: "text-snow" },
};

const todayCardColors = [
  { bg: "bg-snow", border: "border-navy", shadow: "shadow-[3px_3px_0_0_#000]", text: "text-navy", sub: "text-slate" },
  { bg: "bg-lavender-light", border: "border-navy", shadow: "shadow-[3px_3px_0_0_#000]", text: "text-navy", sub: "text-navy/50" },
  { bg: "bg-coral-light", border: "border-navy", shadow: "shadow-[3px_3px_0_0_#000]", text: "text-navy", sub: "text-navy/50" },
  { bg: "bg-teal-light", border: "border-navy", shadow: "shadow-[3px_3px_0_0_#000]", text: "text-navy", sub: "text-navy/50" },
  { bg: "bg-sunny-light", border: "border-navy", shadow: "shadow-[3px_3px_0_0_#000]", text: "text-navy", sub: "text-navy/50" },
  { bg: "bg-snow", border: "border-navy", shadow: "shadow-[3px_3px_0_0_#000]", text: "text-navy", sub: "text-slate" },
];

const TIMETABLE_VIEW_PREF_KEY = "timetable_view_pref";
const DAY_TO_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const VIEW_OPTIONS: Array<{ key: View; label: string }> = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "agenda", label: "Agenda" },
];

const VIEW_LABELS: Record<View, string> = {
  day: "Daily View",
  week: "Weekly View",
  month: "Monthly View",
  agenda: "Agenda View",
  work_week: "Work Week",
};

function getDefaultViewByWidth(width: number): View {
  return width < 768 ? "day" : "week";
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function TimetablePage() {
  const { user, userProfile, getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("timetable");
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [cancellations, setCancellations] = useState<ClassCancellation[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "week";
    const saved = window.localStorage.getItem(TIMETABLE_VIEW_PREF_KEY) as View | null;
    if (!saved) return getDefaultViewByWidth(window.innerWidth);
    return VIEW_OPTIONS.some((option) => option.key === saved) ? saved : "week";
  });
  const [date, setDate] = useState(new Date());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassSession | null>(null);
  const [cancelDate, setCancelDate] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [screenSize, setScreenSize] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [exams, setExams] = useState<ExamEntry[]>([]);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Parse level from userProfile (stored as "200L", "300L", etc.)
  const userLevel = parseInt(String(userProfile?.level || userProfile?.currentLevel || "300")) || 300;
  const canCancelClasses = (user as { permissions?: string[] })?.permissions?.includes("timetable:cancel") || false;
  const currentViewLabel = VIEW_LABELS[view] || "Schedule View";

  /* ── Responsive ── */
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) { setScreenSize("mobile"); }
      else if (width < 1024) { setScreenSize("tablet"); }
      else setScreenSize("desktop");

      if (!window.localStorage.getItem(TIMETABLE_VIEW_PREF_KEY)) {
        setView(getDefaultViewByWidth(width));
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TIMETABLE_VIEW_PREF_KEY, view);
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

      // Fetch exams for this level
      try {
        const examsRes = await fetch(getApiUrl(`/api/v1/timetable/exams?level=${userLevel}`), { headers: { Authorization: `Bearer ${token}` } });
        if (examsRes.ok) setExams(await examsRes.json());
      } catch { /* exam fetch non-critical */ }
    } catch {
      toast.error("Failed to load timetable. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userLevel, date, getAccessToken]);

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
    let rangeStart: Date;
    let rangeEnd: Date;

    if (view === "day") {
      rangeStart = startOfDay(date);
      rangeEnd = endOfDay(date);
    } else if (view === "week") {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      rangeStart = startOfDay(weekStart);
      rangeEnd = endOfDay(addDays(weekStart, 6));
    } else if (view === "month") {
      rangeStart = startOfDay(startOfMonth(date));
      rangeEnd = endOfDay(endOfMonth(date));
    } else {
      rangeStart = startOfDay(date);
      rangeEnd = endOfDay(addDays(date, 30));
    }

    const calendarEvents: CalendarEvent[] = [];

    classes.forEach((cls) => {
      const dayNum = DAY_TO_INDEX[cls.day];
      if (dayNum === undefined) return;

      for (let cursor = startOfDay(rangeStart); cursor <= rangeEnd; cursor = addDays(cursor, 1)) {
        if (cursor.getDay() !== dayNum) continue;

        const [startH, startM] = cls.startTime.split(":").map(Number);
        const [endH, endM] = cls.endTime.split(":").map(Number);
        const startDT = new Date(cursor);
        startDT.setHours(startH, startM, 0, 0);
        const endDT = new Date(cursor);
        endDT.setHours(endH, endM, 0, 0);
        const cancellation = cancellations.find((c) => c.classSessionId === cls._id && isSameDay(parseISO(c.date), cursor));

        calendarEvents.push({
          id: `${cls._id}-${format(cursor, "yyyy-MM-dd")}`,
          title: view === "agenda"
            ? `${cls.courseCode} - ${cls.courseTitle}${cls.lecturer ? ` • ${cls.lecturer}` : ""}`
            : `${cls.courseCode} - ${cls.courseTitle}`,
          start: startDT,
          end: endDT,
          resource: { classSession: cls, isCancelled: !!cancellation, cancellationReason: cancellation?.reason, hasCollision: false },
        });
      }
    });

    const byDate = new Map<string, CalendarEvent[]>();
    calendarEvents.forEach((event) => {
      const key = format(event.start, "yyyy-MM-dd");
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(event);
    });

    byDate.forEach((dayEvents) => {
      dayEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
      for (let i = 0; i < dayEvents.length; i += 1) {
        for (let j = i + 1; j < dayEvents.length; j += 1) {
          if (dayEvents[j].start < dayEvents[i].end && dayEvents[i].start < dayEvents[j].end) {
            dayEvents[i].resource.hasCollision = true;
            dayEvents[j].resource.hasCollision = true;
          }
        }
      }
    });

    return calendarEvents;
  }, [classes, cancellations, date, view]);

  const todaysClasses = useMemo(() => events.filter((e) => isSameDay(e.start, new Date())), [events]);

  const nextClass = useMemo(() => {
    const now = new Date();
    const candidates: CalendarEvent[] = [];

    classes.forEach((cls) => {
      const dayNum = DAY_TO_INDEX[cls.day];
      if (dayNum === undefined) return;
      for (let i = 0; i <= 14; i += 1) {
        const candidate = addDays(startOfDay(now), i);
        if (candidate.getDay() !== dayNum) continue;

        const [startH, startM] = cls.startTime.split(":").map(Number);
        const [endH, endM] = cls.endTime.split(":").map(Number);
        const startDT = new Date(candidate);
        startDT.setHours(startH, startM, 0, 0);
        const endDT = new Date(candidate);
        endDT.setHours(endH, endM, 0, 0);
        if (startDT <= now) continue;

        const cancellation = cancellations.find((c) => c.classSessionId === cls._id && isSameDay(parseISO(c.date), candidate));
        candidates.push({
          id: `${cls._id}-${format(candidate, "yyyy-MM-dd")}-next`,
          title: `${cls.courseCode} - ${cls.courseTitle}`,
          start: startDT,
          end: endDT,
          resource: {
            classSession: cls,
            isCancelled: !!cancellation,
            cancellationReason: cancellation?.reason,
            hasCollision: false,
          },
        });
      }
    });

    return candidates.sort((a, b) => a.start.getTime() - b.start.getTime())[0] || null;
  }, [classes, cancellations]);

  const classStats = useMemo(() => ({
    total: events.length,
    lectures: events.filter((e) => e.resource.classSession.classType === "lecture").length,
    practicals: events.filter((e) => e.resource.classSession.classType === "practical").length,
    tutorials: events.filter((e) => e.resource.classSession.classType === "tutorial").length,
    cancelled: events.filter((e) => e.resource.isCancelled).length,
  }), [events]);

  /* ── Download ── */
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const downloadSchedule = () => {
    if (classes.length === 0) { toast.warning("No Classes", { description: "No timetable data to export." }); return; }

    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const sortedClasses = [...classes].sort((a, b) => {
      const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });

    const quote = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const headers = ["Course Code", "Course Title", "Day", "Start Time", "End Time", "Duration (mins)", "Venue", "Lecturer", "Type", "Level"];
    const rows = sortedClasses.map((cls) => {
      const [startH, startM] = cls.startTime.split(":").map(Number);
      const [endH, endM] = cls.endTime.split(":").map(Number);
      const duration = Math.max(0, (endH * 60 + endM) - (startH * 60 + startM));
      return [
        quote(cls.courseCode),
        quote(cls.courseTitle),
        quote(cls.day),
        quote(cls.startTime),
        quote(cls.endTime),
        quote(String(duration)),
        quote(cls.venue),
        quote(cls.lecturer || ""),
        quote(cls.classType),
        quote(String(cls.level)),
      ];
    });

    const metadata = [
      [quote("IESA Timetable Export"), quote("")],
      [quote("Level"), quote(String(userLevel))],
      [quote("Exported At"), quote(new Date().toLocaleString("en-NG"))],
      [quote("Total Classes"), quote(String(sortedClasses.length))],
      [],
    ];

    const csv = [
      ...metadata.map((row) => row.join(",")),
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `IESA_Timetable_Level${userLevel}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/timetable/pdf?level=${userLevel}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.detail || "Failed to generate PDF"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `IESA_Timetable_Level${userLevel}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("PDF Error", { description: err instanceof Error ? err.message : "Failed to download PDF" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  /* ── Cancel class ── */
  const handleCancelClass = async () => {
    if (!selectedClass || !cancelDate || !cancelReason) { toast.warning("Missing Fields", { description: "Please fill in all fields" }); return; }
    setCancelling(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/timetable/classes/${selectedClass._id}/cancel`), {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: cancelDate, reason: cancelReason }),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.detail || "Failed to cancel class"); }
      toast.success("Class Cancelled", { description: "The class has been cancelled successfully" });
      setShowCancelModal(false); setCancelDate(""); setCancelReason(""); setSelectedClass(null);
      fetchTimetable();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to cancel class";
      toast.error("Cancellation Failed", { description: msg });
    } finally { setCancelling(false); }
  };

  /* ── Calendar styling ── */
  const eventStyleGetter = (event: CalendarEvent) => {
    const style = typeStyles[event.resource.classSession.classType] || typeStyles.lecture;
    const hasCollision = event.resource.hasCollision;
    return {
      style: {
        backgroundColor: style.calColor,
        borderRadius: "8px",
        opacity: event.resource.isCancelled ? 0.4 : 1,
        color: "white",
        border: hasCollision ? "3px solid #E06050" : "2px solid #0F0F2D",
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
      <ToolHelpModal toolId="timetable" isOpen={showHelp} onClose={closeHelp} />

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
        <div className="flex justify-end mb-3"><HelpButton onClick={openHelp} /></div>

        {(screenSize !== "desktop" && nextClass) && (
          <div className="sticky top-18 z-20 mb-4 lg:hidden">
            <button
              onClick={() => {
                setDate(nextClass.start);
                setView("day");
                setDetailEvent(nextClass);
              }}
              className="w-full bg-lime-light border-[3px] border-navy rounded-b-2xl px-4 py-3 shadow-[4px_4px_0_0_#000] text-left press-3 press-navy"
            >
              <p className="text-[10px] font-bold text-navy uppercase tracking-[0.12em]">Next Class</p>
              <p className="font-display font-black text-base text-navy leading-tight mt-0.5">
                {nextClass.resource.classSession.courseCode} • {format(nextClass.start, "EEE, h:mm a")}
              </p>
              <p className="text-xs text-slate truncate mt-0.5">
                {nextClass.resource.classSession.venue} • {nextClass.resource.classSession.lecturer || "Lecturer TBA"}
              </p>
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            HERO BENTO
            ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          {/* Title card */}
          <div className="lg:col-span-12 bg-sunny border-[3px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[200px] flex flex-col justify-between">
            <div className="absolute -bottom-12 -right-12 w-36 h-36 rounded-full bg-navy/8 pointer-events-none" />
            <svg aria-hidden="true" className="absolute top-6 right-10 w-5 h-5 text-navy/12 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-snow/60 text-[10px] font-bold text-navy uppercase tracking-[0.08em]">
                <span className="w-1.5 h-1.5 rounded-full bg-navy" />
                {todaysClasses.length} Today
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-snow/60 text-[10px] font-bold text-navy uppercase tracking-[0.08em]">
                <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                {classStats.total} This Week
              </span>
              {[
                { label: `${classStats.lectures} Lectures`, dot: "bg-navy" },
                { label: `${classStats.practicals} Practicals`, dot: "bg-coral" },
                { label: `${classStats.tutorials} Tutorials`, dot: "bg-teal" },
                ...(classStats.cancelled > 0 ? [{ label: `${classStats.cancelled} Cancelled`, dot: "bg-slate" }] : []),
              ].map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-snow/60 text-[10px] font-bold text-navy uppercase tracking-[0.08em]">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} /> {s.label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <button onClick={downloadSchedule} disabled={classes.length === 0} className="bg-navy border-[3px] border-lime press-3 press-lime rounded-2xl p-4 flex items-center gap-3 group disabled:opacity-40">
              <div className="w-9 h-9 rounded-xl bg-teal/15 flex items-center justify-center shrink-0">
                <svg aria-hidden="true" className="w-5 h-5 text-snow" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-display font-black text-sm text-snow group-hover:text-snow transition-colors">CSV</p>
                <p className="text-[10px] text-ghost/40">Spreadsheet</p>
              </div>
              </button>
              <button onClick={downloadPdf} disabled={downloadingPdf || classes.length === 0} className="bg-lime border-[3px] border-navy press-3 press-navy rounded-2xl p-4 flex items-center gap-3 group disabled:opacity-40">
              <div className="w-9 h-9 rounded-xl bg-navy/10 flex items-center justify-center shrink-0">
                <svg aria-hidden="true" className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
                  <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-display font-black text-sm text-navy">{downloadingPdf ? "..." : "PDF"}</p>
                <p className="text-[10px] text-navy/40">Printable</p>
              </div>
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            UPCOMING EXAMS
            ═══════════════════════════════════════════════════════ */}
        {exams.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-display font-black text-xl text-navy">Upcoming Exams</h2>
              <span className="px-2.5 py-0.5 rounded-md bg-coral-light text-coral text-xs font-bold">{exams.length}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {exams
                .filter(ex => new Date(ex.date + "T23:59:59") >= new Date())
                .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                .map((ex, i) => {
                  const colors = examTypeStyles[ex.examType] ?? examTypeStyles.written;
                  const examDate = new Date(ex.date + "T00:00");
                  const daysUntil = Math.ceil((examDate.getTime() - Date.now()) / 86400000);
                  const rotation = i % 3 === 1 ? "rotate-[0.5deg] hover:rotate-0" : i % 3 === 2 ? "rotate-[-0.5deg] hover:rotate-0" : "";
                  const isToday = daysUntil <= 0;
                  return (
                    <div key={ex._id} className={`bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[3px_3px_0_0_#000] transition-all ${rotation} ${isToday ? "ring-2 ring-coral ring-offset-2" : ""}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-display font-black text-lg text-navy">{ex.courseCode}</p>
                          <p className="text-xs text-slate line-clamp-1">{ex.courseTitle}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 ${colors.bg} ${colors.text}`}>{ex.examType}</span>
                          {isToday && <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-1 bg-coral text-snow">Today</span>}
                        </div>
                      </div>
                      <div className="space-y-1.5 text-[10px] font-bold text-slate uppercase tracking-wider">
                        <p className="flex items-center gap-1.5">
                          <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" /></svg>
                          {examDate.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}
                          {daysUntil > 0 && <span className="ml-1 text-coral normal-case">({daysUntil}d away)</span>}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" /></svg>
                          {ex.startTime} – {ex.endTime}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 3.834 3.025ZM12 12.75a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" /></svg>
                          {ex.venue}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
            {exams.filter(ex => new Date(ex.date + "T23:59:59") < new Date()).length > 0 && (
              <p className="text-xs text-slate font-bold mt-3">{exams.filter(ex => new Date(ex.date + "T23:59:59") < new Date()).length} past exam(s) not shown</p>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TODAY&apos;S CLASSES
            ═══════════════════════════════════════════════════════ */}
        {todaysClasses.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-display font-black text-xl text-navy">Today&apos;s Classes</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {todaysClasses.map((event, i) => {
                const { classSession, isCancelled, cancellationReason } = event.resource;
                const style = typeStyles[classSession.classType] || typeStyles.lecture;
                const card = todayCardColors[i % todayCardColors.length];

                return (
                  <button key={event.id} onClick={() => setDetailEvent(event)} className={`text-left w-full ${card.bg} border-[3px] ${card.border} rounded-3xl p-5 ${card.shadow} ${isCancelled ? "opacity-50" : ""} transition-all hover:translate-y-[-1px] cursor-pointer`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`font-display font-black text-lg ${isCancelled ? "line-through text-slate" : card.text}`}>
                        {classSession.courseCode}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 ${style.bg} ${style.text}`}>
                          {classSession.classType}
                        </span>
                        {isCancelled && (
                          <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-coral text-snow">Cancelled</span>
                        )}
                      </div>
                    </div>
                    <p className={`text-xs ${card.sub} mb-3`}>{classSession.courseTitle}</p>
                    <div className={`flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-wider ${card.sub}`}>
                      <span className="flex items-center gap-1.5">
                        <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                        </svg>
                        {format(event.start, "h:mm a")} – {format(event.end, "h:mm a")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                        </svg>
                        {classSession.venue}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                        </svg>
                        {classSession.lecturer}
                      </span>
                    </div>
                    {isCancelled && cancellationReason && (
                      <p className="text-xs font-bold text-coral mt-2">Reason: {cancellationReason}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            CALENDAR
            ═══════════════════════════════════════════════════════ */}
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 mb-5">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-black text-xl text-navy">{currentViewLabel}</h2>
              <span className="text-[10px] font-bold text-slate uppercase tracking-wider">{format(date, "MMM d, yyyy")}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const today = new Date();
                  setDate(today);
                  setView("day");
                }}
                className="px-3 py-1.5 rounded-xl bg-snow border-[2px] border-navy text-[10px] font-bold uppercase tracking-wider text-navy press-2 press-black"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const tomorrow = addDays(new Date(), 1);
                  setDate(tomorrow);
                  setView("day");
                }}
                className="px-3 py-1.5 rounded-xl bg-snow border-[2px] border-navy text-[10px] font-bold uppercase tracking-wider text-navy press-2 press-black"
              >
                Tomorrow
              </button>
              <button
                onClick={() => {
                  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
                  setDate(weekStart);
                  setView("week");
                }}
                className="px-3 py-1.5 rounded-xl bg-snow border-[2px] border-navy text-[10px] font-bold uppercase tracking-wider text-navy press-2 press-black"
              >
                This Week
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setView(option.key)}
                  className={`px-3 py-1.5 rounded-xl border-[2px] text-[10px] font-bold uppercase tracking-wider transition-all ${
                    view === option.key
                      ? "bg-navy text-snow border-lime press-2 press-lime"
                      : "bg-snow text-navy border-navy press-2 press-black"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className={view === "day" ? "min-w-full" : "min-w-[760px]"}>
              <div className="timetable-calendar" ref={calendarRef}>
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: screenSize === "mobile" ? 450 : 520, minHeight: screenSize === "mobile" ? 400 : 470 }}
                  view={view}
                  onView={setView}
                  date={date}
                  onNavigate={setDate}
                  onSelectEvent={(event: CalendarEvent) => setDetailEvent(event)}
                  eventPropGetter={eventStyleGetter}
                  components={{ event: EventComponent }}
                  views={["day", "week", "month", "agenda"]}
                  defaultView="week"
                  toolbar={false}
                  step={30}
                  timeslots={2}
                  min={new Date(0, 0, 0, 7, 0, 0)}
                  max={new Date(0, 0, 0, 20, 0, 0)}
                />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-5 pt-5 border-t-[3px] border-navy/10 flex flex-wrap gap-5">
            {[
              { label: "Lecture", dot: "bg-navy" },
              { label: "Practical", dot: "bg-coral" },
              { label: "Tutorial", dot: "bg-teal" },
              { label: "Collision", dot: "bg-coral border border-navy" },
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
            CLASS DETAIL MODAL
            ═══════════════════════════════════════════════════════ */}
        <Modal isOpen={!!detailEvent} onClose={() => setDetailEvent(null)} title="" size="md">
          {detailEvent && (() => {
            const { classSession, isCancelled, cancellationReason } = detailEvent.resource;
            const style = typeStyles[classSession.classType] || typeStyles.lecture;
            return (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display font-black text-2xl text-navy leading-tight">
                      {classSession.courseCode}
                    </h2>
                    <p className="text-sm text-slate mt-1">{classSession.courseTitle}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider rounded-md px-3 py-1.5 ${style.bg} ${style.text}`}>
                      {classSession.classType}
                    </span>
                    {isCancelled && (
                      <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-3 py-1.5 bg-coral text-snow">
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Time",
                      value: `${format(detailEvent.start, "h:mm a")} – ${format(detailEvent.end, "h:mm a")}`,
                      icon: (
                        <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                        </svg>
                      ),
                    },
                    {
                      label: "Day",
                      value: `${classSession.day} · ${format(detailEvent.start, "MMM d, yyyy")}`,
                      icon: (
                        <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                        </svg>
                      ),
                    },
                    {
                      label: "Venue",
                      value: classSession.venue,
                      icon: (
                        <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                        </svg>
                      ),
                    },
                    {
                      label: "Lecturer",
                      value: classSession.lecturer,
                      icon: (
                        <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                        </svg>
                      ),
                    },
                  ].map((item) => (
                    <div key={item.label} className="bg-ghost rounded-2xl p-4 border-[2px] border-cloud">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-slate">{item.icon}</span>
                        <span className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">{item.label}</span>
                      </div>
                      <p className="text-sm font-bold text-navy">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Extra details */}
                <div className="flex flex-wrap gap-2">
                  <span className="bg-cloud rounded-md px-3 py-1.5 text-[10px] font-bold text-navy uppercase tracking-wider">
                    Level {classSession.level}
                  </span>
                  {classSession.recurring && (
                    <span className="bg-teal-light rounded-md px-3 py-1.5 text-[10px] font-bold text-teal uppercase tracking-wider">
                      Recurring Weekly
                    </span>
                  )}
                </div>

                {/* Cancellation notice */}
                {isCancelled && (
                  <div className="bg-coral-light border-[2px] border-coral/30 rounded-2xl p-4">
                    <p className="text-xs font-bold text-coral uppercase tracking-wider mb-1">
                      Class Cancelled
                    </p>
                    {cancellationReason && (
                      <p className="text-sm text-navy">{cancellationReason}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>

        {/* ═══════════════════════════════════════════════════════
            CANCEL MODAL
            ═══════════════════════════════════════════════════════ */}
        {canCancelClasses && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="fixed bottom-24 md:bottom-8 right-6 bg-coral border-[3px] border-navy rounded-2xl px-5 py-3 press-3 press-black transition-all flex items-center gap-2 z-30"
          >
            <svg aria-hidden="true" className="w-5 h-5 text-snow" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
            </svg>
            <span className="font-bold text-xs text-snow uppercase tracking-wider">Cancel Class</span>
          </button>
        )}

        {showCancelModal && (
          <div className="fixed inset-0 bg-navy/80 z-[70] flex items-center justify-center px-4 py-4 sm:p-6" onClick={() => { setShowCancelModal(false); setSelectedClass(null); setCancelDate(""); setCancelReason(""); }}>
            <div className="bg-snow border-[3px] border-navy rounded-3xl w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-[4px_4px_0_0_#000]" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="p-6 border-b-[3px] border-navy/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-coral-light flex items-center justify-center">
                    <svg aria-hidden="true" className="w-5 h-5 text-coral" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Admin Action</p>
                    <h2 className="font-display font-black text-lg text-navy">Cancel a Class</h2>
                  </div>
                </div>
                <button onClick={() => { setShowCancelModal(false); setSelectedClass(null); setCancelDate(""); setCancelReason(""); }} className="w-10 h-10 rounded-xl hover:bg-cloud flex items-center justify-center transition-colors" disabled={cancelling} aria-label="Close">
                  <svg aria-hidden="true" className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Form */}
              <div className="p-6 space-y-4 flex-1 overflow-y-auto">
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
                <button onClick={handleCancelClass} disabled={cancelling} className="flex-1 px-4 py-3 rounded-2xl bg-coral text-snow font-bold text-xs uppercase tracking-wider border-[3px] border-navy press-3 press-black transition-all disabled:opacity-50 flex items-center justify-center gap-2">
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
