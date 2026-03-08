"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { throwApiError, getErrorMessage } from "@/lib/adminApiError";

/* ── Types ──────────────────────────────── */

interface ContactMessage {
  _id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "replied" | "archived";
  adminNote: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  unread: number;
  read: number;
  replied: number;
  archived: number;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  unread: { bg: "bg-coral-light", text: "text-coral", label: "Unread" },
  read: { bg: "bg-lavender-light", text: "text-lavender", label: "Read" },
  replied: { bg: "bg-teal-light", text: "text-teal", label: "Replied" },
  archived: { bg: "bg-cloud", text: "text-slate", label: "Archived" },
};

/* ─── Component ──────────────────────────── */

function AdminMessagesPage() {
  const { getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-messages");

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  // Detail/reply state
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: "" });
  const [deleting, setDeleting] = useState(false);

  // Archive confirmation
  const [archiveConfirm, setArchiveConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: "" });
  const [archiving, setArchiving] = useState(false);

  /* ── Fetch ──────────────────────── */

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(getApiUrl(`/api/v1/contact?${params}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) await throwApiError(res, "load messages");
      const data = await res.json();
      setMessages(data.messages ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load messages"));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, statusFilter, page]);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/contact/stats"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setStats(await res.json());
    } catch {
      /* silent */
    }
  }, [getAccessToken]);

  useEffect(() => { setPage(1); }, [statusFilter]);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ── Actions ────────────────────── */

  const openMessage = async (msg: ContactMessage) => {
    setSelected(msg);
    setAdminNote(msg.adminNote || "");

    // Auto-mark as read on the backend
    if (msg.status === "unread") {
      try {
        const token = await getAccessToken();
        await fetch(getApiUrl(`/api/v1/contact/${msg._id}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        // Update local state
        setMessages((prev) => prev.map((m) => m._id === msg._id ? { ...m, status: "read" } : m));
        setSelected((prev) => prev ? { ...prev, status: "read" } : prev);
        fetchStats();
      } catch { /* silent */ }
    }
  };

  const updateMessage = async (id: string, updates: { status?: string; adminNote?: string }) => {
    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/contact/${id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) await throwApiError(res, "reply to message");
      const updated = await res.json();
      setMessages((prev) => prev.map((m) => m._id === id ? updated : m));
      setSelected(updated);
      toast.success("Message updated");
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update message"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/contact/${id}`), {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) await throwApiError(res, "delete message");
      toast.success("Message deleted");
      setSelected(null);
      setDeleteConfirm({ isOpen: false, id: "" });
      fetchMessages();
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete message"));
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async (id: string) => {
    setArchiving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/contact/${id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) await throwApiError(res, "archive message");
      toast.success("Message archived");
      setSelected(null);
      setArchiveConfirm({ isOpen: false, id: "" });
      fetchMessages();
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to archive message"));
    } finally {
      setArchiving(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-NG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  /* ── Render ─────────────────────── */

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <ToolHelpModal toolId="admin-messages" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-3xl text-navy">Contact Messages</h1>
          <p className="text-slate text-sm mt-1">Messages from the public contact form</p>
        </div>
        {stats && (
          <div className="flex gap-2 flex-wrap">
            {stats.unread > 0 && (
              <span className="px-3 py-1 rounded-full bg-coral-light text-coral text-xs font-bold">
                {stats.unread} unread
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-cloud text-navy text-xs font-bold">
              {stats.total} total
            </span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Unread", count: stats.unread, color: "coral" },
            { label: "Read", count: stats.read, color: "lavender" },
            { label: "Replied", count: stats.replied, color: "teal" },
            { label: "Archived", count: stats.archived, color: "slate" },
          ].map(({ label, count, color }) => (
            <button
              key={label}
              onClick={() => setStatusFilter(label.toLowerCase() === statusFilter ? "all" : label.toLowerCase())}
              className={`bg-snow border-[3px] border-navy rounded-2xl p-4 text-left press-3 press-black transition-all ${
                statusFilter === label.toLowerCase() ? "ring-2 ring-lime ring-offset-2" : ""
              }`}
            >
              <p className={`text-2xl font-display font-black text-${color}`}>{count}</p>
              <p className="text-xs font-bold text-navy/60 uppercase tracking-wider">{label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {["all", "unread", "read", "replied", "archived"].map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-display font-bold border-[2px] transition-all ${
              statusFilter === f
                ? "bg-navy text-snow border-navy"
                : "bg-snow text-navy border-navy/20 hover:border-navy"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-snow border-[3px] border-navy/10 rounded-2xl p-5 animate-pulse">
                  <div className="h-4 bg-cloud rounded w-1/3 mb-3" />
                  <div className="h-3 bg-cloud rounded w-2/3 mb-2" />
                  <div className="h-3 bg-cloud rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="bg-snow border-[3px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
              <svg className="w-16 h-16 text-cloud mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <h3 className="font-display font-black text-xl text-navy mb-1">No messages</h3>
              <p className="text-slate text-sm">
                {statusFilter !== "all" ? `No ${statusFilter} messages found.` : "No contact messages yet."}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const style = STATUS_STYLES[msg.status] || STATUS_STYLES.unread;
              const isSelected = selected?._id === msg._id;
              return (
                <button
                  key={msg._id}
                  onClick={() => openMessage(msg)}
                  className={`w-full text-left bg-snow border-[3px] rounded-2xl p-5 transition-all hover:translate-y-[-1px] ${
                    isSelected
                      ? "border-lime shadow-[4px_4px_0_0_#0F0F2D]"
                      : msg.status === "unread"
                      ? "border-navy shadow-[4px_4px_0_0_#000]"
                      : "border-navy/20 hover:border-navy"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {msg.status === "unread" && (
                          <span className="w-2 h-2 rounded-full bg-coral shrink-0" />
                        )}
                        <h3 className={`font-display font-bold text-sm truncate ${
                          msg.status === "unread" ? "text-navy" : "text-navy/70"
                        }`}>
                          {msg.subject}
                        </h3>
                      </div>
                      <p className="text-xs text-navy/50 truncate">{msg.name} &middot; {msg.email}</p>
                      <p className="text-xs text-slate mt-1 line-clamp-2">{msg.message}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                      <span className="text-[10px] text-slate whitespace-nowrap">{formatDate(msg.createdAt)}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selected ? (
            <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[6px_6px_0_0_#000] sticky top-6 overflow-hidden">
              {/* Detail Header */}
              <div className="p-5 border-b-[3px] border-navy">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="font-display font-black text-lg text-navy leading-tight">{selected.subject}</h2>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1.5 rounded-lg hover:bg-ghost transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4 text-navy/40" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-1 text-xs">
                  <p className="text-navy/60">
                    <span className="font-bold text-navy">{selected.name}</span>
                  </p>
                  <p className="text-navy/60">{selected.email}</p>
                  <p className="text-slate">{formatDate(selected.createdAt)}</p>
                </div>
                <div className="mt-3">
                  {(() => {
                    const style = STATUS_STYLES[selected.status] || STATUS_STYLES.unread;
                    return (
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Message Body */}
              <div className="p-5 border-b-[3px] border-navy/10">
                <p className="text-sm text-navy/80 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
              </div>

              {/* Admin Note */}
              <div className="p-5 space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate">Admin Note</label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add an internal note..."
                  rows={3}
                  className="w-full px-3 py-2 bg-ghost border-[2px] border-navy/10 rounded-xl text-sm text-navy placeholder:text-slate/50 focus:outline-none focus:border-navy resize-none"
                />

                {/* Action Buttons */}
                <PermissionGate permission="contact:manage">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateMessage(selected._id, { adminNote, status: "replied" })}
                      disabled={saving}
                      className="flex-1 px-4 py-2.5 bg-teal border-[3px] border-navy rounded-xl text-xs font-display font-bold text-snow press-3 press-black transition-all disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Mark as Replied"}
                    </button>
                    {selected.status !== "archived" && (
                      <button
                        onClick={() => setArchiveConfirm({ isOpen: true, id: selected._id })}
                        className="px-4 py-2.5 bg-ghost border-[3px] border-navy/20 rounded-xl text-xs font-display font-bold text-navy hover:border-navy transition-all"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirm({ isOpen: true, id: selected._id })}
                      className="px-4 py-2.5 bg-coral-light border-[3px] border-coral rounded-xl text-xs font-display font-bold text-coral hover:bg-coral hover:text-snow transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </PermissionGate>

                {/* Save note only */}
                <PermissionGate permission="contact:manage">
                  {adminNote !== (selected.adminNote || "") && (
                    <button
                      onClick={() => updateMessage(selected._id, { adminNote })}
                      disabled={saving}
                      className="w-full px-4 py-2 bg-lime border-[3px] border-navy rounded-xl text-xs font-display font-bold text-navy press-3 press-navy transition-all disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Note"}
                    </button>
                  )}
                </PermissionGate>

                {/* Reply via email link */}
                <PermissionGate permission="contact:manage">
                  <a
                    href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                    className="block w-full text-center px-4 py-2.5 bg-navy border-[3px] border-navy rounded-xl text-xs font-display font-bold text-snow press-3 press-navy transition-all hover:bg-navy-light"
                  >
                    Reply via Email
                  </a>
                </PermissionGate>
              </div>
            </div>
          ) : (
            <div className="bg-snow border-[3px] border-navy/10 rounded-3xl p-10 text-center">
              <svg className="w-12 h-12 text-cloud mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <p className="font-display font-bold text-navy/40">Select a message to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Modals */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => !deleting && setDeleteConfirm({ isOpen: false, id: "" })}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        title="Delete Message"
        message="Permanently delete this message? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />

      <ConfirmModal
        isOpen={archiveConfirm.isOpen}
        onClose={() => !archiving && setArchiveConfirm({ isOpen: false, id: "" })}
        onConfirm={() => handleArchive(archiveConfirm.id)}
        title="Archive Message"
        message="Archive this message? You can still view it under the Archived filter."
        confirmLabel="Archive"
        variant="warning"
        isLoading={archiving}
      />
    </div>
  );
}

export default withAuth(AdminMessagesPage, {
  anyPermission: ["contact:view", "contact:manage"],
});
