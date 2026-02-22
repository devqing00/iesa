"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import Pagination from "@/components/ui/Pagination";
import { EventSchemaObject, flattenZodErrors } from "@/lib/schemas";

/* ─── Types ──────────────────────────────── */

type EventCategory =
  | "Academic"
  | "Social"
  | "Career"
  | "Workshop"
  | "Competition"
  | "Other";

interface Event {
  _id: string;
  id?: string;
  title: string;
  description: string;
  date: string;
  location: string;
  category: EventCategory;
  maxAttendees?: number;
  registeredCount?: number;
  registrations?: string[];
  imageUrl?: string;
  requiresPayment?: boolean;
  paymentAmount?: number;
  registrationDeadline?: string;
  sessionId?: string;
}

interface RegistrantInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber: string;
  level: string;
  profilePhotoURL: string;
  hasAttended: boolean;
}

interface RegistrantsData {
  eventId: string;
  eventTitle: string;
  totalRegistered: number;
  totalAttended: number;
  registrants: RegistrantInfo[];
}

interface EventFormData {
  title: string;
  description: string;
  date: string;
  location: string;
  category: EventCategory;
  maxAttendees: string;
  imageUrl: string;
}

const CATEGORIES: EventCategory[] = [
  "Academic",
  "Social",
  "Career",
  "Workshop",
  "Competition",
  "Other",
];

const CATEGORY_COLORS: Record<EventCategory, string> = {
  Academic: "bg-lavender-light text-lavender",
  Social: "bg-coral-light text-coral",
  Career: "bg-teal-light text-teal",
  Workshop: "bg-sunny-light text-sunny",
  Competition: "bg-lavender-light text-lavender",
  Other: "bg-cloud text-navy/60",
};

const emptyForm: EventFormData = {
  title: "",
  description: "",
  date: "",
  location: "",
  category: "Other",
  maxAttendees: "",
  imageUrl: "",
};

/* ─── Helpers ────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function attendeePercent(event: Event) {
  const count = event.registrations?.length ?? event.registeredCount ?? 0;
  if (!event.maxAttendees) return 0;
  return Math.min(100, Math.round((count / event.maxAttendees) * 100));
}

function attendeeCount(event: Event) {
  return event.registrations?.length ?? event.registeredCount ?? 0;
}

/* ─── Component ──────────────────────────── */

export default function AdminEventsPage() {
  const { user, getAccessToken } = useAuth();
  const [viewMode, setViewMode] = useState<"upcoming" | "past">("upcoming");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<EventCategory | "All">("All");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form, setForm] = useState<EventFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof EventFormData, string>>>({});

  // Registrations panel state
  const [registrantsEvent, setRegistrantsEvent] = useState<Event | null>(null);
  const [registrantsData, setRegistrantsData] = useState<RegistrantsData | null>(null);
  const [registrantsLoading, setRegistrantsLoading] = useState(false);
  const [registrantSearch, setRegistrantSearch] = useState("");
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  /* ── Fetch ──────────────────────── */

  const fetchEvents = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/events/"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(
          data.map((e: Event & { _id?: string }) => ({
            ...e,
            id: e.id || e._id,
          }))
        );
      }
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchEvents();
    // Fetch active session ID so we can use it when creating events
    const fetchActiveSession = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch(getApiUrl("/api/v1/sessions/active"), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setActiveSessionId(data.id || data._id);
        }
      } catch {
        toast.error("Failed to get active session");
      }
    };
    fetchActiveSession();
  }, [fetchEvents, getAccessToken]);

  /* ── Filter ─────────────────────── */

  const now = new Date();
  const filteredEvents = events.filter((e) => {
    const d = new Date(e.date);
    const timeMatch = viewMode === "upcoming" ? d >= now : d < now;
    const searchMatch =
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.location.toLowerCase().includes(search.toLowerCase());
    const catMatch = catFilter === "All" || e.category === catFilter;
    return timeMatch && searchMatch && catMatch;
  });

  const totalEventPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const handleEventSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleCatFilter = (c: EventCategory | "All") => { setCatFilter(c); setPage(1); };

  /* ── CRUD ───────────────────────── */

  const getToken = async () => {
    const token = await getAccessToken();
    return token ?? "";
  };

  const handleImageUpload = async (file: File) => {
    const token = await getToken();
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(getApiUrl("/api/v1/events/upload-image"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setForm((f) => ({ ...f, imageUrl: data.url }));
    } catch {
      toast.error("Image upload failed");
    } finally {
      setImageUploading(false);
    }
  };

  const openCreate = () => {
    setEditingEvent(null);
    setForm(emptyForm);
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (event: Event) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description,
      date: event.date ? new Date(event.date).toISOString().slice(0, 16) : "",
      location: event.location,
      category: event.category,
      maxAttendees: event.maxAttendees?.toString() ?? "",
      imageUrl: event.imageUrl ?? "",
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSubmit = async () => {
    const CoreSchema = EventSchemaObject.pick({ title: true, description: true, date: true, location: true, category: true });
    const parsed = CoreSchema.safeParse(form);
    if (!parsed.success) {
      setFormErrors(flattenZodErrors(parsed.error));
      return;
    }
    setFormErrors({});
    setSubmitting(true);
    const token = await getToken();

    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        date: new Date(form.date).toISOString(),
        location: form.location,
        category: form.category,
        ...(form.maxAttendees ? { maxAttendees: parseInt(form.maxAttendees) } : {}),
        ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
      };

      if (editingEvent) {
        await fetch(getApiUrl(`/api/v1/events/${editingEvent.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      } else {
        if (!activeSessionId) throw new Error("No active academic session found");
        await fetch(getApiUrl("/api/v1/events/"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...body, sessionId: activeSessionId, createdBy: user?.id ?? "" }),
        });
      }

      setShowModal(false);
      setEditingEvent(null);
      setForm(emptyForm);
      await fetchEvents();
      toast.success(editingEvent ? "Event updated" : "Event created");
    } catch {
      toast.error("Failed to save event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const token = await getToken();
    try {
      await fetch(getApiUrl(`/api/v1/events/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteConfirm(null);
      await fetchEvents();
    } catch {
      toast.error("Failed to delete event");
    }
  };

  /* ── Registrations management ───── */

  const openRegistrants = async (event: Event) => {
    setRegistrantsEvent(event);
    setRegistrantSearch("");
    setRegistrantsData(null);
    setRegistrantsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(getApiUrl(`/api/v1/events/${event.id}/registrations`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load registrants");
      setRegistrantsData(await res.json());
    } catch {
      toast.error("Failed to load registrant list");
    } finally {
      setRegistrantsLoading(false);
    }
  };

  const toggleAttendance = async (eventId: string, userId: string, hasAttended: boolean) => {
    const token = await getToken();
    try {
      if (hasAttended) {
        await fetch(getApiUrl(`/api/v1/events/${eventId}/attendees/${userId}`), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await fetch(getApiUrl(`/api/v1/events/${eventId}/attendees`), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId }),
        });
      }
      // Refresh
      if (registrantsEvent) await openRegistrants(registrantsEvent);
    } catch {
      toast.error("Failed to update attendance");
    }
  };

  const removeRegistration = async (eventId: string, userId: string) => {
    const token = await getToken();
    try {
      const res = await fetch(getApiUrl(`/api/v1/events/${eventId}/registrations/${userId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Registration removed");
      // Re-fetch
      if (registrantsEvent) {
        await openRegistrants(registrantsEvent);
        // Update event list count too
        await fetchEvents();
      }
    } catch {
      toast.error("Failed to remove registration");
    }
  };

  const downloadRegistrants = (format: "csv" | "json") => {
    if (!registrantsData || !registrantsEvent) return;
    const { registrants, eventTitle } = registrantsData;
    const filename = `${eventTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_registrants`;

    let blob: Blob;
    if (format === "csv") {
      const header = "Name,Matric No,Email,Level,Attended";
      const rows = registrants.map((r) =>
        [`${r.firstName} ${r.lastName}`, r.matricNumber, r.email, r.level, r.hasAttended ? "Yes" : "No"]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
      blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    } else {
      blob = new Blob([JSON.stringify(registrantsData, null, 2)], { type: "application/json" });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadMenu(false);
  };

  const markAllAttended = async () => {
    if (!registrantsEvent || !registrantsData) return;
    const unattended = registrantsData.registrants.filter((r) => !r.hasAttended);
    if (unattended.length === 0) { toast.info("All registrants are already marked as attended"); return; }
    setMarkingAll(true);
    try {
      const token = await getToken();
      const res = await fetch(getApiUrl(`/api/v1/events/${registrantsEvent.id}/attendees/bulk`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: unattended.map((r) => r.id) }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Marked ${unattended.length} registrant${unattended.length !== 1 ? "s" : ""} as attended`);
      await openRegistrants(registrantsEvent);
    } catch {
      toast.error("Failed to mark all as attended");
    } finally {
      setMarkingAll(false);
    }
  };

  /* ── Stats ──────────────────────── */

  const totalUpcoming = events.filter((e) => new Date(e.date) >= now).length;
  const totalPast = events.filter((e) => new Date(e.date) < now).length;
  const totalAttendees = events.reduce((s, e) => s + attendeeCount(e), 0);

  /* ── Render ─────────────────────── */

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Administration</p>
            <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
              <span className="brush-highlight">Event</span> Management
            </h1>
            <p className="text-sm text-navy/60 mt-1">Create, edit and manage all departmental events</p>
          </div>
          <button
            onClick={openCreate}
            className="self-start bg-lime border-[4px] border-navy press-3 press-navy px-6 py-2.5 rounded-2xl font-display font-bold text-sm text-navy transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
            </svg>
            Create Event
          </button>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-snow border-[4px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Total Events</p>
            <p className="font-display font-black text-2xl text-navy">{events.length}</p>
          </div>
          <div className="bg-teal border-[4px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">Upcoming</p>
            <p className="font-display font-black text-2xl text-snow">{totalUpcoming}</p>
          </div>
          <div className="bg-snow border-[4px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Past</p>
            <p className="font-display font-black text-2xl text-navy">{totalPast}</p>
          </div>
          <div className="bg-lavender border-[4px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">Registrations</p>
            <p className="font-display font-black text-2xl text-snow">{totalAttendees}</p>
          </div>
        </div>

        {/* ── Filters Bar ── */}
        <div className="bg-snow rounded-3xl border-[4px] border-navy p-4 shadow-[4px_4px_0_0_#000] flex flex-col md:flex-row md:items-center gap-4">
          {/* Tab toggle */}
          <div className="flex items-center bg-cloud rounded-2xl p-1 shrink-0">
            <button
              onClick={() => setViewMode("upcoming")}
              className={`px-4 py-1.5 text-sm font-bold rounded-xl transition-colors ${
                viewMode === "upcoming"
                  ? "bg-navy text-lime"
                  : "text-navy/60 hover:text-navy"
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setViewMode("past")}
              className={`px-4 py-1.5 text-sm font-bold rounded-xl transition-colors ${
                viewMode === "past"
                  ? "bg-navy text-lime"
                  : "text-navy/60 hover:text-navy"
              }`}
            >
              Past
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => handleEventSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate transition-all"
            />
          </div>

          {/* Category filter */}
          <select
            value={catFilter}
            onChange={(e) => handleCatFilter(e.target.value as EventCategory | "All")}
            aria-label="Filter by category"
            className="px-4 py-2.5 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy appearance-none cursor-pointer transition-all"
          >
            <option value="All">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* ── Events Grid ── */}
        <div aria-live="polite">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-snow rounded-3xl border-[4px] border-navy p-5 animate-pulse">
                  <div className="h-36 rounded-2xl bg-cloud mb-4" />
                  <div className="h-4 w-2/3 rounded-full bg-cloud mb-3" />
                  <div className="h-3 w-full rounded-full bg-cloud mb-2" />
                  <div className="h-3 w-1/2 rounded-full bg-cloud" />
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-snow rounded-3xl border-[4px] border-navy p-16 text-center shadow-[4px_4px_0_0_#000] space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-coral-light flex items-center justify-center">
                <svg className="w-8 h-8 text-coral" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
                  <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="font-display font-black text-lg text-navy">
                No {viewMode} events
              </h3>
              <p className="text-sm text-navy/60 max-w-xs mx-auto">
                {viewMode === "upcoming"
                  ? "Create your first event to get started."
                  : "No past events to show."}
              </p>
              {viewMode === "upcoming" && (
                <button
                  onClick={openCreate}
 className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-navy text-lime text-sm font-bold press-4 press-lime transition-all"
                >
                  Create Event
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedEvents.map((event, idx) => {
                const isLarge = idx % 5 === 0;
                return (
                  <div
                    key={event.id}
 className={`group bg-snow rounded-3xl border-[4px] border-navy overflow-hidden press-3 press-black transition-all ${
                      isLarge ? "md:col-span-2" : ""
                    }`}
                  >
                    {/* Image */}
                    {event.imageUrl && (
                      <div className={`relative overflow-hidden ${isLarge ? "h-56" : "h-40"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-snow/90 text-xs font-bold text-navy backdrop-blur-sm">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                          </svg>
                          {formatDate(event.date)}
                        </span>
                      </div>
                    )}

                    <div className="p-5 space-y-3">
                      {/* Category + time pills */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.Other}`}>
                          {event.category}
                        </span>
                        {!event.imageUrl && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cloud text-xs font-bold text-navy/60">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                            </svg>
                            {formatDate(event.date)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cloud text-xs font-bold text-navy/60">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                          </svg>
                          {formatTime(event.date)}
                        </span>
                      </div>

                      <h3 className="font-display font-black text-lg text-navy leading-snug">{event.title}</h3>
                      <p className="text-sm text-navy/60 line-clamp-2 leading-relaxed">{event.description}</p>

                      {/* Location */}
                      <div className="flex items-center gap-1.5 text-sm text-slate">
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 3.827 3.024ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                        </svg>
                        {event.location}
                      </div>

                      {/* Attendees bar */}
                      {event.maxAttendees && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-slate font-bold">
                            <span>{attendeeCount(event)} / {event.maxAttendees} registered</span>
                            <span>{attendeePercent(event)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-cloud overflow-hidden">
                            <div
                              className="h-full rounded-full bg-navy transition-all duration-500"
                              style={{ width: `${attendeePercent(event)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => openEdit(event)}
                          className="flex-1 px-4 py-2 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy font-bold hover:bg-navy hover:text-lime transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openRegistrants(event)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-lavender-light border-[3px] border-lavender text-lavender text-sm font-bold hover:bg-lavender hover:text-snow transition-colors"
                          title="View registered students"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
                          </svg>
                          <span className="hidden sm:inline">{attendeeCount(event)}</span>
                        </button>
                        {deleteConfirm === event.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(event.id!)} className="px-3 py-2 rounded-xl bg-coral text-snow text-sm font-bold hover:opacity-90 transition-opacity">Confirm</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-2 rounded-xl bg-cloud text-sm text-navy/60 font-bold">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(event.id!)}
                            className="p-2 rounded-xl bg-ghost border-[3px] border-navy/20 text-slate hover:border-coral hover:text-coral transition-colors"
                            aria-label="Delete event"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Pagination page={page} totalPages={totalEventPages} onPage={setPage} className="mt-5" />

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/50" onClick={() => { setShowModal(false); setEditingEvent(null); setFormErrors({}); }} />

          <div className="relative w-full max-w-lg bg-snow rounded-3xl border-[4px] border-navy shadow-[4px_4px_0_0_#000] overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b-[4px] border-navy">
              <h2 className="font-display font-black text-xl text-navy">
                {editingEvent ? "Edit Event" : "Create Event"}
              </h2>
              <button
                onClick={() => { setShowModal(false); setEditingEvent(null); setFormErrors({}); }}
                aria-label="Close modal"
                className="p-2 rounded-xl hover:bg-cloud transition-colors"
              >
                <svg className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-navy">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); setFormErrors((p) => ({ ...p, title: undefined })); }}
                  placeholder="e.g. Annual Department Dinner"
                  className={`w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] text-sm text-navy placeholder:text-slate transition-all ${formErrors.title ? "border-coral" : "border-navy"}`}
                />
                {formErrors.title && <p className="text-xs text-coral font-bold">{formErrors.title}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-navy">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => { setForm((f) => ({ ...f, description: e.target.value })); setFormErrors((p) => ({ ...p, description: undefined })); }}
                  rows={3}
                  placeholder="Describe the event..."
                  className={`w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] text-sm text-navy placeholder:text-slate resize-none transition-all ${formErrors.description ? "border-coral" : "border-navy"}`}
                />
                {formErrors.description && <p className="text-xs text-coral font-bold">{formErrors.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    value={form.date}
                    onChange={(e) => { setForm((f) => ({ ...f, date: e.target.value })); setFormErrors((p) => ({ ...p, date: undefined })); }}
                    className={`w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] text-sm text-navy transition-all ${formErrors.date ? "border-coral" : "border-navy"}`}
                  />
                  {formErrors.date && <p className="text-xs text-coral font-bold">{formErrors.date}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as EventCategory }))}
                    aria-label="Event category"
                    className="w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy appearance-none cursor-pointer transition-all"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => { setForm((f) => ({ ...f, location: e.target.value })); setFormErrors((p) => ({ ...p, location: undefined })); }}
                    placeholder="e.g. Faculty Auditorium"
                    className={`w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] text-sm text-navy placeholder:text-slate transition-all ${formErrors.location ? "border-coral" : "border-navy"}`}
                  />
                  {formErrors.location && <p className="text-xs text-coral font-bold">{formErrors.location}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Max Attendees</label>
                  <input
                    type="number"
                    value={form.maxAttendees}
                    onChange={(e) => setForm((f) => ({ ...f, maxAttendees: e.target.value }))}
                    placeholder="Unlimited"
                    className="w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-navy">
                  Event Image <span className="text-slate font-normal">(optional)</span>
                </label>
                {form.imageUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border-[3px] border-navy h-36">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-navy/80 text-snow hover:bg-coral transition-colors"
                      aria-label="Remove image"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center gap-2 w-full h-28 rounded-2xl border-[3px] border-dashed border-navy bg-ghost cursor-pointer hover:bg-cloud transition-colors ${imageUploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                    />
                    {imageUploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-slate">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6 text-slate" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-bold text-slate">Click to upload image</span>
                        <span className="text-[10px] text-slate/60">PNG, JPG, WebP up to 10MB</span>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t-[4px] border-navy">
              <button
                onClick={() => { setShowModal(false); setEditingEvent(null); setFormErrors({}); }}
                className="px-5 py-2.5 rounded-2xl border-[3px] border-navy text-sm font-bold text-navy hover:bg-cloud transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
 className="px-6 py-2.5 rounded-2xl bg-navy border-[3px] border-navy text-lime text-sm font-bold press-4 press-lime disabled:opacity-40 transition-all"
              >
                {submitting ? "Saving..." : editingEvent ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Registrants Panel ─────────────────────────────────────────── */}
      {registrantsEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setRegistrantsEvent(null)} />

          <div className="relative bg-snow border-[4px] border-navy rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[6px_6px_0_0_#000]">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b-[4px] border-navy">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Event Registrations</p>
                <h2 className="font-display font-black text-xl text-navy leading-snug">{registrantsEvent.title}</h2>
                {registrantsData && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-lavender-light text-lavender text-xs font-bold">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
                      </svg>
                      {registrantsData.totalRegistered} registered
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-light text-teal text-xs font-bold">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.491 4.491 0 0 1-3.498-1.307 4.491 4.491 0 0 1-1.307-3.497A4.49 4.49 0 0 1 2.25 12a4.49 4.49 0 0 1 1.549-3.397 4.491 4.491 0 0 1 1.307-3.498A4.491 4.491 0 0 1 8.603 3.8Zm7.44 1.994a3 3 0 0 0-2.25-1.043 3 3 0 0 0-2.25 1.043 3 3 0 0 0-2.344.88 3 3 0 0 0-.878 2.344 3 3 0 0 0-1.043 2.25 3 3 0 0 0 1.043 2.25 3 3 0 0 0 .879 2.344 3 3 0 0 0 2.343.88 3 3 0 0 0 2.25 1.043 3 3 0 0 0 2.25-1.043 3 3 0 0 0 2.344-.879 3 3 0 0 0 .878-2.344 3 3 0 0 0 1.043-2.25 3 3 0 0 0-1.043-2.25 3 3 0 0 0-.878-2.344 3 3 0 0 0-2.344-.879Zm-1.44 5.706a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 0 1-1.06-1.06l3-3a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                      </svg>
                      {registrantsData.totalAttended} attended
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setRegistrantsEvent(null)}
                className="p-2 rounded-xl hover:bg-cloud transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pt-4">
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or matric number…"
                  value={registrantSearch}
                  onChange={(e) => setRegistrantSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-ghost border-[3px] border-navy rounded-xl text-sm text-navy placeholder:text-slate focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {registrantsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-navy/60 font-bold">Loading registrants…</p>
                </div>
              ) : !registrantsData || registrantsData.registrants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-cloud flex items-center justify-center">
                    <svg className="w-7 h-7 text-slate" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="font-display font-black text-navy">No registrations yet</p>
                  <p className="text-sm text-navy/50">Students who register will appear here</p>
                </div>
              ) : (
                (() => {
                  const q = registrantSearch.toLowerCase();
                  const filtered = registrantsData.registrants.filter(
                    (r) =>
                      !q ||
                      `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
                      r.matricNumber.toLowerCase().includes(q) ||
                      r.email.toLowerCase().includes(q)
                  );
                  if (filtered.length === 0) return (
                    <p className="text-center text-sm text-navy/50 py-8">No registrants match your search.</p>
                  );
                  return filtered.map((r) => (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-2xl border-[3px] transition-all ${
                        r.hasAttended
                          ? "border-teal bg-teal-light"
                          : "border-navy/20 bg-ghost hover:border-navy"
                      }`}
                    >
                      {/* Avatar + info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {r.profilePhotoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.profilePhotoURL} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0 border-2 border-navy" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-lavender-light border-2 border-navy flex items-center justify-center shrink-0">
                            <span className="font-display font-black text-xs text-lavender">
                              {r.firstName[0]}{r.lastName[0]}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-display font-bold text-sm text-navy truncate">{r.firstName} {r.lastName}</p>
                          <p className="text-[11px] text-slate truncate">{r.matricNumber || r.email} {r.level && `· ${r.level}`}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle attendance */}
                        <button
                          onClick={() => toggleAttendance(registrantsEvent!.id!, r.id, r.hasAttended)}
                          title={r.hasAttended ? "Mark as absent" : "Mark as attended"}
                          className={`p-1.5 rounded-lg border-2 transition-colors ${
                            r.hasAttended
                              ? "border-teal bg-teal text-snow hover:bg-teal-light hover:text-teal"
                              : "border-navy/20 text-navy/40 hover:border-teal hover:text-teal hover:bg-teal-light"
                          }`}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                          </svg>
                        </button>
                        {/* Remove registration */}
                        <button
                          onClick={() => removeRegistration(registrantsEvent!.id!, r.id)}
                          title="Remove registration"
                          className="p-1.5 rounded-lg border-2 border-navy/20 text-navy/40 hover:border-coral hover:text-coral hover:bg-coral-light transition-colors"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t-[4px] border-navy flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[11px] text-navy/50 font-bold">
                Tick the checkmark to mark attendance · Trash to remove registration
              </p>
              <div className="flex items-center gap-2">
                {/* Mark all attended */}
                <button
                  onClick={markAllAttended}
                  disabled={markingAll || !registrantsData || registrantsData.registrants.every((r) => r.hasAttended)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal border-[3px] border-navy text-snow text-xs font-bold press-3 press-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.491 4.491 0 0 1-3.498-1.307 4.491 4.491 0 0 1-1.307-3.497A4.49 4.49 0 0 1 2.25 12a4.49 4.49 0 0 1 1.549-3.397 4.491 4.491 0 0 1 1.307-3.498A4.491 4.491 0 0 1 8.603 3.8Zm7.44 1.994a3 3 0 0 0-2.25-1.043 3 3 0 0 0-2.25 1.043 3 3 0 0 0-2.344.88 3 3 0 0 0-.878 2.344 3 3 0 0 0-1.043 2.25 3 3 0 0 0 1.043 2.25 3 3 0 0 0 .879 2.344 3 3 0 0 0 2.343.88 3 3 0 0 0 2.25 1.043 3 3 0 0 0 2.25-1.043 3 3 0 0 0 2.344-.879 3 3 0 0 0 .878-2.344 3 3 0 0 0 1.043-2.25 3 3 0 0 0-1.043-2.25 3 3 0 0 0-.878-2.344 3 3 0 0 0-2.344-.879Zm-1.44 5.706a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 0 1-1.06-1.06l3-3a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                  </svg>
                  {markingAll ? "Marking…" : "Mark all attended"}
                </button>

                {/* Download dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowDownloadMenu((v) => !v)}
                    disabled={!registrantsData || registrantsData.registrants.length === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-lime border-[3px] border-navy text-navy text-xs font-bold press-3 press-navy transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                    </svg>
                    Download ▾
                  </button>
                  {showDownloadMenu && (
                    <div className="absolute right-0 bottom-full mb-1.5 w-36 bg-snow border-[3px] border-navy rounded-2xl shadow-[4px_4px_0_0_#000] overflow-hidden z-10">
                      <button
                        onClick={() => downloadRegistrants("csv")}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-navy hover:bg-lime-light transition-colors flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5 text-teal shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM9.75 14.25a.75.75 0 0 0 0 1.5H15a.75.75 0 0 0 0-1.5H9.75Z" clipRule="evenodd" />
                        </svg>
                        CSV (.csv)
                      </button>
                      <div className="border-t-[2px] border-navy/10" />
                      <button
                        onClick={() => downloadRegistrants("json")}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-navy hover:bg-lavender-light transition-colors flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5 text-lavender shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM9.75 17.25a.75.75 0 0 0 0 1.5H15a.75.75 0 0 0 0-1.5H9.75Zm0-3a.75.75 0 0 0 0 1.5H15a.75.75 0 0 0 0-1.5H9.75Z" clipRule="evenodd" />
                        </svg>
                        JSON (.json)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setRegistrantsEvent(null)}
                  className="px-5 py-2 rounded-2xl border-[3px] border-navy text-sm font-bold text-navy hover:bg-cloud transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>  );
}