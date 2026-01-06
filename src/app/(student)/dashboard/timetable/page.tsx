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

// Setup the localizer for react-big-calendar
const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

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

export default function TimetablePage() {
  const { user } = useAuth();
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
  const [screenSize, setScreenSize] = useState<"mobile" | "tablet" | "desktop">(
    "desktop"
  );
  const calendarRef = useRef<HTMLDivElement>(null);

  // Determine user's level from profile
  const userLevel = (user as { level?: number })?.level || 300;
  const canCancelClasses =
    (user as { permissions?: string[] })?.permissions?.includes(
      "timetable:cancel"
    ) || false;

  // Detect screen size and set appropriate default view
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize("mobile");
        setView("day");
      } else if (width < 1024) {
        setScreenSize("tablet");
        if (view === "month" || view === "agenda") setView("week");
      } else {
        setScreenSize("desktop");
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [view]);

  const fetchTimetable = useCallback(async () => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();

      const classesRes = await fetch(
        getApiUrl(`/api/v1/timetable/classes?level=${userLevel}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!classesRes.ok) throw new Error("Failed to fetch classes");
      const classesData = await classesRes.json();
      setClasses(classesData);

      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekStartStr = format(weekStart, "yyyy-MM-dd");

      const cancellationsRes = await fetch(
        getApiUrl(
          `/api/v1/timetable/week?level=${userLevel}&week_start=${weekStartStr}`
        ),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!cancellationsRes.ok)
        throw new Error("Failed to fetch cancellations");
      const weekData = await cancellationsRes.json();
      setCancellations(weekData.cancellations || []);
    } catch (error) {
      console.error("Error fetching timetable:", error);
    } finally {
      setLoading(false);
    }
  }, [user, userLevel, date]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  // Auto-scroll to current time when calendar loads
  useEffect(() => {
    if (!loading && calendarRef.current) {
      const scrollToCurrentTime = () => {
        setTimeout(() => {
          const calendarContainer = calendarRef.current;
          if (!calendarContainer) return;

          const timeIndicator = calendarContainer.querySelector(
            ".rbc-current-time-indicator"
          );
          if (timeIndicator) {
            timeIndicator.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            return;
          }

          const now = new Date();
          const currentHour = now.getHours();

          const timeSlots =
            calendarContainer.querySelectorAll(".rbc-time-slot");
          if (timeSlots.length > 0) {
            const startHour = 7;
            const slotsPerHour = 2;
            const targetSlotIndex = (currentHour - startHour) * slotsPerHour;

            if (targetSlotIndex >= 0 && targetSlotIndex < timeSlots.length) {
              const targetSlot = timeSlots[targetSlotIndex] as HTMLElement;
              targetSlot.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }
          }
        }, 300);
      };

      scrollToCurrentTime();
    }
  }, [loading, view, date]);

  // Convert class sessions to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const calendarEvents: CalendarEvent[] = [];

    classes.forEach((classSession) => {
      const dayMap: { [key: string]: number } = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
      };

      const dayNum = dayMap[classSession.day];
      if (dayNum === undefined) return;

      const classDate = addDays(weekStart, dayNum);

      const [startHour, startMin] = classSession.startTime
        .split(":")
        .map(Number);
      const [endHour, endMin] = classSession.endTime.split(":").map(Number);

      const startDateTime = new Date(classDate);
      startDateTime.setHours(startHour, startMin, 0, 0);

      const endDateTime = new Date(classDate);
      endDateTime.setHours(endHour, endMin, 0, 0);

      const isCancelled = cancellations.some(
        (c) =>
          c.classSessionId === classSession._id &&
          isSameDay(parseISO(c.date), classDate)
      );

      const cancellation = cancellations.find(
        (c) =>
          c.classSessionId === classSession._id &&
          isSameDay(parseISO(c.date), classDate)
      );

      calendarEvents.push({
        id: `${classSession._id}-${format(classDate, "yyyy-MM-dd")}`,
        title: `${classSession.courseCode} - ${classSession.courseTitle}`,
        start: startDateTime,
        end: endDateTime,
        resource: {
          classSession,
          isCancelled,
          cancellationReason: cancellation?.reason,
        },
      });
    });

    return calendarEvents;
  }, [classes, cancellations, date]);

  // Today's classes
  const todaysClasses = useMemo(() => {
    const today = new Date();
    return events.filter((event) => isSameDay(event.start, today));
  }, [events]);

  // Upcoming classes (next 7 days)
  const upcomingClasses = useMemo(() => {
    const today = new Date();
    const nextWeek = addDays(today, 7);
    return events
      .filter((event) => event.start > today && event.start <= nextWeek)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5);
  }, [events]);

  // Class statistics
  const classStats = useMemo(() => {
    const total = events.length;
    const lectures = events.filter(
      (e) => e.resource.classSession.classType === "lecture"
    ).length;
    const practicals = events.filter(
      (e) => e.resource.classSession.classType === "practical"
    ).length;
    const tutorials = events.filter(
      (e) => e.resource.classSession.classType === "tutorial"
    ).length;
    const cancelled = events.filter((e) => e.resource.isCancelled).length;
    return { total, lectures, practicals, tutorials, cancelled };
  }, [events]);

  const downloadSchedule = () => {
    const scheduleData = classes.map((cls) => ({
      Course: `${cls.courseCode} - ${cls.courseTitle}`,
      Day: cls.day,
      Time: `${cls.startTime} - ${cls.endTime}`,
      Venue: cls.venue,
      Lecturer: cls.lecturer,
      Type: cls.classType,
    }));

    const csv = [
      Object.keys(scheduleData[0]).join(","),
      ...scheduleData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timetable-level-${userLevel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCancelClass = async () => {
    if (!selectedClass || !cancelDate || !cancelReason) {
      alert("Please fill in all fields");
      return;
    }

    setCancelling(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(
        getApiUrl(`/api/v1/timetable/classes/${selectedClass._id}/cancel`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            date: cancelDate,
            reason: cancelReason,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to cancel class");
      }

      alert("Class cancelled successfully");
      setShowCancelModal(false);
      setCancelDate("");
      setCancelReason("");
      setSelectedClass(null);
      fetchTimetable();
    } catch (error) {
      console.error("Error cancelling class:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to cancel class";
      alert(errorMessage);
    } finally {
      setCancelling(false);
    }
  };

  // Custom event styling
  const eventStyleGetter = (event: CalendarEvent) => {
    const { classType } = event.resource.classSession;
    const { isCancelled } = event.resource;

    let backgroundColor = "#18181b"; // charcoal for lectures
    if (classType === "practical") backgroundColor = "#dc2626";
    if (classType === "tutorial") backgroundColor = "#0d9488";
    if (isCancelled) backgroundColor = "#71717a";

    return {
      style: {
        backgroundColor,
        borderRadius: "4px",
        opacity: isCancelled ? 0.5 : 1,
        color: "white",
        border: "none",
        display: "block",
        textDecoration: isCancelled ? "line-through" : "none",
        fontFamily: "var(--font-body)",
        fontSize: "12px",
      },
    };
  };

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const { classSession, isCancelled } = event.resource;
    return (
      <div className="p-1">
        <div className="font-medium text-xs">{classSession.courseCode}</div>
        <div className="text-[10px] opacity-80">{classSession.venue}</div>
        {isCancelled && (
          <div className="text-[10px] font-bold">✕ CANCELLED</div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <DashboardHeader title="Timetable" />
        <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-48 bg-bg-secondary rounded" />
              <div className="h-96 bg-bg-secondary rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Timetable" />

      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-3">
              <span className="text-label-sm text-text-muted flex items-center gap-2">
                <span>✦</span> Level {userLevel}
              </span>
              <h1 className="font-display text-display-sm">Class Schedule</h1>
              <p className="text-text-secondary text-body text-sm max-w-md">
                Your weekly timetable with lectures, practicals, and tutorials.
              </p>

              {/* Stats */}
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-charcoal dark:bg-cream" />
                  <span className="text-label-sm text-text-secondary">
                    {classStats.lectures} Lectures
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-red-600" />
                  <span className="text-label-sm text-text-secondary">
                    {classStats.practicals} Practicals
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-teal-600" />
                  <span className="text-label-sm text-text-secondary">
                    {classStats.tutorials} Tutorials
                  </span>
                </div>
                {classStats.cancelled > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-zinc-500" />
                    <span className="text-label-sm text-text-muted">
                      {classStats.cancelled} Cancelled
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={downloadSchedule}
                className="flex items-center gap-2 px-4 py-2.5 bg-charcoal dark:bg-cream text-cream dark:text-charcoal text-label hover:opacity-90 transition-opacity"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Download CSV
              </button>
              {canCancelClasses && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-red-600 text-red-600 text-label hover:bg-red-600 hover:text-white transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                  Cancel Class
                </button>
              )}
            </div>
          </div>

          {/* Today's Classes */}
          {todaysClasses.length > 0 && (
            <section className="border-t border-border pt-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-label text-text-muted">◆</span>
                <h2 className="font-display text-xl">Today&apos;s Classes</h2>
              </div>
              <div className="grid gap-3">
                {todaysClasses.map((event) => {
                  const { classSession, isCancelled, cancellationReason } =
                    event.resource;
                  const typeColors = {
                    lecture:
                      "bg-charcoal dark:bg-cream text-cream dark:text-charcoal",
                    practical: "bg-red-600 text-white",
                    tutorial: "bg-teal-600 text-white",
                  };

                  return (
                    <div
                      key={event.id}
                      className={`page-frame p-4 md:p-5 ${
                        isCancelled ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap mb-2">
                            <h3
                              className={`font-display text-lg ${
                                isCancelled
                                  ? "line-through text-text-muted"
                                  : "text-text-primary"
                              }`}
                            >
                              {classSession.courseCode}
                            </h3>
                            <span
                              className={`px-2 py-0.5 text-label-sm ${
                                typeColors[classSession.classType]
                              }`}
                            >
                              {classSession.classType.toUpperCase()}
                            </span>
                            {isCancelled && (
                              <span className="px-2 py-0.5 bg-red-600 text-white text-label-sm">
                                CANCELLED
                              </span>
                            )}
                          </div>
                          <p className="text-text-secondary text-body text-sm mb-2">
                            {classSession.courseTitle}
                          </p>
                          <div className="flex flex-wrap items-center gap-4 text-text-muted text-label-sm">
                            <span className="flex items-center gap-1.5">
                              <svg
                                className="w-3.5 h-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              {format(event.start, "h:mm a")} -{" "}
                              {format(event.end, "h:mm a")}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <svg
                                className="w-3.5 h-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
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
                              {classSession.venue}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <svg
                                className="w-3.5 h-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                                />
                              </svg>
                              {classSession.lecturer}
                            </span>
                          </div>
                          {isCancelled && cancellationReason && (
                            <p className="text-red-600 text-label-sm mt-2">
                              ✕ Reason: {cancellationReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Upcoming Classes */}
          {upcomingClasses.length > 0 && (
            <section className="border-t border-border pt-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-label text-text-muted">◆</span>
                <h2 className="font-display text-xl">Upcoming Classes</h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcomingClasses.map((event) => {
                  const { classSession, isCancelled } = event.resource;
                  const daysUntil = Math.ceil(
                    (event.start.getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                  );

                  return (
                    <div
                      key={event.id}
                      className={`page-frame p-4 ${
                        isCancelled ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-display text-lg">
                          {classSession.courseCode}
                        </span>
                        <span className="text-label-sm text-text-muted">
                          in {daysUntil} {daysUntil === 1 ? "day" : "days"}
                        </span>
                      </div>
                      <div className="space-y-1 text-text-muted text-label-sm">
                        <p>{format(event.start, "EEE, MMM d")}</p>
                        <p>{format(event.start, "h:mm a")}</p>
                        <p>{classSession.venue}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Calendar */}
          <section className="border-t border-border pt-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-label text-text-muted">◆</span>
              <h2 className="font-display text-xl">Weekly View</h2>
            </div>
            <div className="page-frame p-4 md:p-6 overflow-hidden">
              <div className="timetable-calendar" ref={calendarRef}>
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  style={{
                    height: screenSize === "mobile" ? 450 : 500,
                    minHeight: screenSize === "mobile" ? 400 : 450,
                  }}
                  view={view}
                  onView={setView}
                  date={date}
                  onNavigate={setDate}
                  eventPropGetter={eventStyleGetter}
                  components={{
                    event: EventComponent,
                  }}
                  views={
                    screenSize === "mobile"
                      ? ["day"]
                      : screenSize === "tablet"
                      ? ["day", "week"]
                      : ["day", "week", "month", "agenda"]
                  }
                  defaultView={screenSize === "mobile" ? "day" : "week"}
                  step={30}
                  timeslots={2}
                  min={new Date(0, 0, 0, 7, 0, 0)}
                  max={new Date(0, 0, 0, 20, 0, 0)}
                />
              </div>

              {/* Legend */}
              <div className="mt-6 pt-6 border-t border-border flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-charcoal dark:bg-cream rounded-sm" />
                  <span className="text-label-sm text-text-secondary">
                    Lecture
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-600 rounded-sm" />
                  <span className="text-label-sm text-text-secondary">
                    Practical
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-teal-600 rounded-sm" />
                  <span className="text-label-sm text-text-secondary">
                    Tutorial
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-zinc-500 rounded-sm opacity-50" />
                  <span className="text-label-sm text-text-secondary">
                    Cancelled
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Cancel Class Modal */}
          {showCancelModal && (
            <div className="fixed inset-0 bg-charcoal/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-bg-primary border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <div>
                    <span className="text-label-sm text-text-muted flex items-center gap-2 mb-1">
                      <span>✦</span> Admin Action
                    </span>
                    <h2 className="font-display text-xl">Cancel a Class</h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      setSelectedClass(null);
                      setCancelDate("");
                      setCancelReason("");
                    }}
                    className="p-2 text-text-muted hover:text-text-primary transition-colors"
                    disabled={cancelling}
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label
                      htmlFor="class-select"
                      className="block text-label-sm text-text-secondary mb-2"
                    >
                      Select Class
                    </label>
                    <select
                      id="class-select"
                      value={selectedClass?._id || ""}
                      onChange={(e) => {
                        const classId = e.target.value;
                        const cls = classes.find((c) => c._id === classId);
                        setSelectedClass(cls || null);
                      }}
                      className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
                    >
                      <option value="">Choose a class...</option>
                      {classes.map((cls) => (
                        <option key={cls._id} value={cls._id}>
                          {cls.courseCode} - {cls.day} {cls.startTime} (
                          {cls.venue})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="cancel-date"
                      className="block text-label-sm text-text-secondary mb-2"
                    >
                      Cancellation Date
                    </label>
                    <input
                      id="cancel-date"
                      type="date"
                      value={cancelDate}
                      onChange={(e) => setCancelDate(e.target.value)}
                      className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cancel-reason"
                      className="block text-label-sm text-text-secondary mb-2"
                    >
                      Reason for Cancellation
                    </label>
                    <textarea
                      id="cancel-reason"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors resize-none"
                      placeholder="e.g., Lecturer unavailable, venue conflict..."
                    />
                  </div>
                </div>

                <div className="p-6 border-t border-border flex gap-3">
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      setSelectedClass(null);
                      setCancelDate("");
                      setCancelReason("");
                    }}
                    className="flex-1 px-4 py-3 border border-border text-text-secondary text-label hover:bg-bg-secondary transition-colors"
                    disabled={cancelling}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCancelClass}
                    disabled={cancelling}
                    className="flex-1 px-4 py-3 bg-red-600 text-white text-label hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {cancelling ? (
                      <>
                        <svg
                          className="w-4 h-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Cancelling...
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
    </div>
  );
}
