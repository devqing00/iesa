"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { PermissionGate } from "@/lib/withAuth";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/adminApiError";
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

interface AcademicCalendarTabProps {
  selectedSemester?: number | null;
}

export default function AcademicCalendarTab({ selectedSemester }: AcademicCalendarTabProps = {}) {
  const { user, getAccessToken } = useAuth();
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSemester, setFilterSemester] = useState<number | "">(selectedSemester ?? "");
  const [filterType, setFilterType] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AcademicEvent | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CreateAcademicEventData>({ ...EMPTY_FORM });

  useEffect(() => {
    if (selectedSemester !== undefined && selectedSemester !== null) {
      setFilterSemester(selectedSemester);
    }
  }, [selectedSemester]);

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
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load academic calendar"));
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
    } catch (err) {
      toast.error(getErrorMessage(err, editing ? "Failed to update calendar event" : "Failed to create calendar event"));
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
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete calendar event"));
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

  const sem1 = events.filter((e) => Number(e.semester) === 1);
  const sem2 = events.filter((e) => Number(e.semester) === 2);

  const displayEvents = filterSemester === 1 ? sem1 : filterSemester === 2 ? sem2 : events;

  /* ── Render ── */

  return (
    <div className="space-y-6">
      {/* Stats + Filter Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-snow border-4 border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Total Events</p>
          <p className="font-display font-black text-2xl text-navy">{events.length}</p>
        </div>
        <div className="bg-coral border-4 border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80 mb-1">
            {filterSemester === 2 ? "Semester 2 Events" : filterSemester === 1 ? "Semester 1 Events" : "Semester 1 / 2"}
          </p>
          <p className="font-display font-black text-2xl text-snow">
            {filterSemester === 2 ? sem2.length : filterSemester === 1 ? sem1.length : `${sem1.length} / ${sem2.length}`}
          </p>
        </div>

        {/* Interactive Filter Card: Semester */}
        <div className="bg-sunny-light border-[3px] border-navy rounded-3xl p-4 shadow-[4px_4px_0_0_#000] flex flex-col justify-between transition-all hover:border-navy group">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-navy">Filter Semester</span>
            <span className="text-[9px] font-black text-navy bg-sunny px-2 py-0.5 rounded-md border border-navy/20 uppercase tracking-wider">
              {filterSemester === 1 ? "Sem 1" : filterSemester === 2 ? "Sem 2" : "All"}
            </span>
          </div>
          <div className="relative">
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value ? Number(e.target.value) : "")}
              title="Filter by semester"
              className="w-full bg-snow border-2 border-navy rounded-xl px-3 py-1.5 text-navy font-bold text-xs appearance-none cursor-pointer outline-none shadow-[2px_2px_0_0_#000] pr-7"
            >
              <option value="">Both Semesters</option>
              <option value={1}>First Semester Only</option>
              <option value={2}>Second Semester Only</option>
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-navy pointer-events-none">▼</span>
          </div>
        </div>

        {/* Interactive Filter Card: Event Type */}
        <div className="bg-teal-light border-[3px] border-navy rounded-3xl p-4 shadow-[4px_4px_0_0_#000] flex flex-col justify-between transition-all hover:border-navy group">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-navy">Event Category</span>
            <span className="text-[9px] font-black text-snow bg-teal px-2 py-0.5 rounded-md border border-navy/20 uppercase tracking-wider">
              {filterType ? EVENT_TYPE_LABELS[filterType as AcademicEventType] || filterType : "All"}
            </span>
          </div>
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              title="Filter by event type"
              className="w-full bg-snow border-2 border-navy rounded-xl px-3 py-1.5 text-navy font-bold text-xs appearance-none cursor-pointer outline-none shadow-[2px_2px_0_0_#000] pr-7"
            >
              <option value="">All Event Types</option>
              {ALL_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-navy pointer-events-none">▼</span>
          </div>
        </div>
      </div>

      {/* Industrial Training & Work Experience Reference Banner */}
      <div className="bg-lavender-light border-[3px] border-navy rounded-3xl p-5 shadow-[3px_3px_0_0_#000]">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-lavender animate-pulse" />
          <h3 className="font-display font-black text-sm text-navy uppercase tracking-wider">
            Industrial Training & Work Experience Schedule (IPE)
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-snow border-2 border-navy/20 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-navy bg-lime rounded px-2 py-0.5">200L SWEP</span>
              <span className="text-[9px] font-bold text-slate uppercase">6 – 8 Weeks</span>
            </div>
            <p className="text-xs font-bold text-navy">Student Work Experience Program</p>
            <p className="text-[11px] text-slate mt-0.5">Holds immediately after 2nd semester ends during the break.</p>
          </div>

          <div className="bg-snow border-2 border-navy/20 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-navy bg-sunny rounded px-2 py-0.5">300L SIWES</span>
              <span className="text-[9px] font-bold text-slate uppercase">3 Months</span>
            </div>
            <p className="text-xs font-bold text-navy">Industrial Training Scheme</p>
            <p className="text-[11px] text-slate mt-0.5">Holds after 2nd semester ends (9 to 12 weeks during break).</p>
          </div>

          <div className="bg-snow border-2 border-navy/20 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-snow bg-coral rounded px-2 py-0.5">400L IT</span>
              <span className="text-[9px] font-bold text-slate uppercase">6 Months</span>
            </div>
            <p className="text-xs font-bold text-navy">6-Month Industrial Training</p>
            <p className="text-[11px] text-slate mt-0.5">Starts at beginning of 2nd semester (full off-campus placement).</p>
          </div>
        </div>
      </div>

      {/* Add button */}
      <PermissionGate permission="timetable:create">
        <button onClick={openCreate}
          className="bg-lime border-4 border-navy press-3 press-navy px-6 py-2.5 rounded-2xl text-body font-bold text-sm text-navy transition-all flex items-center gap-2"
        >
          <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
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
            <svg aria-hidden="true" className="w-8 h-8 text-lavender" viewBox="0 0 24 24" fill="currentColor">
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
            if (filterSemester && Number(filterSemester) !== sem) return null;
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
                              <svg aria-hidden="true" className="w-4 h-4 shrink-0 text-slate" viewBox="0 0 24 24" fill="currentColor">
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
                                className="px-4 py-2 rounded-xl bg-ghost border-[3px] border-navy text-navy text-xs font-bold hover:bg-navy hover:text-lime hover:border-lime transition-all"
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
                <svg aria-hidden="true" className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
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
                  className="flex-1 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-lime text-snow text-sm font-bold press-4 press-lime transition-all disabled:opacity-50"
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
