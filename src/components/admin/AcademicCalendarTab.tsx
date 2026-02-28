"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { PermissionGate } from "@/lib/withAuth";
import { toast } from "sonner";
import {
  listAcademicEvents,
  createAcademicEvent,
  updateAcademicEvent,
  deleteAcademicEvent,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  ALL_EVENT_TYPES,
} from "@/lib/api";
import type { AcademicEvent, AcademicEventType, CreateAcademicEventData } from "@/lib/api";

/* ─── Helpers ────────────────────────────── */

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const EMPTY_FORM: CreateAcademicEventData = {
  title: "",
  eventType: "exam_period",
  startDate: "",
  endDate: null,
  semester: 1,
  description: "",
};

/* ─── Component ──────────────────────────── */

export default function AcademicCalendarTab() {
  const { user, getAccessToken } = useAuth();
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSemester, setFilterSemester] = useState<number | "">("");
  const [filterType, setFilterType] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AcademicEvent | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CreateAcademicEventData>({ ...EMPTY_FORM });

  /* ── Fetch ── */

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    try {
      // ensure token is fresh before calling API
      await getAccessToken();
      const filters: Record<string, string | number> = {};
      if (filterSemester) filters.semester = filterSemester;
      if (filterType) filters.eventType = filterType;
      const data = await listAcademicEvents(filters as { semester?: number; eventType?: string });
      setEvents(data);
    } catch {
      toast.error("Failed to load academic calendar");
    } finally {
      setLoading(false);
    }
  }, [user, getAccessToken, filterSemester, filterType]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /* ── Create / Edit ── */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      if (editing) {
        await updateAcademicEvent(editing.id, {
          title: formData.title,
          eventType: formData.eventType,
          startDate: formData.startDate,
          endDate: formData.endDate || undefined,
          semester: formData.semester,
          description: formData.description || undefined,
        });
        toast.success("Event updated");
      } else {
        await createAcademicEvent({
          ...formData,
          endDate: formData.endDate || null,
          description: formData.description || undefined,
        });
        toast.success("Event created");
      }
      closeModal();
      await fetchEvents();
    } catch {
      toast.error("Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */

  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeleting(id);
    try {
      await deleteAcademicEvent(id);
      toast.success("Event deleted");
      await fetchEvents();
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setDeleting(null);
    }
  };

  /* ── Modal helpers ── */

  const openCreate = () => {
    setEditing(null);
    setFormData({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (ev: AcademicEvent) => {
    setEditing(ev);
    setFormData({
      title: ev.title,
      eventType: ev.eventType,
      startDate: ev.startDate.slice(0, 16), // datetime-local format
      endDate: ev.endDate ? ev.endDate.slice(0, 16) : null,
      semester: ev.semester,
      description: ev.description || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  /* ── Group events by semester ── */

  const sem1 = events.filter((e) => e.semester === 1);
  const sem2 = events.filter((e) => e.semester === 2);

  const displayEvents = filterSemester === 1 ? sem1 : filterSemester === 2 ? sem2 : events;

  /* ── Render ── */

  return (
    <div className="space-y-6">
      {/* Stats + Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-snow border-4 border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Total Events</p>
          <p className="font-display font-black text-2xl text-navy">{events.length}</p>
        </div>
        <div className="bg-coral border-4 border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">Semester 1</p>
          <p className="font-display font-black text-2xl text-snow">{sem1.length}</p>
        </div>

        {/* Filter: Semester */}
        <div className="bg-ghost border-[3px] border-navy rounded-2xl p-4 flex flex-col justify-center">
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Semester</label>
          <select
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value ? Number(e.target.value) : "")}
            title="Filter by semester"
            className="bg-transparent text-navy font-bold text-sm appearance-none cursor-pointer outline-none"
          >
            <option value="">Both</option>
            <option value={1}>First Semester</option>
            <option value={2}>Second Semester</option>
          </select>
        </div>

        {/* Filter: Type */}
        <div className="bg-ghost border-[3px] border-navy rounded-2xl p-4 flex flex-col justify-center">
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Event Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            title="Filter by event type"
            className="bg-transparent text-navy font-bold text-sm appearance-none cursor-pointer outline-none"
          >
            <option value="">All Types</option>
            {ALL_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Add button */}
      <PermissionGate permission="timetable:create">
        <button
          onClick={openCreate}
          className="bg-lime border-4 border-navy press-3 press-navy px-6 py-2.5 rounded-2xl font-display font-bold text-sm text-navy transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
          </svg>
          Add Calendar Event
        </button>
      </PermissionGate>

      {/* Event List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-snow border-4 border-navy rounded-3xl p-6 animate-pulse">
              <div className="h-5 w-40 bg-cloud rounded-lg mb-3" />
              <div className="h-4 w-24 bg-cloud rounded-lg" />
            </div>
          ))}
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="bg-snow border-4 border-navy rounded-3xl p-16 text-center shadow-[4px_4px_0_0_#000] space-y-4">
          <div className="w-16 h-16 bg-lavender-light rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-lavender" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-display font-black text-lg text-navy">No calendar events</h3>
          <p className="text-sm text-navy/60 max-w-sm mx-auto">
            Add academic calendar events like exam periods, registration dates, and holidays.
          </p>
        </div>
      ) : (
        <>
          {/* Semester groups */}
          {[1, 2].map((sem) => {
            const semEvents = displayEvents.filter((e) => e.semester === sem);
            if (semEvents.length === 0) return null;
            return (
              <div key={sem}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="font-display font-black text-lg text-navy">
                    {sem === 1 ? "First" : "Second"} Semester
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-cloud text-slate text-xs font-bold">
                    {semEvents.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {semEvents.map((ev) => {
                    const colors = EVENT_TYPE_COLORS[ev.eventType] || EVENT_TYPE_COLORS.other;
                    return (
                      <div
                        key={ev.id}
                        className="bg-snow border-4 border-navy rounded-3xl p-5 press-3 press-black transition-all group"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${colors.bg} ${colors.text} border-2 ${colors.border}`}
                              >
                                {EVENT_TYPE_LABELS[ev.eventType]}
                              </span>
                            </div>
                            <h3 className="font-display font-black text-lg text-navy mb-1">{ev.title}</h3>
                            {ev.description && (
                              <p className="text-sm text-navy/60 mb-2">{ev.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-sm text-navy/70">
                              <svg className="w-4 h-4 shrink-0 text-slate" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">
                                {formatDate(ev.startDate)}
                                {ev.endDate && ` — ${formatDate(ev.endDate)}`}
                              </span>
                            </div>
                          </div>

                          <PermissionGate permission="timetable:edit">
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => openEdit(ev)}
                                className="px-4 py-2 rounded-xl bg-ghost border-[3px] border-navy text-navy text-xs font-bold hover:bg-navy hover:text-snow transition-all"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(ev.id)}
                                disabled={deleting === ev.id}
                                className="px-4 py-2 rounded-xl bg-coral-light border-[3px] border-coral text-coral text-xs font-bold hover:bg-coral hover:text-snow transition-all disabled:opacity-50"
                              >
                                {deleting === ev.id ? "..." : "Delete"}
                              </button>
                            </div>
                          </PermissionGate>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-4 sm:p-6">
          <div className="absolute inset-0 bg-navy/50" onClick={closeModal} />
          <div className="relative bg-snow border-4 border-navy rounded-3xl p-8 w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[85vh] overflow-y-auto shadow-[4px_4px_0_0_#000] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">
                  {editing ? "Edit" : "New"} Event
                </p>
                <h3 className="font-display font-black text-xl text-navy">
                  {editing ? "Edit Calendar Event" : "Add Calendar Event"}
                </h3>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-cloud transition-colors" aria-label="Close">
                <svg className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-navy">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="First Semester Examinations"
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate"
                />
              </div>

              {/* Type + Semester */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Event Type</label>
                  <select
                    value={formData.eventType}
                    onChange={(e) =>
                      setFormData({ ...formData, eventType: e.target.value as AcademicEventType })
                    }
                    title="Academic event type"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
                  >
                    {ALL_EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EVENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Semester</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                    title="Semester"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
                  >
                    <option value={1}>First Semester</option>
                    <option value={2}>Second Semester</option>
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Start Date</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    title="Event start date"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">
                    End Date <span className="text-slate font-normal">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value || null })
                    }
                    title="Event end date"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-navy">
                  Description <span className="text-slate font-normal">(optional)</span>
                </label>
                <textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Additional details about this event..."
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate resize-none"
                />
              </div>

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
                  disabled={saving}
                  className="flex-1 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-navy text-snow text-sm font-bold press-4 press-navy transition-all disabled:opacity-50"
                >
                  {saving ? "Saving..." : editing ? "Update Event" : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
