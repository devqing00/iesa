"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import AcademicCalendarTab from "@/components/admin/AcademicCalendarTab";

/* ─── Types ──────────────────────────────── */

interface ClassSession {
  _id: string;
  sessionId: string;
  courseCode: string;
  courseTitle: string;
  level: number;
  day: string;
  startTime: string;
  endTime: string;
  venue: string;
  lecturer: string | null;
  type: "lecture" | "practical" | "tutorial";
  recurring: boolean;
  createdAt: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const LEVELS = [100, 200, 300, 400, 500];
const CLASS_TYPES = ["lecture", "practical", "tutorial"] as const;

const typeColors: Record<string, { bg: string; text: string }> = {
  lecture: { bg: "bg-navy", text: "text-snow" },
  practical: { bg: "bg-coral", text: "text-snow" },
  tutorial: { bg: "bg-teal", text: "text-snow" },
};

/* ─── Component ──────────────────────────── */

function AdminTimetablePage() {
  const { user, getAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"classes" | "calendar">("classes");
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<number | "">("");
  const [filterDay, setFilterDay] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSession | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    courseCode: "",
    courseTitle: "",
    level: 100,
    day: "Monday",
    startTime: "08:00",
    endTime: "10:00",
    venue: "",
    lecturer: "",
    type: "lecture" as "lecture" | "practical" | "tutorial",
    recurring: true,
  });

  /* ── Fetch ── */

  const fetchClasses = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      if (filterLevel) params.set("level", String(filterLevel));
      if (filterDay) params.set("day", filterDay);
      const url = getApiUrl(`/api/v1/timetable/classes${params.toString() ? `?${params}` : ""}`);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setClasses(await res.json());
      } else {
        toast.error("Failed to load timetable");
      }
    } catch {
      toast.error("Failed to load timetable");
    } finally {
      setLoading(false);
    }
  }, [user, getAccessToken, filterLevel, filterDay]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  /* ── Create / Edit ── */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const token = await getAccessToken();
      const isEdit = !!editingClass;
      const url = isEdit
        ? getApiUrl(`/api/v1/timetable/classes/${editingClass._id}`)
        : getApiUrl("/api/v1/timetable/classes");
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          lecturer: formData.lecturer || null,
        }),
      });

      if (res.ok) {
        toast.success(isEdit ? "Class updated" : "Class created");
        closeModal();
        await fetchClasses();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.detail ?? "Failed to save class");
      }
    } catch {
      toast.error("Failed to save class");
    }
  };

  /* ── Delete ── */

  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeleting(id);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/timetable/classes/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Class deleted");
        await fetchClasses();
      } else {
        toast.error("Failed to delete class");
      }
    } catch {
      toast.error("Failed to delete class");
    } finally {
      setDeleting(null);
    }
  };

  /* ── Modal helpers ── */

  const openCreateModal = () => {
    setEditingClass(null);
    setFormData({
      courseCode: "",
      courseTitle: "",
      level: 100,
      day: "Monday",
      startTime: "08:00",
      endTime: "10:00",
      venue: "",
      lecturer: "",
      type: "lecture",
      recurring: true,
    });
    setShowModal(true);
  };

  const openEditModal = (cls: ClassSession) => {
    setEditingClass(cls);
    setFormData({
      courseCode: cls.courseCode,
      courseTitle: cls.courseTitle,
      level: cls.level,
      day: cls.day,
      startTime: cls.startTime,
      endTime: cls.endTime,
      venue: cls.venue,
      lecturer: cls.lecturer ?? "",
      type: cls.type,
      recurring: cls.recurring,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClass(null);
  };

  /* ── Group classes by day ── */

  const grouped = DAYS.reduce<Record<string, ClassSession[]>>((acc, day) => {
    acc[day] = classes
      .filter((c) => c.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {});

  const totalClasses = classes.length;
  const uniqueCourses = new Set(classes.map((c) => c.courseCode)).size;

  /* ── Render ── */

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Administration</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Timetable</span> Manager
          </h1>
          <p className="text-sm text-navy/60 mt-1">Manage class schedules and academic calendar</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <PermissionGate permission="timetable:create">
            {activeTab === "classes" && (
              <button
                onClick={openCreateModal}
                className="bg-lime border-[3px] border-navy press-3 press-navy px-6 py-2.5 rounded-2xl font-display font-bold text-sm text-navy transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                </svg>
                Add Class
              </button>
            )}
          </PermissionGate>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("classes")}
          className={`px-5 py-2.5 rounded-2xl font-display font-bold text-sm transition-all border-[3px] ${
            activeTab === "classes"
              ? "bg-navy border-navy text-snow"
              : "bg-ghost border-navy text-navy hover:bg-cloud"
          }`}
        >
          Class Schedule
        </button>
        <button
          onClick={() => setActiveTab("calendar")}
          className={`px-5 py-2.5 rounded-2xl font-display font-bold text-sm transition-all border-[3px] ${
            activeTab === "calendar"
              ? "bg-navy border-navy text-snow"
              : "bg-ghost border-navy text-navy hover:bg-cloud"
          }`}
        >
          Academic Calendar
        </button>
      </div>

      {/* Stats + Filters */}
      {activeTab === "classes" ? (
        <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Total Classes</p>
          <p className="font-display font-black text-2xl text-navy">{totalClasses}</p>
        </div>
        <div className="bg-teal border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">Courses</p>
          <p className="font-display font-black text-2xl text-snow">{uniqueCourses}</p>
        </div>

        {/* Filter: Level */}
        <div className="bg-ghost border-[3px] border-navy rounded-2xl p-4 flex flex-col justify-center">
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Filter Level</label>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value ? Number(e.target.value) : "")}
            title="Filter by student level"
            className="bg-transparent text-navy font-bold text-sm appearance-none cursor-pointer outline-none"
          >
            <option value="">All Levels</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l} Level</option>
            ))}
          </select>
        </div>

        {/* Filter: Day */}
        <div className="bg-ghost border-[3px] border-navy rounded-2xl p-4 flex flex-col justify-center">
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Filter Day</label>
          <select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            title="Filter by day of the week"
            className="bg-transparent text-navy font-bold text-sm appearance-none cursor-pointer outline-none"
          >
            <option value="">All Days</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timetable Grid */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-snow border-[3px] border-navy rounded-3xl p-6 animate-pulse space-y-4">
              <div className="h-6 w-28 rounded-xl bg-cloud" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="h-24 rounded-2xl bg-cloud" />
                <div className="h-24 rounded-2xl bg-cloud" />
                <div className="h-24 rounded-2xl bg-cloud" />
              </div>
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-16 text-center shadow-[4px_4px_0_0_#000] space-y-4">
          <div className="w-16 h-16 bg-sunny-light rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-sunny" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-display font-black text-lg text-navy">No classes yet</h3>
          <p className="text-sm text-navy/60 max-w-sm mx-auto">
            Add class sessions to build the academic timetable for students.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {DAYS.map((day) => {
            const dayClasses = grouped[day];
            if (dayClasses.length === 0 && (filterDay && filterDay !== day)) return null;
            if (dayClasses.length === 0) return null;

            return (
              <div key={day}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="font-display font-black text-lg text-navy">{day}</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-cloud text-slate text-xs font-bold">
                    {dayClasses.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dayClasses.map((cls) => {
                    const colors = typeColors[cls.type] || typeColors.lecture;
                    return (
                      <div
                        key={cls._id}
                        className="bg-snow border-[3px] border-navy rounded-3xl p-5 press-3 press-black transition-all group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-display font-black text-lg text-navy">{cls.courseCode}</p>
                            <p className="text-sm text-navy/60 line-clamp-1">{cls.courseTitle}</p>
                          </div>
                          <span className={`shrink-0 ml-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${colors.bg} ${colors.text}`}>
                            {cls.type}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-sm text-navy/70 mb-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0 text-slate" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">{cls.startTime} – {cls.endTime}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0 text-slate" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 3.834 3.025ZM12 12.75a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                            </svg>
                            <span>{cls.venue}</span>
                          </div>
                          {cls.lecturer && (
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 shrink-0 text-slate" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                              </svg>
                              <span>{cls.lecturer}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0 text-slate" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.949 49.949 0 0 0-9.902 3.912l-.003.002-.34.18a.75.75 0 0 1-.707 0A50.009 50.009 0 0 0 7.5 12.174v-.224c0-.131.067-.248.172-.311a54.614 54.614 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.129 56.129 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
                              <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.285a.75.75 0 0 1-.46.71 47.878 47.878 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.877 47.877 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 0 1 6 13.18v1.27a1.5 1.5 0 0 0-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.661a6.729 6.729 0 0 0 .551-1.608 1.5 1.5 0 0 0 .14-2.67v-.645a48.549 48.549 0 0 1 3.44 1.668 2.25 2.25 0 0 0 2.12 0Z" />
                              <path d="M4.462 19.462c.42-.419.753-.89 1-1.394.453.213.902.434 1.347.661a6.743 6.743 0 0 1-1.286 1.794.75.75 0 0 1-1.06-1.06Z" />
                            </svg>
                            <span>{cls.level} Level</span>
                          </div>
                        </div>

                        <PermissionGate permission="timetable:edit">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditModal(cls)}
                              className="flex-1 px-4 py-2 rounded-xl bg-ghost border-[3px] border-navy text-navy text-xs font-bold hover:bg-navy hover:text-snow transition-all"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(cls._id)}
                              disabled={deleting === cls._id}
                              className="px-4 py-2 rounded-xl bg-coral-light border-[3px] border-coral text-coral text-xs font-bold hover:bg-coral hover:text-snow transition-all disabled:opacity-50"
                            >
                              {deleting === cls._id ? "..." : "Delete"}
                            </button>
                          </div>
                        </PermissionGate>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && activeTab === "classes" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-4 pb-20 md:p-6">
          <div className="absolute inset-0 bg-navy/50" onClick={closeModal} />
          <div className="relative bg-snow border-[3px] border-navy rounded-3xl p-8 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">
                  {editingClass ? "Edit" : "New"} Class
                </p>
                <h3 className="font-display font-black text-xl text-navy">
                  {editingClass ? `Edit ${editingClass.courseCode}` : "Add Class Session"}
                </h3>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-cloud transition-colors" aria-label="Close">
                <svg className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Course info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Course Code</label>
                  <input
                    type="text"
                    required
                    value={formData.courseCode}
                    onChange={(e) => setFormData({ ...formData, courseCode: e.target.value.toUpperCase() })}
                    placeholder="IEE 301"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Level</label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
                    title="Student level"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>{l} Level</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-navy">Course Title</label>
                <input
                  type="text"
                  required
                  value={formData.courseTitle}
                  onChange={(e) => setFormData({ ...formData, courseTitle: e.target.value })}
                  placeholder="Systems Engineering"
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate"
                />
              </div>

              {/* Day + Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Day</label>
                  <select
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                    title="Day of the week"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as typeof formData.type })}
                    title="Class type"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
                  >
                    {CLASS_TYPES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Start Time</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    title="Class start time"
                    placeholder="08:00"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">End Time</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    title="Class end time"
                    placeholder="10:00"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm"
                  />
                </div>
              </div>

              {/* Venue + Lecturer */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Venue</label>
                  <input
                    type="text"
                    required
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="LT 5"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Lecturer <span className="text-slate font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={formData.lecturer}
                    onChange={(e) => setFormData({ ...formData, lecturer: e.target.value })}
                    placeholder="Dr. Adeola"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate"
                  />
                </div>
              </div>

              {/* Recurring toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setFormData({ ...formData, recurring: !formData.recurring })}
                  className={`relative w-11 h-6 rounded-full transition-colors border-[2px] ${
                    formData.recurring ? "bg-navy border-navy" : "bg-cloud border-navy/20"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow transition-transform ${
                    formData.recurring ? "bg-lime left-5" : "bg-navy/30 left-0.5"
                  }`} />
                </div>
                <span className="text-sm text-navy font-medium">Recurring weekly class</span>
              </label>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-navy text-snow text-sm font-bold press-4 press-navy transition-all"
                >
                  {editingClass ? "Update Class" : "Create Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      ) : (
        <AcademicCalendarTab />
      )}
    </div>
  );
}

export default withAuth(AdminTimetablePage, {
  anyPermission: ["timetable:create", "timetable:edit"],
});
