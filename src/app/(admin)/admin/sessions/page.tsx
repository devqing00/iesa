"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import { throwApiError, getErrorMessage } from "@/lib/adminApiError";
import { SessionSchema, flattenZodErrors, type SessionFormData } from "@/lib/schemas";
import { ConfirmModal } from "@/components/ui/Modal";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ── Types ──────────────────────────────── */

interface Session {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  semester1StartDate?: string;
  semester1EndDate?: string;
  semester2StartDate?: string;
  semester2EndDate?: string;
  currentSemester: 1 | 2;
  isActive: boolean;
  createdAt: string;
}

/* ─── Helpers ────────────────────────────── */

/* ─── Component ──────────────────────────── */

function AdminSessionsPage() {
  const { user, getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-sessions");
  const { refreshSessions } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [activateConfirm, setActivateConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: "", name: "" });
  const [activating, setActivating] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof SessionFormData, string>>>({});
  const [formData, setFormData] = useState({
    name: "",
    semester1StartDate: "",
    semester1EndDate: "",
    semester2StartDate: "",
    semester2EndDate: "",
    isActive: false,
  });

  /* ── Fetch ──────────────────────── */

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/sessions/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) await throwApiError(response, "load sessions");
      const data = await response.json();
      setSessions(data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load sessions"));
    } finally {
      setLoading(false);
    }
  }, [user, getAccessToken]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  /* ── Create ─────────────────────── */

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormErrors({});
    const result = SessionSchema.safeParse(formData);
    if (!result.success) {
      setFormErrors(flattenZodErrors<SessionFormData>(result.error));
      toast.error("Please fix the form errors");
      return;
    }
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/sessions/"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) await throwApiError(response, "create session");
      await fetchSessions();
      await refreshSessions();
      setShowCreateModal(false);
      setFormErrors({});
      setFormData({ name: "", semester1StartDate: "", semester1EndDate: "", semester2StartDate: "", semester2EndDate: "", isActive: false });
      toast.success("Session created successfully");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create session"));
    }
  };

  /* ── Edit ───────────────────────── */

  const handleEditSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingSession) return;
    setFormErrors({});
    const result = SessionSchema.safeParse(formData);
    if (!result.success) {
      setFormErrors(flattenZodErrors<SessionFormData>(result.error));
      toast.error("Please fix the form errors");
      return;
    }
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl(`/api/v1/sessions/${editingSession.id}`), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) await throwApiError(response, "update session");
      await fetchSessions();
      await refreshSessions();
      setShowEditModal(false);
      setEditingSession(null);
      setFormErrors({});
      setFormData({ name: "", semester1StartDate: "", semester1EndDate: "", semester2StartDate: "", semester2EndDate: "", isActive: false });
      toast.success("Session updated successfully");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update session"));
    }
  };

  const openEditModal = (session: Session) => {
    setEditingSession(session);
    setFormErrors({});
    setFormData({
      name: session.name,
      semester1StartDate: session.semester1StartDate ? session.semester1StartDate.split('T')[0] : '',
      semester1EndDate: session.semester1EndDate ? session.semester1EndDate.split('T')[0] : '',
      semester2StartDate: session.semester2StartDate ? session.semester2StartDate.split('T')[0] : '',
      semester2EndDate: session.semester2EndDate ? session.semester2EndDate.split('T')[0] : '',
      isActive: session.isActive,
    });
    setShowEditModal(true);
  };

  /* ── Toggle Active ──────────────── */

  const toggleActive = async (sessionId: string) => {
    if (!user) return;
    setActivating(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl(`/api/v1/sessions/${sessionId}`), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: true }),
      });
      if (!response.ok) await throwApiError(response, "set active session");
      await fetchSessions();
      await refreshSessions();
      toast.success("Session activated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to activate session"));
    } finally {
      setActivating(false);
    }
  };

  const activeSession = sessions.find((s) => s.isActive);
  const inactiveSessions = sessions.filter((s) => !s.isActive);

  /* ── Helper ─────────────────────── */

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return "Not set";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Not set";
      return date.toLocaleDateString();
    } catch {
      return "Not set";
    }
  };

  /* ── Render ─────────────────────── */

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <ToolHelpModal toolId="admin-sessions" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Administration</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Academic</span> Sessions
          </h1>
          <p className="text-sm text-navy/60 mt-1">Manage academic years and semesters</p>
        </div>
        <PermissionGate permission="session:create">
          <button
            onClick={() => setShowCreateModal(true)}
            className="self-start bg-lime border-[3px] border-navy press-3 press-navy px-6 py-2.5 rounded-2xl font-display font-bold text-sm text-navy transition-all flex items-center gap-2"
          >
            <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
            </svg>
            New Session
          </button>
        </PermissionGate>
      </div>

      {/* ── Stats Row ── */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Total Sessions</p>
            <p className="font-display font-black text-3xl text-navy">{sessions.length}</p>
          </div>
          <div className="bg-teal border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">Active</p>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-snow animate-pulse" />
              <p className="font-display font-black text-3xl text-snow">{activeSession ? 1 : 0}</p>
            </div>
          </div>
          <div className="bg-lavender border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] col-span-2 md:col-span-1 rotate-[-0.5deg] hover:rotate-0 transition-transform">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">Current Semester</p>
            <p className="font-display font-black text-3xl text-snow">
              {activeSession ? `Sem ${activeSession.currentSemester}` : "—"}
            </p>
          </div>
        </div>
      )}

      {/* ── Sessions List ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-snow border-[3px] border-navy rounded-3xl p-6 space-y-4 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-20 rounded-xl bg-cloud" />
                  <div className="h-7 w-32 rounded-xl bg-cloud" />
                </div>
                <div className="h-6 w-16 rounded-full bg-cloud" />
              </div>
              <div className="h-px bg-cloud" />
              <div className="space-y-3">
                <div className="h-4 w-full rounded-xl bg-cloud" />
                <div className="h-4 w-3/4 rounded-xl bg-cloud" />
              </div>
              <div className="h-10 w-full rounded-2xl bg-cloud" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-16 text-center shadow-[4px_4px_0_0_#000] space-y-4">
          <div className="w-16 h-16 bg-sunny-light rounded-2xl flex items-center justify-center mx-auto">
            <svg aria-hidden="true" className="w-8 h-8 text-sunny" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-display font-black text-lg text-navy">No sessions yet</h3>
          <p className="text-sm text-navy/60 max-w-sm mx-auto">
            Create your first academic session to get started with managing semesters and enrollment periods.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Session — Featured Card */}
          {activeSession && (
            <div className="bg-navy border-[3px] border-ghost/20 rounded-3xl p-6 md:p-8 relative overflow-hidden">
              {/* Decorative diamonds */}
              <svg aria-hidden="true" className="absolute top-4 right-4 w-5 h-5 text-navy/12 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
              </svg>
              <svg aria-hidden="true" className="absolute bottom-6 right-16 w-4 h-4 text-navy/10 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
              </svg>

              <div className="relative flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal/20 text-snow text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-lime animate-pulse" />
                      Active Session
                    </span>
                    <span className="px-3 py-1 rounded-full bg-lime/10 text-snow/80 text-xs font-bold">
                      Semester {activeSession.currentSemester}
                    </span>
                  </div>
                  <h2 className="font-display font-black text-2xl md:text-3xl text-snow">
                    {activeSession.name}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-snow/50">
                    <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                    </svg>
                    <span>
                      {formatDate(activeSession.startDate)} – {formatDate(activeSession.endDate)}
                    </span>
                  </div>
                </div>
                <PermissionGate permission="session:edit">
                  <button
                    onClick={() => openEditModal(activeSession)}
                    className="bg-teal/20 border-[3px] border-ghost/20 text-snow px-6 py-2.5 rounded-2xl text-sm font-bold hover:bg-ghost hover:text-navy transition-all flex items-center gap-2"
                  >
                    <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                      <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
                    </svg>
                    Edit Session
                  </button>
                </PermissionGate>
              </div>
            </div>
          )}

          {/* Other Sessions Grid */}
          {inactiveSessions.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-display font-black text-xl text-navy">Other Sessions</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-cloud text-slate text-xs font-bold">{inactiveSessions.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveSessions.map((session) => (
                  <div
                    key={session.id}
 className="bg-snow border-[3px] border-navy rounded-3xl p-6 press-3 press-black transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-display font-black text-xl text-navy">{session.name}</h3>
                      <span className="px-3 py-1 rounded-full bg-cloud text-navy/60 text-xs font-bold shrink-0 ml-3">
                        Sem {session.currentSemester}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-navy/60 mb-5">
                      <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                      </svg>
                      <span>
                        {formatDate(session.startDate)} – {formatDate(session.endDate)}
                      </span>
                    </div>

                    <div className="flex gap-2.5">
                      <PermissionGate permission="session:activate">
                        <button
                          onClick={() => setActivateConfirm({ isOpen: true, id: session.id, name: session.name })}
                          className="flex-1 bg-lime border-[3px] border-navy text-navy px-4 py-2.5 rounded-2xl text-sm font-bold press-3 press-navy transition-all"
                        >
                          Set as Active
                        </button>
                      </PermissionGate>
                      <PermissionGate permission="session:edit">
                        <button
                          onClick={() => openEditModal(session)}
                          className="p-2.5 bg-ghost border-[3px] border-navy text-navy rounded-2xl hover:bg-navy hover:text-lime hover:border-lime transition-all"
                          aria-label="Edit session"
                        >
                          <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                            <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
                          </svg>
                        </button>
                      </PermissionGate>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create Session Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-4 sm:p-6">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setShowCreateModal(false)} />

          <div className="relative bg-snow border-[3px] border-navy rounded-3xl p-8 w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[85vh] overflow-y-auto shadow-[4px_4px_0_0_#000] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">New Session</p>
                <h3 className="font-display font-black text-xl text-navy">Create Academic Session</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl hover:bg-cloud transition-colors"
                aria-label="Close modal"
              >
                <svg aria-hidden="true" className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="sessionName" className="text-sm font-bold text-navy">
                  Session Name <span className="text-slate font-normal">(e.g., 2024/2025)</span>
                </label>
                <input
                  id="sessionName"
                  type="text"
                  required
                  pattern="\d{4}/\d{4}"
                  value={formData.name}
                  onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFormErrors((p) => ({ ...p, name: undefined })); }}
                  placeholder="2024/2025"
                  title="Session name in format YYYY/YYYY"
                  className={`w-full px-4 py-3 bg-ghost border-[3px] rounded-2xl text-navy text-sm placeholder:text-slate transition-all ${formErrors.name ? "border-coral" : "border-navy"}`}
                />
                {formErrors.name && <p className="text-coral text-xs font-normal mt-0.5">{formErrors.name}</p>}
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-navy uppercase tracking-wider">Semester 1</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="sem1Start" className="text-sm font-bold text-navy">Start Date</label>
                    <input
                      id="sem1Start"
                      type="date"
                      required
                      value={formData.semester1StartDate}
                      onChange={(e) => { setFormData({ ...formData, semester1StartDate: e.target.value }); setFormErrors((p) => ({ ...p, semester1StartDate: undefined, semester1EndDate: undefined })); }}
                      className={`w-full px-4 py-3 bg-ghost border-[3px] rounded-2xl text-navy text-sm transition-all ${formErrors.semester1StartDate ? "border-coral" : "border-navy"}`}
                    />
                    {formErrors.semester1StartDate && <p className="text-coral text-xs font-normal mt-0.5">{formErrors.semester1StartDate}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="sem1End" className="text-sm font-bold text-navy">End Date</label>
                    <input
                      id="sem1End"
                      type="date"
                      required
                      value={formData.semester1EndDate}
                      onChange={(e) => { setFormData({ ...formData, semester1EndDate: e.target.value }); setFormErrors((p) => ({ ...p, semester1EndDate: undefined })); }}
                      className={`w-full px-4 py-3 bg-ghost border-[3px] rounded-2xl text-navy text-sm transition-all ${formErrors.semester1EndDate ? "border-coral" : "border-navy"}`}
                    />
                    {formErrors.semester1EndDate && <p className="text-coral text-xs font-normal mt-0.5">{formErrors.semester1EndDate}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-navy uppercase tracking-wider">Semester 2</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="sem2Start" className="text-sm font-bold text-navy">Start Date</label>
                    <input
                      id="sem2Start"
                      type="date"
                      required
                      value={formData.semester2StartDate}
                      onChange={(e) => { setFormData({ ...formData, semester2StartDate: e.target.value }); setFormErrors((p) => ({ ...p, semester2StartDate: undefined, semester2EndDate: undefined })); }}
                      className={`w-full px-4 py-3 bg-ghost border-[3px] rounded-2xl text-navy text-sm transition-all ${formErrors.semester2StartDate ? "border-coral" : "border-navy"}`}
                    />
                    {formErrors.semester2StartDate && <p className="text-coral text-xs font-normal mt-0.5">{formErrors.semester2StartDate}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="sem2End" className="text-sm font-bold text-navy">End Date</label>
                    <input
                      id="sem2End"
                      type="date"
                      required
                      value={formData.semester2EndDate}
                      onChange={(e) => { setFormData({ ...formData, semester2EndDate: e.target.value }); setFormErrors((p) => ({ ...p, semester2EndDate: undefined })); }}
                      className={`w-full px-4 py-3 bg-ghost border-[3px] rounded-2xl text-navy text-sm transition-all ${formErrors.semester2EndDate ? "border-coral" : "border-navy"}`}
                    />
                    {formErrors.semester2EndDate && <p className="text-coral text-xs font-normal mt-0.5">{formErrors.semester2EndDate}</p>}
                  </div>
                </div>
              </div>

              {/* Auto-derived info */}
              {formData.semester1StartDate && formData.semester2EndDate && (
                <div className="bg-ghost border-[2px] border-navy/10 rounded-2xl p-4 space-y-1">
                  <p className="text-xs font-bold text-slate uppercase tracking-wider mb-2">Auto-Derived</p>
                  <p className="text-sm text-navy">
                    <span className="font-bold">Session:</span> {new Date(formData.semester1StartDate).toLocaleDateString()} – {new Date(formData.semester2EndDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-navy">
                    <span className="font-bold">Current Semester:</span> {(() => {
                      const now = new Date();
                      const sem2Start = new Date(formData.semester2StartDate);
                      return now < sem2Start ? "Semester 1" : "Semester 2";
                    })()}
                  </p>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`relative w-11 h-6 rounded-full transition-colors border-[2px] ${
                    formData.isActive ? "bg-navy border-lime" : "bg-cloud border-navy/20"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow transition-transform ${
                    formData.isActive ? "bg-lime left-5" : "bg-navy/30 left-0.5"
                  }`} />
                </div>
                <span className="text-sm text-navy font-medium">Set as active session (will deactivate others)</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
 className="flex-1 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-lime text-snow text-sm font-bold press-4 press-lime transition-all"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Session Modal ── */}
      {showEditModal && editingSession && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-4 sm:p-6">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setShowEditModal(false)} />

          <div className="relative bg-snow border-[3px] border-navy rounded-3xl p-8 w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[85vh] overflow-y-auto shadow-[4px_4px_0_0_#000] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Edit Session</p>
                <h3 className="font-display font-black text-xl text-navy">Update {editingSession.name}</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-xl hover:bg-cloud transition-colors"
                aria-label="Close modal"
              >
                <svg aria-hidden="true" className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditSession} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="editSessionName" className="text-sm font-bold text-navy">
                  Session Name <span className="text-slate font-normal">(e.g., 2024/2025)</span>
                </label>
                <input
                  id="editSessionName"
                  type="text"
                  required
                  pattern="\d{4}/\d{4}"
                  value={formData.name}
                  onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFormErrors((p) => ({ ...p, name: undefined })); }}
                  placeholder="2024/2025"
                  title="Session name in format YYYY/YYYY"
                  className={`w-full px-4 py-3 bg-ghost border-[3px] rounded-2xl text-navy text-sm placeholder:text-slate transition-all ${formErrors.name ? "border-coral" : "border-navy"}`}
                />
                {formErrors.name && <p className="text-coral text-xs font-normal mt-0.5">{formErrors.name}</p>}
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-navy uppercase tracking-wider">Semester 1</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="editSem1Start" className="text-sm font-bold text-navy">Start Date</label>
                    <input
                      id="editSem1Start"
                      type="date"
                      required
                      value={formData.semester1StartDate}
                      onChange={(e) => { setFormData({ ...formData, semester1StartDate: e.target.value }); setFormErrors((p) => ({ ...p, semester1StartDate: undefined, semester1EndDate: undefined })); }}
                      className={`w-full px-4 py-3 bg-ghost border-[3px] rounded-2xl text-navy text-sm transition-all ${formErrors.semester1StartDate ? "border-coral" : "border-navy"}`}
                    />
                    {formErrors.semester1StartDate && <p className="text-coral text-xs font-normal mt-0.5">{formErrors.semester1StartDate}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="editSem1End" className="text-sm font-bold text-navy">End Date</label>
                    <input
                      id="editSem1End"
                      type="date"
                      required
                      value={formData.semester1EndDate}
                      onChange={(e) => { setFormData({ ...formData, semester1EndDate: e.target.value }); setFormErrors((p) => ({ ...p, semester1EndDate: undefined })); }}
                      className={`w-full px-4 py-3 bg-ghost border-[3px] rounded-2xl text-navy text-sm transition-all ${formErrors.semester1EndDate ? "border-coral" : "border-navy"}`}
                    />
                    {formErrors.semester1EndDate && <p className="text-coral text-xs font-normal mt-0.5">{formErrors.semester1EndDate}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-navy uppercase tracking-wider">Semester 2</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="editSem2Start" className="text-sm font-bold text-navy">Start Date</label>
                    <input
                      id="editSem2Start"
                      type="date"
                      required
                      value={formData.semester2StartDate}
                      onChange={(e) => { setFormData({ ...formData, semester2StartDate: e.target.value }); setFormErrors((p) => ({ ...p, semester2StartDate: undefined, semester2EndDate: undefined })); }}
                      className={`w-full px-4 py-3 bg-ghost border-[3px] rounded-2xl text-navy text-sm transition-all ${formErrors.semester2StartDate ? "border-coral" : "border-navy"}`}
                    />
                    {formErrors.semester2StartDate && <p className="text-coral text-xs font-normal mt-0.5">{formErrors.semester2StartDate}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="editSem2End" className="text-sm font-bold text-navy">End Date</label>
                    <input
                      id="editSem2End"
                      type="date"
                      required
                      value={formData.semester2EndDate}
                      onChange={(e) => { setFormData({ ...formData, semester2EndDate: e.target.value }); setFormErrors((p) => ({ ...p, semester2EndDate: undefined })); }}
                      className={`w-full px-4 py-3 bg-ghost border-[3px] rounded-2xl text-navy text-sm transition-all ${formErrors.semester2EndDate ? "border-coral" : "border-navy"}`}
                    />
                    {formErrors.semester2EndDate && <p className="text-coral text-xs font-normal mt-0.5">{formErrors.semester2EndDate}</p>}
                  </div>
                </div>
              </div>

              {/* Auto-derived info */}
              {formData.semester1StartDate && formData.semester2EndDate && (
                <div className="bg-ghost border-[2px] border-navy/10 rounded-2xl p-4 space-y-1">
                  <p className="text-xs font-bold text-slate uppercase tracking-wider mb-2">Auto-Derived</p>
                  <p className="text-sm text-navy">
                    <span className="font-bold">Session:</span> {new Date(formData.semester1StartDate).toLocaleDateString()} – {new Date(formData.semester2EndDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-navy">
                    <span className="font-bold">Current Semester:</span> {(() => {
                      const now = new Date();
                      const sem2Start = new Date(formData.semester2StartDate);
                      return now < sem2Start ? "Semester 1" : "Semester 2";
                    })()}
                  </p>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`relative w-11 h-6 rounded-full transition-colors border-[2px] ${
                    formData.isActive ? "bg-navy border-lime" : "bg-cloud border-navy/20"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow transition-transform ${
                    formData.isActive ? "bg-lime left-5" : "bg-navy/30 left-0.5"
                  }`} />
                </div>
                <span className="text-sm text-navy font-medium">Set as active session (will deactivate others)</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
 className="flex-1 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-lime text-snow text-sm font-bold press-4 press-lime transition-all"
                >
                  Update Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={activateConfirm.isOpen}
        onClose={() => !activating && setActivateConfirm({ isOpen: false, id: "", name: "" })}
        onConfirm={async () => {
          await toggleActive(activateConfirm.id);
          setActivateConfirm({ isOpen: false, id: "", name: "" });
        }}
        title="Activate Session"
        message={`Set "${activateConfirm.name}" as the active session? This will deactivate the current active session.`}
        confirmLabel="Activate"
        variant="warning"
        isLoading={activating}
      />
    </div>
  );
}

export default withAuth(AdminSessionsPage, {
  anyPermission: ["session:create", "session:edit", "session:view"],
});
