"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format } from "date-fns/format";
import { parse } from "date-fns/parse";
import { startOfWeek } from "date-fns/startOfWeek";
import { getDay } from "date-fns/getDay";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { addDays, isSameDay, parseISO } from "date-fns";

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

  // Determine user's level from profile (using any type to avoid Firebase User type conflicts)
  const userLevel = (user as any)?.level || 300;
  const canCancelClasses = (user as any)?.permissions?.includes("timetable:cancel") || false;

  const fetchTimetable = useCallback(async () => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();

      // Fetch classes for user's level
      const classesRes = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/timetable/classes?level=${userLevel}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!classesRes.ok) throw new Error("Failed to fetch classes");
      const classesData = await classesRes.json();
      setClasses(classesData);

      // Fetch cancellations for current week
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekStartStr = format(weekStart, "yyyy-MM-dd");

      const cancellationsRes = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/timetable/week?level=${userLevel}&week_start=${weekStartStr}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!cancellationsRes.ok) throw new Error("Failed to fetch cancellations");
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

  // Convert class sessions to calendar events for the current week
  const events: CalendarEvent[] = useMemo(() => {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const calendarEvents: CalendarEvent[] = [];

    classes.forEach((classSession) => {
      // Map day names to day numbers (0 = Sunday, 1 = Monday, ...)
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

      // Calculate the date for this class in the current week
      const classDate = addDays(weekStart, dayNum);

      // Parse start and end times
      const [startHour, startMin] = classSession.startTime.split(":").map(Number);
      const [endHour, endMin] = classSession.endTime.split(":").map(Number);

      const startDateTime = new Date(classDate);
      startDateTime.setHours(startHour, startMin, 0, 0);

      const endDateTime = new Date(classDate);
      endDateTime.setHours(endHour, endMin, 0, 0);

      // Check if this specific date is cancelled
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

  const handleCancelClass = async () => {
    if (!selectedClass || !cancelDate || !cancelReason) {
      alert("Please fill in all fields");
      return;
    }

    setCancelling(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/timetable/classes/${selectedClass._id}/cancel`,
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
      fetchTimetable(); // Refresh data
    } catch (error) {
      console.error("Error cancelling class:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel class";
      alert(errorMessage);
    } finally {
      setCancelling(false);
    }
  };

  // Custom event styling
  const eventStyleGetter = (event: CalendarEvent) => {
    const { classType } = event.resource.classSession;
    const { isCancelled } = event.resource;

    let backgroundColor = "#4CA868"; // Primary green
    if (classType === "practical") backgroundColor = "#FF6B6B";
    if (classType === "tutorial") backgroundColor = "#4ECDC4";
    if (isCancelled) backgroundColor = "#999";

    return {
      style: {
        backgroundColor,
        borderRadius: "8px",
        opacity: isCancelled ? 0.5 : 1,
        color: "white",
        border: "none",
        display: "block",
        textDecoration: isCancelled ? "line-through" : "none",
      },
    };
  };

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const { classSession, isCancelled } = event.resource;
    return (
      <div className="p-1">
        <div className="font-semibold text-sm">{classSession.courseCode}</div>
        <div className="text-xs opacity-90">{classSession.venue}</div>
        {isCancelled && (
          <div className="text-xs font-bold">❌ CANCELLED</div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-(--glass-bg) rounded w-1/4"></div>
          <div className="h-96 bg-(--glass-bg) rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">
            Class Timetable
          </h1>
          <p className="text-foreground opacity-70">
            Your weekly schedule for Level {userLevel}
          </p>
        </div>

        {canCancelClasses && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Cancel a Class
          </button>
        )}
      </div>

      {/* Today's Classes */}
      {todaysClasses.length > 0 && (
        <div className="rounded-xl bg-(--glass-bg) backdrop-blur-(--glass-blur) border border-(--glass-border) p-6">
          <h2 className="text-xl font-heading font-bold mb-4 text-foreground">
            Today&apos;s Classes
          </h2>
          <div className="space-y-3">
            {todaysClasses.map((event) => {
              const { classSession, isCancelled, cancellationReason } = event.resource;
              return (
                <div
                  key={event.id}
                  className={`p-4 rounded-lg border ${
                    isCancelled
                      ? "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-60"
                      : "bg-white dark:bg-background border-(--glass-border)"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-semibold ${
                            isCancelled ? "line-through" : ""
                          }`}
                        >
                          {classSession.courseCode} - {classSession.courseTitle}
                        </h3>
                        {isCancelled && (
                          <span className="px-2 py-1 text-xs bg-red-500 text-white rounded">
                            CANCELLED
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-foreground opacity-70 mt-1">
                        {format(event.start, "h:mm a")} -{" "}
                        {format(event.end, "h:mm a")} • {classSession.venue} •{" "}
                        {classSession.lecturer}
                      </div>
                      {isCancelled && cancellationReason && (
                        <div className="text-sm text-red-600 dark:text-red-400 mt-2">
                          Reason: {cancellationReason}
                        </div>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        classSession.classType === "lecture"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : classSession.classType === "practical"
                          ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      }`}
                    >
                      {classSession.classType}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="rounded-xl bg-(--glass-bg) backdrop-blur-(--glass-blur) border border-(--glass-border) p-6 overflow-hidden">
        <div className="timetable-calendar">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            eventPropGetter={eventStyleGetter}
            components={{
              event: EventComponent,
            }}
            views={["week", "day"]}
            defaultView="week"
            step={30}
            timeslots={2}
            min={new Date(0, 0, 0, 7, 0, 0)} // Start at 7 AM
            max={new Date(0, 0, 0, 20, 0, 0)} // End at 8 PM
          />
        </div>

        {/* Legend */}
        <div className="mt-6 pt-6 border-t border-(--glass-border) flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#4CA868]"></div>
            <span className="text-sm">Lecture</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#FF6B6B]"></div>
            <span className="text-sm">Practical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#4ECDC4]"></div>
            <span className="text-sm">Tutorial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#999] opacity-50"></div>
            <span className="text-sm">Cancelled</span>
          </div>
        </div>
      </div>

      {/* Cancel Class Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl border border-(--glass-border) p-6 max-w-md w-full">
            <h2 className="text-2xl font-heading font-bold mb-4">
              Cancel a Class
            </h2>

            <div className="space-y-4">
              {/* Class Selection */}
              <div>
                <label htmlFor="class-select" className="block text-sm font-medium mb-2">
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
                  className="w-full px-4 py-2 rounded-lg border border-(--glass-border) bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Choose a class...</option>
                  {classes.map((cls) => (
                    <option key={cls._id} value={cls._id}>
                      {cls.courseCode} - {cls.day} {cls.startTime} ({cls.venue})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label htmlFor="cancel-date" className="block text-sm font-medium mb-2">
                  Cancellation Date
                </label>
                <input
                  id="cancel-date"
                  type="date"
                  value={cancelDate}
                  onChange={(e) => setCancelDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-(--glass-border) bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Reason */}
              <div>
                <label htmlFor="cancel-reason" className="block text-sm font-medium mb-2">
                  Reason for Cancellation
                </label>
                <textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-(--glass-border) bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Lecturer unavailable, venue conflict..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedClass(null);
                  setCancelDate("");
                  setCancelReason("");
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-(--glass-border) hover:bg-(--glass-bg) transition-colors"
                disabled={cancelling}
              >
                Cancel
              </button>
              <button
                onClick={handleCancelClass}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
