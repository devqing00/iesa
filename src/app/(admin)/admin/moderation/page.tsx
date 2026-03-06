"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { withAuth } from "@/lib/withAuth";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/Modal";

/* ─── Types ──────────────────────────────── */

interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reportedUserId: string;
  reportedUserName: string;
  reportedUserEmail: string;
  reason: string;
  messageIds: string[];
  status: "pending" | "reviewed" | "dismissed";
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface MutedUser {
  userId: string;
  userName: string;
  userEmail: string;
  reason: string;
  mutedAt: string;
  mutedUntil: string;
}

type Tab = "reports" | "muted";

/* ─── Component ──────────────────────────── */

function ModerationPage() {
  const { getAccessToken } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
  const [loading, setLoading] = useState(true);

  /* Modal state */
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    report: Report | null;
  }>({ open: false, report: null });
  const [reviewAction, setReviewAction] = useState<"mute" | "dismiss">("mute");
  const [muteDays, setMuteDays] = useState(7);
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [unmuteModal, setUnmuteModal] = useState<{
    open: boolean;
    userId: string;
    name: string;
  }>({ open: false, userId: "", name: "" });

  /* ── API helper ── */
  const apiFetch = useCallback(
    async (path: string, opts?: RequestInit) => {
      const token = await getAccessToken();
      return fetch(getApiUrl(path), {
        ...opts,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(opts?.headers || {}),
        },
      });
    },
    [getAccessToken]
  );

  /* ── Fetch data ── */
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/admin/messages/reports");
      if (res.ok) setReports(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const fetchMutedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/admin/messages/muted-users");
      if (res.ok) setMutedUsers(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (tab === "reports") fetchReports();
    else fetchMutedUsers();
  }, [tab, fetchReports, fetchMutedUsers]);

  /* ── Review report ── */
  const handleReview = async () => {
    if (!reviewModal.report) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(
        `/api/v1/admin/messages/reports/${reviewModal.report.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            action: reviewAction,
            muteDays: reviewAction === "mute" ? muteDays : undefined,
            adminNote: adminNote.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed");
      }
      toast.success(
        reviewAction === "mute"
          ? `User muted for ${muteDays} days`
          : "Report dismissed"
      );
      setReviewModal({ open: false, report: null });
      setAdminNote("");
      setMuteDays(7);
      fetchReports();
      fetchMutedUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Unmute user ── */
  const handleUnmute = async () => {
    if (!unmuteModal.userId) return;
    try {
      const res = await apiFetch(
        `/api/v1/admin/messages/muted-users/${unmuteModal.userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      toast.success(`${unmuteModal.name} has been unmuted`);
      setUnmuteModal({ open: false, userId: "", name: "" });
      fetchMutedUsers();
    } catch {
      toast.error("Failed to unmute user");
    }
  };

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  /* ═══ Render ═══ */
  return (
    <main id="main-content" className="min-h-screen bg-ghost">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display font-black text-display-md text-navy">
            Chat Moderation
          </h1>
          <p className="text-slate text-sm mt-1">
            Review reports and manage muted students
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("reports")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
              tab === "reports"
                ? "bg-lime border-navy text-navy press-3 press-navy"
                : "bg-snow border-cloud text-slate hover:border-navy hover:text-navy"
            }`}
          >
            Reports
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-coral text-snow text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("muted")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
              tab === "muted"
                ? "bg-lime border-navy text-navy press-3 press-navy"
                : "bg-snow border-cloud text-slate hover:border-navy hover:text-navy"
            }`}
          >
            Muted Users
            {mutedUsers.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-sunny text-navy text-[10px] font-bold">
                {mutedUsers.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-lime border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === "reports" ? (
          /* ═══ Reports ═══ */
          reports.length === 0 ? (
            <div className="bg-snow border-[3px] border-navy rounded-2xl shadow-[6px_6px_0_0_#000] p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-teal-light flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-teal" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="font-bold text-navy">No reports to review</p>
              <p className="text-slate text-sm mt-1">All clear!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={`bg-snow border-[3px] rounded-2xl p-5 ${
                    report.status === "pending"
                      ? "border-coral shadow-[6px_6px_0_0_#000]"
                      : "border-cloud"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Status badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg ${
                            report.status === "pending"
                              ? "bg-coral-light text-coral"
                              : report.status === "reviewed"
                                ? "bg-teal-light text-teal"
                                : "bg-cloud text-slate"
                          }`}
                        >
                          {report.status}
                        </span>
                        <span className="text-[10px] text-slate">
                          {new Date(report.createdAt).toLocaleDateString("en-NG", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Reporter → Reported */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-bold text-navy">
                          {report.reporterName}
                        </span>
                        <svg className="w-3.5 h-3.5 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                        <span className="text-xs font-bold text-coral">
                          {report.reportedUserName}
                        </span>
                        <span className="text-[10px] text-slate">
                          ({report.reportedUserEmail})
                        </span>
                      </div>

                      {/* Reason */}
                      <p className="text-sm text-navy bg-ghost rounded-xl px-3 py-2">
                        {report.reason}
                      </p>

                      {report.adminNote && (
                        <p className="mt-2 text-xs text-slate italic">
                          Admin note: {report.adminNote}
                        </p>
                      )}
                    </div>

                    {/* Action button */}
                    {report.status === "pending" && (
                      <button
                        onClick={() => {
                          setReviewModal({ open: true, report });
                          setReviewAction("mute");
                          setAdminNote("");
                          setMuteDays(7);
                        }}
                        className="text-xs font-bold bg-lime text-navy px-4 py-2 rounded-xl border-2 border-navy press-3 press-navy shrink-0"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ═══ Muted Users ═══ */
          mutedUsers.length === 0 ? (
            <div className="bg-snow border-[3px] border-navy rounded-2xl shadow-[6px_6px_0_0_#000] p-12 text-center">
              <p className="font-bold text-navy">No muted users</p>
              <p className="text-slate text-sm mt-1">Nobody is currently muted</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mutedUsers.map((user) => (
                <div
                  key={user.userId}
                  className="bg-snow border-[3px] border-navy rounded-2xl shadow-[4px_4px_0_0_#000] p-5 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-coral-light border-2 border-navy flex items-center justify-center shrink-0">
                    <span className="font-display font-black text-xs text-navy">
                      {user.userName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-navy">{user.userName}</div>
                    <div className="text-xs text-slate">{user.userEmail}</div>
                    <div className="text-[10px] text-navy-muted mt-0.5">
                      Muted until{" "}
                      {new Date(user.mutedUntil).toLocaleDateString("en-NG", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {user.reason && ` — ${user.reason}`}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setUnmuteModal({
                        open: true,
                        userId: user.userId,
                        name: user.userName,
                      })
                    }
                    className="text-xs font-bold bg-teal text-navy px-4 py-2 rounded-xl border-2 border-navy press-3 press-navy shrink-0"
                  >
                    Unmute
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ═══ Review Modal ═══ */}
      {reviewModal.open && reviewModal.report && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm px-4"
          onClick={() => !submitting && setReviewModal({ open: false, report: null })}
        >
          <div
            className="bg-snow border-[3px] border-navy rounded-2xl shadow-[8px_8px_0_0_#000] w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-black text-lg text-navy mb-1">
              Review Report
            </h3>
            <p className="text-slate text-sm mb-4">
              Report against{" "}
              <span className="font-bold text-coral">
                {reviewModal.report.reportedUserName}
              </span>{" "}
              by {reviewModal.report.reporterName}
            </p>

            {/* Reason */}
            <div className="bg-ghost rounded-xl px-3 py-2 mb-4">
              <p className="text-label text-slate mb-1">Reason</p>
              <p className="text-sm text-navy">{reviewModal.report.reason}</p>
            </div>

            {/* Action selection */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setReviewAction("mute")}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${
                  reviewAction === "mute"
                    ? "bg-coral text-snow border-navy"
                    : "bg-ghost text-navy border-cloud"
                }`}
              >
                Mute User
              </button>
              <button
                onClick={() => setReviewAction("dismiss")}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${
                  reviewAction === "dismiss"
                    ? "bg-teal text-navy border-navy"
                    : "bg-ghost text-navy border-cloud"
                }`}
              >
                Dismiss
              </button>
            </div>

            {/* Mute duration */}
            {reviewAction === "mute" && (
              <div className="mb-4">
                <label className="text-label text-slate mb-1 block">
                  Mute duration (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={muteDays}
                  onChange={(e) => setMuteDays(Number(e.target.value))}
                  placeholder="7"
                  title="Mute duration in days"
                  className="w-full px-3 py-2 bg-ghost border-2 border-cloud rounded-xl text-sm text-navy focus:border-navy focus:outline-none"
                />
              </div>
            )}

            {/* Admin note */}
            <div className="mb-4">
              <label className="text-label text-slate mb-1 block">
                Admin note (optional)
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Internal note about this action..."
                rows={2}
                className="w-full px-3 py-2 bg-ghost border-2 border-cloud rounded-xl text-sm text-navy placeholder:text-slate focus:border-navy focus:outline-none resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReviewModal({ open: false, report: null })}
                disabled={submitting}
                className="px-4 py-2 text-sm font-bold text-navy bg-ghost rounded-xl border-2 border-cloud hover:border-navy transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReview}
                disabled={submitting}
                className={`px-4 py-2 text-sm font-bold rounded-xl border-2 border-navy press-3 press-navy disabled:opacity-50 transition-all ${
                  reviewAction === "mute"
                    ? "bg-coral text-snow"
                    : "bg-teal text-navy"
                }`}
              >
                {submitting
                  ? "Processing..."
                  : reviewAction === "mute"
                    ? `Mute for ${muteDays} days`
                    : "Dismiss Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Unmute Confirm ═══ */}
      <ConfirmModal
        isOpen={unmuteModal.open}
        onClose={() => setUnmuteModal({ open: false, userId: "", name: "" })}
        onConfirm={handleUnmute}
        title="Unmute User"
        message={`Are you sure you want to unmute ${unmuteModal.name}? They will be able to send messages again.`}
        confirmLabel="Unmute"
        variant="default"
      />
    </main>
  );
}

export default withAuth(ModerationPage, { requiredPermissions: ["message:moderate"] });
