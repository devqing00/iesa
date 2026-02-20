"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ResourceSchema, type ResourceFormData, flattenZodErrors } from "@/lib/schemas";

/* ─── Types ─────────────────────────────────────── */

interface Resource {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  type: string;
  courseCode: string;
  level: number;
  url: string;
  fileType?: string;
  fileSize?: number;
  uploaderName: string;
  tags: string[];
  downloadCount: number;
  viewCount: number;
  isApproved: boolean;
  createdAt: string;
}

/* ─── Helpers ───────────────────────────────────── */

const TYPE_BADGE: Record<string, string> = {
  slide: "bg-lavender-light text-lavender border-[2px] border-lavender",
  pastQuestion: "bg-coral-light text-coral border-[2px] border-coral",
  note: "bg-teal-light text-teal border-[2px] border-teal",
  textbook: "bg-sunny-light text-navy border-[2px] border-navy",
  video: "bg-navy text-lime border-[2px] border-lime",
};

const RESOURCE_TYPES = ["slide", "pastQuestion", "note", "textbook", "video"] as const;
const LEVELS = [100, 200, 300, 400, 500];

/* ─── Component ─────────────────────────────────── */

export default function AdminResourcesPage() {
  const { getAccessToken } = useAuth();

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<ResourceFormData>>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ResourceFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const [approving, setApproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({
        approved: String(tab === "approved"),
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(getApiUrl(`/api/v1/resources?${params}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const mapped = (data.resources ?? []).map((r: Resource) => ({
        ...r,
        id: r.id || r._id,
      }));
      setResources(mapped);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Failed to load resources");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, tab, page]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const approveResource = async (id: string, approve: boolean) => {
    setApproving(id);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/resources/${id}/approve`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ approved: approve }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(approve ? "Resource approved" : "Resource unapproved");
      fetchResources();
    } catch {
      toast.error("Failed to update resource");
    } finally {
      setApproving(null);
    }
  };

  const deleteResource = async (id: string) => {
    if (!confirm("Delete this resource? This cannot be undone.")) return;
    setDeleting(id);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/resources/${id}`), {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Resource deleted");
      fetchResources();
    } catch {
      toast.error("Failed to delete resource");
    } finally {
      setDeleting(null);
    }
  };

  /* ─── Form submission with Zod ─── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const result = ResourceSchema.safeParse(formData);
    if (!result.success) {
      setFieldErrors(flattenZodErrors(result.error));
      toast.error("Please fix the form errors");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/resources/add"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(result.data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Failed to add resource");
      }
      toast.success("Resource added successfully");
      setShowAddForm(false);
      setFormData({});
      fetchResources();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add resource");
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = <K extends keyof ResourceFormData>(key: K, value: ResourceFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-label uppercase tracking-wider text-slate mb-1">Admin › Academic</p>
          <h1 className="font-display font-black text-display-lg text-navy leading-tight">
            Resource <span className="brush-highlight">Library</span>
          </h1>
          <p className="text-slate mt-2 font-normal">Manage study materials, past questions, and course resources.</p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="shrink-0 bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D] px-5 py-3 rounded-2xl font-display text-navy text-sm hover:shadow-[8px_8px_0_0_#0F0F2D] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {showAddForm ? "Cancel" : "Add Resource"}
        </button>
      </div>

      {/* Add Resource Form */}
      {showAddForm && (
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
          <p className="font-display font-black text-xl text-navy mb-6">Add New Resource</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Title */}
              <div className="sm:col-span-2">
                <label className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Title *</label>
                <input
                  type="text"
                  placeholder="e.g. GEG 201 Past Questions 2023"
                  value={formData.title ?? ""}
                  onChange={(e) => updateField("title", e.target.value)}
                  className={`w-full bg-ghost border-[3px] rounded-xl px-4 py-2.5 font-normal text-navy placeholder:text-slate text-sm focus:outline-none transition-colors ${fieldErrors.title ? "border-coral" : "border-navy focus:border-lime"}`}
                />
                {fieldErrors.title && <p className="text-coral text-xs mt-1 font-normal">{fieldErrors.title}</p>}
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Description *</label>
                <textarea
                  rows={3}
                  placeholder="Brief description of this resource…"
                  value={formData.description ?? ""}
                  onChange={(e) => updateField("description", e.target.value)}
                  className={`w-full bg-ghost border-[3px] rounded-xl px-4 py-2.5 font-normal text-navy placeholder:text-slate text-sm focus:outline-none resize-none transition-colors ${fieldErrors.description ? "border-coral" : "border-navy focus:border-lime"}`}
                />
                {fieldErrors.description && <p className="text-coral text-xs mt-1 font-normal">{fieldErrors.description}</p>}
              </div>

              {/* Type */}
              <div>
                <label className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Type *</label>
                <select
                  value={formData.type ?? ""}
                  onChange={(e) => updateField("type", e.target.value as ResourceFormData["type"])}
                  className={`w-full bg-ghost border-[3px] rounded-xl px-4 py-2.5 font-normal text-navy text-sm focus:outline-none appearance-none transition-colors ${fieldErrors.type ? "border-coral" : "border-navy focus:border-lime"}`}
                >
                  <option value="">Select type…</option>
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {fieldErrors.type && <p className="text-coral text-xs mt-1 font-normal">{fieldErrors.type}</p>}
              </div>

              {/* Level */}
              <div>
                <label className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Level *</label>
                <select
                  value={formData.level ?? ""}
                  onChange={(e) => updateField("level", Number(e.target.value) as ResourceFormData["level"])}
                  className={`w-full bg-ghost border-[3px] rounded-xl px-4 py-2.5 font-normal text-navy text-sm focus:outline-none appearance-none transition-colors ${fieldErrors.level ? "border-coral" : "border-navy focus:border-lime"}`}
                >
                  <option value="">Select level…</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>{l}L</option>
                  ))}
                </select>
                {fieldErrors.level && <p className="text-coral text-xs mt-1 font-normal">{fieldErrors.level}</p>}
              </div>

              {/* Course Code */}
              <div>
                <label className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Course Code *</label>
                <input
                  type="text"
                  placeholder="e.g. GEG201"
                  value={formData.courseCode ?? ""}
                  onChange={(e) => updateField("courseCode", e.target.value)}
                  className={`w-full bg-ghost border-[3px] rounded-xl px-4 py-2.5 font-normal text-navy placeholder:text-slate text-sm focus:outline-none transition-colors ${fieldErrors.courseCode ? "border-coral" : "border-navy focus:border-lime"}`}
                />
                {fieldErrors.courseCode && <p className="text-coral text-xs mt-1 font-normal">{fieldErrors.courseCode}</p>}
              </div>

              {/* Tags */}
              <div>
                <label className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. 2023, exam, mcq"
                  value={formData.tags ?? ""}
                  onChange={(e) => updateField("tags", e.target.value)}
                  className="w-full bg-ghost border-[3px] border-navy rounded-xl px-4 py-2.5 font-normal text-navy placeholder:text-slate text-sm focus:outline-none focus:border-lime transition-colors"
                />
              </div>

              {/* URL */}
              <div className="sm:col-span-2">
                <label className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Google Drive or YouTube URL *</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/...  or  https://youtube.com/watch?v=..."
                  value={formData.url ?? ""}
                  onChange={(e) => updateField("url", e.target.value)}
                  className={`w-full bg-ghost border-[3px] rounded-xl px-4 py-2.5 font-normal text-navy placeholder:text-slate text-sm focus:outline-none transition-colors ${fieldErrors.url ? "border-coral" : "border-navy focus:border-lime"}`}
                />
                {fieldErrors.url && <p className="text-coral text-xs mt-1 font-normal">{fieldErrors.url}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setFormData({}); setFieldErrors({}); }}
                className="bg-transparent border-[3px] border-navy px-5 py-2.5 rounded-xl font-display text-navy text-sm hover:bg-ghost transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-lime border-[4px] border-navy shadow-[4px_4px_0_0_#0F0F2D] px-6 py-2.5 rounded-xl font-display text-navy text-sm hover:shadow-[6px_6px_0_0_#0F0F2D] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-[2px] border-navy border-t-transparent rounded-full animate-spin" /> Adding…</>
                ) : "Add Resource"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-3">
        {(["pending", "approved"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl border-[3px] font-display text-sm capitalize transition-all ${
              tab === t
                ? "bg-navy border-navy text-lime shadow-[4px_4px_0_0_#0F0F2D]"
                : "bg-ghost border-navy text-navy hover:bg-lime-light"
            }`}
          >
            {t === "pending" ? "Pending Approval" : "Approved"}
          </button>
        ))}
        <span className="ml-auto text-slate text-sm self-center font-normal">{total} total</span>
      </div>

      {/* Resources table */}
      <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-[4px] border-navy border-t-lime rounded-full animate-spin" />
          </div>
        ) : resources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="w-10 h-10 text-cloud" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
            </svg>
            <p className="font-display font-black text-xl text-navy">No {tab} resources</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-[4px] border-navy bg-ghost">
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Resource</th>
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Course</th>
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Level</th>
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Uploader</th>
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Stats</th>
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r, idx) => {
                  const id = r.id || r._id || "";
                  return (
                    <tr
                      key={id}
                      className={`border-b-[2px] border-cloud ${idx % 2 === 0 ? "bg-snow" : "bg-ghost"}`}
                    >
                      {/* Resource info */}
                      <td className="px-5 py-3 max-w-[220px]">
                        <p className="font-display font-black text-navy text-sm truncate">{r.title}</p>
                        <p className="text-slate text-xs font-normal truncate mt-0.5">{r.description}</p>
                        {r.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {r.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="bg-cloud text-slate text-[10px] px-1.5 py-0.5 rounded-md font-normal">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-display font-black ${TYPE_BADGE[r.type] ?? "bg-ghost text-navy border-[2px] border-cloud"}`}>
                          {r.type}
                        </span>
                      </td>

                      {/* Course */}
                      <td className="px-5 py-3">
                        <p className="font-display font-black text-navy text-sm">{r.courseCode}</p>
                      </td>

                      {/* Level */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="bg-lavender-light text-lavender border-[2px] border-lavender px-2 py-0.5 rounded-md text-xs font-display font-black">
                          {r.level}L
                        </span>
                      </td>

                      {/* Uploader */}
                      <td className="px-5 py-3">
                        <p className="text-navy text-sm font-normal">{r.uploaderName}</p>
                      </td>

                      {/* Stats */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="text-slate text-xs font-normal">{r.downloadCount} downloads</p>
                        <p className="text-slate text-xs font-normal">{r.viewCount} views</p>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-ghost border-[2px] border-navy rounded-lg px-2.5 py-1 text-xs font-display text-navy hover:bg-lime-light transition-colors"
                          >
                            View
                          </a>
                          {tab === "pending" ? (
                            <button
                              disabled={approving === id}
                              onClick={() => approveResource(id, true)}
                              className="bg-teal-light border-[2px] border-teal rounded-lg px-2.5 py-1 text-xs font-display text-teal hover:bg-teal hover:text-snow transition-colors disabled:opacity-50"
                            >
                              {approving === id ? "…" : "Approve"}
                            </button>
                          ) : (
                            <button
                              disabled={approving === id}
                              onClick={() => approveResource(id, false)}
                              className="bg-sunny-light border-[2px] border-navy rounded-lg px-2.5 py-1 text-xs font-display text-navy hover:bg-sunny transition-colors disabled:opacity-50"
                            >
                              {approving === id ? "…" : "Revoke"}
                            </button>
                          )}
                          <button
                            disabled={deleting === id}
                            onClick={() => deleteResource(id)}
                            className="bg-coral-light border-[2px] border-coral rounded-lg px-2.5 py-1 text-xs font-display text-coral hover:bg-coral hover:text-snow transition-colors disabled:opacity-50"
                          >
                            {deleting === id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-slate text-sm font-normal">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="bg-snow border-[3px] border-navy rounded-xl px-4 py-2 font-display text-sm text-navy shadow-[4px_4px_0_0_#000] hover:shadow-[6px_6px_0_0_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0_0_#000] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="bg-lime border-[3px] border-navy rounded-xl px-4 py-2 font-display text-sm text-navy shadow-[4px_4px_0_0_#0F0F2D] hover:shadow-[6px_6px_0_0_#0F0F2D] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0_0_#0F0F2D] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
