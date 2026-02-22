"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import Pagination from "@/components/ui/Pagination";
import { AnnouncementSchema, flattenZodErrors } from "@/lib/schemas";

/* ─── Types ──────────────────────────────── */

interface Announcement {
  _id: string;
  id?: string;
  title: string;
  content: string;
  targetLevels: string[] | null;
  priority: "low" | "normal" | "high" | "urgent";
  isPinned: boolean;
  sessionId: string;
  authorName?: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string | null;
}

interface FormState {
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  targetLevels: string[];
  isPinned: boolean;
  expiresAt: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  content: "",
  priority: "normal",
  targetLevels: [],
  isPinned: false,
  expiresAt: "",
};

const LEVEL_OPTIONS = ["100L", "200L", "300L", "400L", "500L"];

/* ─── Helpers ────────────────────────────── */

function priorityPill(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-coral text-snow";
    case "high":
      return "bg-coral-light text-coral";
    case "normal":
      return "bg-lavender-light text-lavender";
    default:
      return "bg-cloud text-slate";
  }
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* ─── Component ──────────────────────────── */

export default function AdminAnnouncementsPage() {
  const { user, getAccessToken } = useAuth();
  const { currentSession } = useSession();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  /* ── Fetch ──────────────────────── */

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/announcements/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const mapped = data.map((item: Announcement & { _id?: string }) => ({
          ...item,
          id: item.id || item._id,
        }));
        setAnnouncements(mapped);
      }
    } catch {
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, [user, getAccessToken]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  /* ── Create / Update ────────────── */

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id || a._id);
    setForm({
      title: a.title,
      content: a.content,
      priority: a.priority,
      targetLevels: a.targetLevels ?? [],
      isPinned: a.isPinned,
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 16) : "",
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const parsed = AnnouncementSchema.safeParse(form);
    if (!parsed.success) {
      setFormErrors(flattenZodErrors(parsed.error));
      return;
    }
    setFormErrors({});
    setSubmitting(true);

    try {
      const token = await getAccessToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      if (editingId) {
        const body: Record<string, unknown> = {
          title: form.title,
          content: form.content,
          priority: form.priority,
          targetLevels: form.targetLevels.length > 0 ? form.targetLevels : null,
          isPinned: form.isPinned,
          expiresAt: form.expiresAt || null,
        };
        const res = await fetch(getApiUrl(`/api/v1/announcements/${editingId}`), { method: "PATCH", headers, body: JSON.stringify(body) });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Failed to update announcement");
        }
        toast.success("Announcement updated");
      } else {
        if (!currentSession?.id) {
          throw new Error("No active academic session found. Please activate a session first.");
        }
        const body: Record<string, unknown> = {
          title: form.title,
          content: form.content,
          priority: form.priority,
          sessionId: currentSession.id,
          targetLevels: form.targetLevels.length > 0 ? form.targetLevels : null,
          isPinned: form.isPinned,
          expiresAt: form.expiresAt || null,
          authorId: user?.id ?? "",
        };
        const res = await fetch(getApiUrl("/api/v1/announcements/"), { method: "POST", headers, body: JSON.stringify(body) });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Failed to create announcement");
        }
        toast.success(
          form.targetLevels.length > 0
            ? `Announcement created for ${form.targetLevels.join(", ")}`
            : "Announcement created for all students"
        );
      }

      setModalOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await fetchAnnouncements();
    } catch {
      toast.error("Failed to save announcement");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete ─────────────────────── */

  const handleDelete = async (id: string) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/announcements/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete announcement");
      toast.success("Announcement deleted");
      setDeleteConfirmId(null);
      await fetchAnnouncements();
    } catch {
      toast.error("Failed to delete announcement");
    }
  };

  /* ── Filter ─────────────────────── */

  const filteredAnnouncements = announcements.filter((a) => {
    const matchesLevel = selectedLevel === "all" || (a.targetLevels && a.targetLevels.includes(selectedLevel));
    const matchesSearch = !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const totalPages = Math.ceil(filteredAnnouncements.length / ITEMS_PER_PAGE);
  const paginatedAnnouncements = filteredAnnouncements.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const handleSearch = (v: string) => { setSearchQuery(v); setPage(1); };
  const handleLevelFilter = (v: string) => { setSelectedLevel(v); setPage(1); };

  /* ── Stats ──────────────────────── */

  const totalCount = announcements.length;
  const highCount = announcements.filter((a) => a.priority === "high" || a.priority === "urgent").length;
  const pinnedCount = announcements.filter((a) => a.isPinned).length;

  /* ── Toggle target level ────────── */

  const toggleLevel = (level: string) => {
    setForm((prev) => ({
      ...prev,
      targetLevels: prev.targetLevels.includes(level)
        ? prev.targetLevels.filter((l) => l !== level)
        : [...prev.targetLevels, level],
    }));
  };

  /* ── Render ─────────────────────── */

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ── No Session Warning ─────────────────── */}
        {!currentSession && (
          <div className="bg-coral-light border-[4px] border-coral rounded-2xl p-6 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-coral/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-coral" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-display font-black text-base text-navy mb-1">No Active Session</h4>
                <p className="text-sm text-navy/60">
                  Please create and activate an academic session in the{" "}
                  <a href="/admin/sessions" className="text-coral font-bold hover:underline">Sessions page</a>{" "}
                  before creating announcements.
                </p>
              </div>
            </div>
          </div>
        )}
        {/* ── Header ─────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Administration</p>
            <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
              <span className="brush-highlight">Announcements</span>
            </h1>
            <p className="text-sm text-navy/60 mt-1">Create and manage announcements for students</p>
          </div>
          <button
            onClick={openCreate}
            disabled={!currentSession}
            className={`self-start border-[4px] border-navy press-3 press-navy px-6 py-2.5 rounded-2xl font-display font-bold text-sm transition-all flex items-center gap-2 ${
 currentSession
 ?"bg-lime text-navy cursor-pointer"
 :"bg-slate/30 text-slate/50 cursor-not-allowed"
 }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
            </svg>
            New Announcement
          </button>
        </div>

        {/* ── Stats Bento Row ─────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Total</p>
            <p className="font-display font-black text-3xl text-navy">{totalCount}</p>
          </div>
          <div className="bg-coral border-[4px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">High Priority</p>
            <p className="font-display font-black text-3xl text-snow">{highCount}</p>
          </div>
          <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Pinned</p>
            <p className="font-display font-black text-3xl text-navy">{pinnedCount}</p>
          </div>
        </div>

        {/* ── Filters ─────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-navy text-sm placeholder:text-slate transition-all"
            />
          </div>
          <select
            value={selectedLevel}
            onChange={(e) => handleLevelFilter(e.target.value)}
            aria-label="Filter by level"
            className="px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-navy text-sm appearance-none cursor-pointer"
          >
            <option value="all">All Levels</option>
            {LEVEL_OPTIONS.map((l) => (
              <option key={l} value={l}>{l.replace("L", " Level")}</option>
            ))}
          </select>
        </div>

        {/* ── Announcements Grid ──────── */}
        <div aria-live="polite">
          {loading ? (
            <div className="bg-snow rounded-3xl border-[4px] border-navy p-12 text-center shadow-[4px_4px_0_0_#000]">
              <div className="inline-block w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-navy/60">Loading announcements...</p>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="bg-snow rounded-3xl border-[4px] border-navy p-16 text-center shadow-[4px_4px_0_0_#000] space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-sunny-light flex items-center justify-center">
                <svg className="w-8 h-8 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.881 4.345A23.112 23.112 0 0 1 8.25 6H7.5a5.25 5.25 0 0 0-.88 10.427 21.593 21.593 0 0 0 1.378 3.94c.464 1.004 1.674 1.32 2.582.796l.657-.379c.88-.508 1.165-1.593.772-2.468a17.116 17.116 0 0 1-.628-1.607c1.918.258 3.76.75 5.5 1.446A21.727 21.727 0 0 0 18 11.25c0-2.414-.393-4.735-1.119-6.905Z" />
                </svg>
              </div>
              <p className="text-sm text-navy/60 font-medium">No announcements found</p>
              <button
                onClick={openCreate}
 className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-navy text-lime text-sm font-bold press-4 press-lime transition-all"
              >
                Create your first announcement
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedAnnouncements.map((a, idx) => {
                const id = a.id || a._id;
                const accentBorders = ["border-l-teal", "border-l-coral", "border-l-lavender", "border-l-sunny"];
                return (
                  <div
                    key={id}
 className={`group bg-snow rounded-3xl border-[4px] border-navy p-6 flex flex-col gap-4 transition-all press-3 press-black ${
                      a.isPinned ? "md:col-span-2 border-l-[6px] " + accentBorders[idx % 4] : ""
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${priorityPill(a.priority)}`}>
                        {a.priority}
                      </span>
                      {a.isPinned && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-sunny-light text-sunny">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                          </svg>
                          Pinned
                        </span>
                      )}

                      {/* Actions — visible on hover */}
                      <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(a)}
                          aria-label="Edit announcement"
                          className="p-2 rounded-xl hover:bg-cloud transition-colors"
                        >
                          <svg className="w-4 h-4 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                            <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
                          </svg>
                        </button>
                        {deleteConfirmId === id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(id)} className="px-3 py-1.5 rounded-xl bg-coral text-snow text-xs font-bold hover:opacity-90 transition-opacity">Confirm</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 rounded-xl bg-cloud text-navy/60 text-xs font-bold">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(id)}
                            aria-label="Delete announcement"
                            className="p-2 rounded-xl hover:bg-coral-light transition-colors"
                          >
                            <svg className="w-4 h-4 text-navy/60 hover:text-coral" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-display font-black text-lg text-navy leading-snug">{a.title}</h3>

                    {/* Content */}
                    <p className="text-sm text-navy/60 leading-relaxed line-clamp-3">{a.content}</p>

                    {/* Footer */}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 border-t-[3px] border-navy/10">
                      {a.targetLevels && a.targetLevels.length > 0 ? (
                        a.targetLevels.map((level) => (
                          <span key={level} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cloud text-navy/60">{level}</span>
                        ))
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cloud text-navy/60">All Levels</span>
                      )}
                      <span className="ml-auto text-xs text-slate font-medium">
                        {a.authorName || "Admin"} &middot; {relativeTime(a.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPage={setPage} className="mt-5" />
        </div>
      </div>

      {/* ── Create / Edit Modal ───────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/50" onClick={() => { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); setFormErrors({}); }} />

          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-snow rounded-3xl border-[4px] border-navy shadow-[4px_4px_0_0_#000] p-6 sm:p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-display font-black text-xl text-navy">
                {editingId ? "Edit Announcement" : "New Announcement"}
              </h2>
              <button
                onClick={() => { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); setFormErrors({}); }}
                className="p-2 rounded-xl hover:bg-cloud transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="ann-title" className="text-sm font-bold text-navy">Title</label>
              <input
                id="ann-title"
                type="text"
                value={form.title}
                onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); setFormErrors((p) => ({ ...p, title: undefined })); }}
                placeholder="Announcement title"
                className={`w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] text-navy text-sm placeholder:text-slate transition-all ${formErrors.title ? "border-coral" : "border-navy"}`}
              />
              {formErrors.title && <p className="text-xs text-coral font-bold">{formErrors.title}</p>}
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <label htmlFor="ann-content" className="text-sm font-bold text-navy">Content</label>
              <textarea
                id="ann-content"
                rows={5}
                value={form.content}
                onChange={(e) => { setForm((f) => ({ ...f, content: e.target.value })); setFormErrors((p) => ({ ...p, content: undefined })); }}
                placeholder="Write the announcement content..."
                className={`w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] text-navy text-sm placeholder:text-slate resize-none transition-all ${formErrors.content ? "border-coral" : "border-navy"}`}
              />
              {formErrors.content && <p className="text-xs text-coral font-bold">{formErrors.content}</p>}
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-navy">Priority</label>
              <div className="flex flex-wrap gap-2">
                {(["low", "normal", "high", "urgent"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priority: p }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border-[3px] transition-colors ${
                      form.priority === p
                        ? "bg-navy border-navy text-lime"
                        : "border-navy/20 text-navy/60 hover:border-navy/40"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Levels */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-navy">Target Levels</label>
              <p className="text-xs text-slate">Leave empty to target all levels</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {LEVEL_OPTIONS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleLevel(level)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border-[3px] transition-colors ${
                      form.targetLevels.includes(level)
                        ? "bg-navy border-navy text-lime"
                        : "border-navy/20 text-navy/60 hover:border-navy/40"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Options Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm((f) => ({ ...f, isPinned: !f.isPinned }))}
                  className={`relative w-11 h-6 rounded-full transition-colors border-[2px] ${
                    form.isPinned ? "bg-navy border-navy" : "bg-cloud border-navy/20"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow transition-transform ${
                    form.isPinned ? "bg-lime left-5" : "bg-navy/30 left-0.5"
                  }`} />
                </div>
                <span className="text-sm text-navy font-medium">Pin to top</span>
              </label>

              <div className="space-y-1">
                <label htmlFor="ann-expires" className="text-xs text-slate font-bold">Expires at (optional)</label>
                <input
                  id="ann-expires"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-ghost border-[3px] border-navy text-navy text-sm transition-all"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); setFormErrors({}); }}
                className="px-5 py-2.5 rounded-2xl border-[3px] border-navy text-sm font-bold text-navy hover:bg-cloud transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
 className="px-6 py-2.5 rounded-2xl bg-navy border-[3px] border-navy text-lime text-sm font-bold press-4 press-lime disabled:opacity-40 transition-all"
              >
                {submitting ? "Saving..." : editingId ? "Save Changes" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
