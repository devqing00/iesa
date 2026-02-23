"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listApplications,
  reviewApplication,
  UNIT_LABELS,
  UNIT_COLORS,
} from "@/lib/api";
import type { UnitApplication, UnitType } from "@/lib/api";
import { withAuth } from "@/lib/withAuth";
import Pagination from "@/components/ui/Pagination";

/* ─── Constants ─────────────────────────────────── */

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-sunny-light", text: "text-navy", label: "Pending" },
  accepted: { bg: "bg-teal", text: "text-snow", label: "Accepted" },
  rejected: { bg: "bg-coral", text: "text-snow", label: "Rejected" },
};

const ALL_UNITS: UnitType[] = ["press", "committee_academic", "committee_welfare", "committee_sports", "committee_socials"];

/* ─── Page Component ───────────────────────────── */

function AdminApplicationsPage() {
  const [applications, setApplications] = useState<UnitApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("pending");

  // Review modal state
  const [reviewingApp, setReviewingApp] = useState<UnitApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<"accepted" | "rejected">("accepted");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [appPage, setAppPage] = useState(1);
  const APP_PAGE_SIZE = 10;

  /* ── Fetch ─────────────────────────────── */
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterUnit) params.unit = filterUnit;
      if (filterStatus) params.status = filterStatus;
      const data = await listApplications(params);
      setApplications(data);
    } catch {
      // toast handled by api client
    } finally {
      setLoading(false);
    }
  }, [filterUnit, filterStatus]);

  // Reset page when filters change
  useEffect(() => { setAppPage(1); }, [filterUnit, filterStatus]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  /* ── Review ────────────────────────────── */
  const handleReview = async () => {
    if (!reviewingApp) return;
    setSubmitting(true);
    try {
      await reviewApplication(reviewingApp.id, {
        status: reviewAction,
        feedback: reviewFeedback.trim() || undefined,
      });
      setReviewingApp(null);
      setReviewFeedback("");
      fetchApplications();
    } catch {
      // toast handled by api client
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Stats ─────────────────────────────── */
  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const acceptedCount = applications.filter((a) => a.status === "accepted").length;
  const rejectedCount = applications.filter((a) => a.status === "rejected").length;

  /* ── Render ────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-block px-3 py-1 text-label bg-lavender text-snow rounded-full">
              Review
            </span>
          </div>
          <h1 className="font-display font-black text-display-lg text-navy">
            Unit Applications
          </h1>
          <p className="text-slate mt-1">Review and manage student applications to units and committees.</p>
        </div>
      </div>

      {/* ─── Stats Row ─────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-sunny-light border-[3px] border-navy rounded-3xl p-4 shadow-[5px_5px_0_0_#000]">
          <p className="text-label text-navy mb-1">Pending</p>
          <p className="font-display font-black text-2xl text-navy">{pendingCount}</p>
        </div>
        <div className="bg-teal-light border-[3px] border-navy rounded-3xl p-4 shadow-[5px_5px_0_0_#000]">
          <p className="text-label text-navy mb-1">Accepted</p>
          <p className="font-display font-black text-2xl text-navy">{acceptedCount}</p>
        </div>
        <div className="bg-coral-light border-[3px] border-navy rounded-3xl p-4 shadow-[5px_5px_0_0_#000]">
          <p className="text-label text-navy mb-1">Rejected</p>
          <p className="font-display font-black text-2xl text-navy">{rejectedCount}</p>
        </div>
      </div>

      {/* ─── Filters ───────────────────── */}
      <div className="bg-snow border-[3px] border-navy rounded-3xl p-4 shadow-[5px_5px_0_0_#000] flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-label text-navy mb-1">Unit</label>
          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            title="Filter by unit"
            className="w-full border-[3px] border-navy rounded-xl px-3 py-2 text-sm text-navy font-medium focus:outline-none focus:ring-2 focus:ring-lime"
          >
            <option value="">All Units</option>
            {ALL_UNITS.map((u) => (
              <option key={u} value={u}>{UNIT_LABELS[u]}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-label text-navy mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            title="Filter by status"
            className="w-full border-[3px] border-navy rounded-xl px-3 py-2 text-sm text-navy font-medium focus:outline-none focus:ring-2 focus:ring-lime"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* ─── Applications List ─────────── */}
      {loading ? (
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-12 shadow-[6px_6px_0_0_#000] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-navy border-t-lime rounded-full animate-spin" />
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-8 shadow-[6px_6px_0_0_#000] text-center">
          <p className="text-slate font-medium">No applications found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.slice((appPage - 1) * APP_PAGE_SIZE, appPage * APP_PAGE_SIZE).map((app) => {
            const colors = UNIT_COLORS[app.unit as UnitType];
            const statusStyle = STATUS_STYLES[app.status];

            return (
              <div
                key={app.id}
                className="bg-snow border-[3px] border-navy rounded-3xl shadow-[5px_5px_0_0_#000] overflow-hidden"
              >
                {/* Card header with unit color */}
                <div className={`${colors.bg} border-b-[3px] border-navy px-5 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <span className={`${colors.badge} text-navy text-label px-3 py-1 rounded-full border-[2px] border-navy`}>
                      {app.unitLabel}
                    </span>
                    <span className={`${statusStyle.bg} ${statusStyle.text} text-label px-3 py-1 rounded-full border-[2px] border-navy`}>
                      {statusStyle.label}
                    </span>
                  </div>
                  <span className="text-xs text-navy-muted font-medium">
                    {new Date(app.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Applicant info */}
                    <div className="flex-1">
                      <h3 className="font-display font-bold text-navy text-lg">{app.userName}</h3>
                      <p className="text-sm text-slate">{app.userEmail}</p>
                      {app.userLevel && (
                        <span className="inline-block mt-1 text-label bg-cloud text-navy px-2 py-0.5 rounded-full">
                          Level {app.userLevel * 100}
                        </span>
                      )}

                      {/* Motivation */}
                      <div className="mt-4">
                        <p className="text-label text-navy mb-1">Motivation</p>
                        <p className="text-sm text-navy-muted leading-relaxed">{app.motivation}</p>
                      </div>

                      {/* Skills */}
                      {app.skills && (
                        <div className="mt-3">
                          <p className="text-label text-navy mb-1">Skills</p>
                          <p className="text-sm text-navy-muted">{app.skills}</p>
                        </div>
                      )}

                      {/* Feedback (if reviewed) */}
                      {app.feedback && (
                        <div className="mt-3 p-3 bg-ghost rounded-xl border-[2px] border-cloud">
                          <p className="text-label text-navy mb-1">Feedback</p>
                          <p className="text-sm text-navy-muted italic">&ldquo;{app.feedback}&rdquo;</p>
                          {app.reviewerName && (
                            <p className="text-xs text-slate mt-1">— {app.reviewerName}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons (only for pending) */}
                    {app.status === "pending" && (
                      <div className="flex sm:flex-col gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setReviewingApp(app);
                            setReviewAction("accepted");
                            setReviewFeedback("");
                          }}
                          className="bg-teal border-[3px] border-navy px-4 py-2 rounded-xl font-display font-bold text-sm text-snow
                            hover:scale-105 transition-all flex-1 sm:flex-none"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => {
                            setReviewingApp(app);
                            setReviewAction("rejected");
                            setReviewFeedback("");
                          }}
                          className="bg-coral border-[3px] border-navy px-4 py-2 rounded-xl font-display font-bold text-sm text-snow
                            hover:scale-105 transition-all flex-1 sm:flex-none"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={appPage} totalPages={Math.ceil(applications.length / APP_PAGE_SIZE)} onPage={setAppPage} className="mt-4" />

      {/* ─── Review Modal ──────────────── */}
      {reviewingApp && (
        <div className="fixed inset-0 bg-navy/60 z-50 flex items-center justify-center p-4" onClick={() => setReviewingApp(null)}>
          <div
            className="bg-snow border-[3px] border-navy rounded-3xl shadow-[10px_10px_0_0_#000] w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`${reviewAction === "accepted" ? "bg-teal-light" : "bg-coral-light"} border-b-[4px] border-navy rounded-t-[20px] p-5`}>
              <h3 className="font-display font-black text-lg text-navy">
                {reviewAction === "accepted" ? "Accept" : "Reject"} Application
              </h3>
              <p className="text-sm text-navy-muted mt-1">
                {reviewingApp.userName} — {reviewingApp.unitLabel}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-5">
              {/* Action toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setReviewAction("accepted")}
                  className={`flex-1 py-2 rounded-xl font-display font-bold text-sm border-[3px] transition-all ${
                    reviewAction === "accepted"
                      ? "bg-teal border-navy text-snow"
                      : "bg-snow border-cloud text-slate"
                  }`}
                >
                  Accept
                </button>
                <button
                  onClick={() => setReviewAction("rejected")}
                  className={`flex-1 py-2 rounded-xl font-display font-bold text-sm border-[3px] transition-all ${
                    reviewAction === "rejected"
                      ? "bg-coral border-navy text-snow"
                      : "bg-snow border-cloud text-slate"
                  }`}
                >
                  Reject
                </button>
              </div>

              {/* Feedback */}
              <label className="block font-display font-bold text-sm text-navy mb-2">
                Feedback <span className="text-slate font-normal">(optional)</span>
              </label>
              <textarea
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                placeholder={
                  reviewAction === "accepted"
                    ? "Welcome message or next steps..."
                    : "Reason for rejection or encouragement to reapply..."
                }
                rows={3}
                maxLength={500}
                className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 text-sm text-navy placeholder:text-slate
                  focus:outline-none focus:ring-2 focus:ring-lime resize-none"
              />
            </div>

            {/* Modal Footer */}
            <div className="border-t-[3px] border-cloud px-5 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setReviewingApp(null)}
                className="bg-transparent border-[3px] border-navy px-5 py-2 rounded-xl font-display font-bold text-sm text-navy
                  hover:bg-navy hover:text-snow transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReview}
                disabled={submitting}
                className={`${reviewAction === "accepted" ? "bg-teal" : "bg-coral"} border-[3px] border-navy 
                  px-6 py-2 rounded-xl font-display font-bold text-sm text-snow
                  press-3 press-navy
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-snow border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  `Confirm ${reviewAction === "accepted" ? "Accept" : "Reject"}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(AdminApplicationsPage, {
  anyPermission: ["role:create", "role:edit", "user:edit"],
});
