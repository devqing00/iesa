"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listMentorApplications,
  reviewMentorApplication,
  createPair,
  listPairs,
  updatePairStatus,
  getPairFeedback,
  APPLICATION_STATUS_STYLES,
  PAIR_STATUS_STYLES,
  listUsers,
  getTimpSettings,
  updateTimpSettings,
} from "@/lib/api";
import type {
  MentorApplication,
  MentorshipPair,
  TimpFeedback,
  PairStatus,
  User,
} from "@/lib/api";
import { withAuth } from "@/lib/withAuth";
import Pagination from "@/components/ui/Pagination";

/* ─── Tabs ─────────────────────────────────────── */
type Tab = "applications" | "pairs";

/* ─── Constants ────────────────────────────────── */
const SUB_TABS = ["pending", "approved", "rejected"] as const;
const PAIR_TABS = ["active", "paused", "completed"] as const;

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`w-4 h-4 ${s <= rating ? "text-sunny" : "text-cloud"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
        </svg>
      ))}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────── */

function AdminTimpPage() {
  const [tab, setTab] = useState<Tab>("applications");

  /* ── Applications ── */
  const [applications, setApplications] = useState<MentorApplication[]>([]);
  const [appSubTab, setAppSubTab] = useState<string>("pending");
  const [loadingApps, setLoadingApps] = useState(true);

  const [reviewApp, setReviewApp] = useState<MentorApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  /* ── Pairs ── */
  const [pairs, setPairs] = useState<MentorshipPair[]>([]);
  const [pairSubTab, setPairSubTab] = useState<string>("active");
  const [loadingPairs, setLoadingPairs] = useState(true);

  const [feedbackPairId, setFeedbackPairId] = useState<string | null>(null);
  const [feedbackHistory, setFeedbackHistory] = useState<TimpFeedback[]>([]);

  /* ── Create Pair ── */
  const [showCreatePair, setShowCreatePair] = useState(false);
  const [approvedMentors, setApprovedMentors] = useState<MentorApplication[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [newPair, setNewPair] = useState({ mentorId: "", menteeId: "" });
  const [creatingPair, setCreatingPair] = useState(false);

  /* ── Pagination ── */
  const [appPage, setAppPage] = useState(1);
  const [pairPage, setPairPage] = useState(1);
  const TIMP_PAGE_SIZE = 10;

  // Reset page when sub-tab changes
  useEffect(() => { setAppPage(1); }, [appSubTab]);
  useEffect(() => { setPairPage(1); }, [pairSubTab]);

  /* ── Form Toggle ── */
  const [formOpen, setFormOpen] = useState(true);
  const [togglingForm, setTogglingForm] = useState(false);

  useEffect(() => {
    getTimpSettings()
      .then((s) => setFormOpen(s.formOpen))
      .catch(() => {});
  }, []);

  const handleToggleForm = async () => {
    setTogglingForm(true);
    try {
      const updated = await updateTimpSettings(!formOpen);
      setFormOpen(updated.formOpen);
    } catch {
      // handled by api client
    } finally {
      setTogglingForm(false);
    }
  };

  /* ── Fetch helpers ── */
  const fetchApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const data = await listMentorApplications({ status: appSubTab });
      setApplications(data);
    } catch {
      // handled by api client
    } finally {
      setLoadingApps(false);
    }
  }, [appSubTab]);

  const fetchPairs = useCallback(async () => {
    setLoadingPairs(true);
    try {
      const data = await listPairs({ status: pairSubTab });
      setPairs(data);
    } catch {
      // handled by api client
    } finally {
      setLoadingPairs(false);
    }
  }, [pairSubTab]);

  useEffect(() => {
    if (tab === "applications") fetchApps();
  }, [tab, fetchApps]);

  useEffect(() => {
    if (tab === "pairs") fetchPairs();
  }, [tab, fetchPairs]);

  /* ── Handlers ── */
  const handleReview = async () => {
    if (!reviewApp) return;
    setSubmittingReview(true);
    try {
      await reviewMentorApplication(reviewApp.id, {
        status: reviewAction,
        feedback: reviewFeedback || undefined,
      });
      setReviewApp(null);
      setReviewFeedback("");
      await fetchApps();
    } catch {
      // handled by api client
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCreatePair = async () => {
    if (!newPair.mentorId || !newPair.menteeId) return;
    setCreatingPair(true);
    try {
      await createPair(newPair);
      await fetchPairs();
      setShowCreatePair(false);
      setNewPair({ mentorId: "", menteeId: "" });
    } catch {
      // handled by api client
    } finally {
      setCreatingPair(false);
    }
  };

  const handleUpdatePairStatus = async (pairId: string, status: PairStatus) => {
    try {
      await updatePairStatus(pairId, status);
      await fetchPairs();
    } catch {
      // handled
    }
  };

  const loadFeedback = async (pairId: string) => {
    if (feedbackPairId === pairId) {
      setFeedbackPairId(null);
      return;
    }
    try {
      const fb = await getPairFeedback(pairId);
      setFeedbackHistory(fb);
      setFeedbackPairId(pairId);
    } catch {
      // handled
    }
  };

  const openCreatePair = async () => {
    setShowCreatePair(true);
    try {
      const [mentors, allStudents] = await Promise.all([
        listMentorApplications({ status: "approved" }),
        listUsers({ limit: 500 }),
      ]);
      setApprovedMentors(mentors);
      setStudents(allStudents);
    } catch {
      // handled
    }
  };

  /* ── Stats ── */
  const statCards = tab === "applications"
    ? [
        { label: "Pending", count: applications.filter((a) => a.status === "pending").length, bg: "bg-sunny-light" },
        { label: "Approved", count: applications.filter((a) => a.status === "approved").length, bg: "bg-teal-light" },
        { label: "Rejected", count: applications.filter((a) => a.status === "rejected").length, bg: "bg-coral-light" },
      ]
    : [
        { label: "Active", count: pairs.filter((p) => p.status === "active").length, bg: "bg-teal-light" },
        { label: "Paused", count: pairs.filter((p) => p.status === "paused").length, bg: "bg-sunny-light" },
        { label: "Completed", count: pairs.filter((p) => p.status === "completed").length, bg: "bg-lavender-light" },
      ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl md:text-3xl text-navy">
            TIMP <span className="brush-highlight">Management</span>
          </h1>
          <p className="text-sm text-navy/60 mt-1">The IESA Mentoring Project — manage mentors, pairs & feedback</p>
        </div>

        <div className="flex items-center gap-3 self-start">
          {/* Form Open / Close Toggle */}
          <button
            onClick={handleToggleForm}
            disabled={togglingForm}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-display font-bold text-sm border-4 press-3 press-black transition-all disabled:opacity-50 ${
              formOpen
                ? "bg-teal border-navy text-navy"
                : "bg-coral border-navy text-snow"
            }`}
          >
            {formOpen ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
              </svg>
            )}
            {togglingForm ? "Updating…" : formOpen ? "Form Open" : "Form Closed"}
          </button>

          {tab === "pairs" && (
            <button
              onClick={openCreatePair}
              className="bg-lime border-4 border-navy px-6 py-2.5 rounded-2xl font-display font-bold text-sm text-navy press-3 press-navy transition-all"
            >
              + Create Pair
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["applications", "pairs"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-display font-bold text-sm border-[3px] transition-all ${
              tab === t
                ? "bg-navy border-navy text-snow"
                : "bg-ghost border-cloud text-navy hover:border-navy"
            }`}
          >
            {t === "applications" ? "Mentor Applications" : "Mentorship Pairs"}
          </button>
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center border-2 border-cloud`}>
            <p className="text-2xl font-display font-black text-navy">{s.count}</p>
            <p className="text-xs font-bold text-navy/60 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ─────────────── APPLICATIONS TAB ─────────────── */}
      {tab === "applications" && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-2">
            {SUB_TABS.map((st) => (
              <button
                key={st}
                onClick={() => setAppSubTab(st)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                  appSubTab === st
                    ? "bg-navy text-snow"
                    : "bg-cloud text-navy hover:bg-Navy/10"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {loadingApps ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-[3px] border-teal border-t-transparent rounded-full animate-spin" />
            </div>
          ) : applications.length === 0 ? (
            <div className="bg-snow border-4 border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
              <p className="text-sm text-navy/60">No {appSubTab} applications</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.slice((appPage - 1) * TIMP_PAGE_SIZE, appPage * TIMP_PAGE_SIZE).map((app) => {
                const style = APPLICATION_STATUS_STYLES[app.status];
                return (
                  <div
                    key={app.id}
                    className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-black text-lg text-navy">{app.userName}</h3>
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                          {app.userLevel && (
                            <span className="px-2 py-0.5 rounded-md bg-ghost border border-cloud text-[10px] font-bold text-navy/60">
                              Level {app.userLevel}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Motivation</p>
                            <p className="text-navy/70 line-clamp-3">{app.motivation}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Skills</p>
                            <p className="text-navy/70">{app.skills}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Availability</p>
                            <p className="text-navy/70">{app.availability}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate">
                          <span>Max mentees: {app.maxMentees}</span>
                          <span>·</span>
                          <span>{formatDate(app.createdAt)}</span>
                        </div>

                        {app.feedback && (
                          <p className="text-sm text-navy/50 bg-ghost p-3 rounded-xl border-2 border-cloud italic mt-2">
                            {app.feedback}
                          </p>
                        )}
                      </div>

                      {app.status === "pending" && (
                        <div className="flex gap-2 self-start">
                          <button
                            onClick={() => {
                              setReviewApp(app);
                              setReviewAction("approved");
                              setReviewFeedback("");
                            }}
                            className="bg-teal border-[3px] border-navy px-4 py-2 rounded-xl text-snow text-xs font-bold hover:ring-2 hover:ring-teal/30 transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setReviewApp(app);
                              setReviewAction("rejected");
                              setReviewFeedback("");
                            }}
                            className="bg-coral border-[3px] border-navy px-4 py-2 rounded-xl text-snow text-xs font-bold hover:ring-2 hover:ring-coral/30 transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Pagination page={appPage} totalPages={Math.ceil(applications.length / TIMP_PAGE_SIZE)} onPage={setAppPage} className="mt-4" />
        </>
      )}

      {/* ─────────────── PAIRS TAB ─────────────── */}
      {tab === "pairs" && (
        <>
          <div className="flex gap-2">
            {PAIR_TABS.map((st) => (
              <button
                key={st}
                onClick={() => setPairSubTab(st)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                  pairSubTab === st
                    ? "bg-navy text-snow"
                    : "bg-cloud text-navy hover:bg-navy/10"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {loadingPairs ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-[3px] border-teal border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pairs.length === 0 ? (
            <div className="bg-snow border-4 border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
              <p className="text-sm text-navy/60">No {pairSubTab} pairs</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pairs.slice((pairPage - 1) * TIMP_PAGE_SIZE, pairPage * TIMP_PAGE_SIZE).map((pair) => {
                const style = PAIR_STATUS_STYLES[pair.status];
                return (
                  <div key={pair.id} className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                          <span className="text-xs text-slate">{pair.feedbackCount} feedback entries</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-[10px] font-bold text-slate uppercase">Mentor</p>
                            <p className="font-display font-bold text-navy">{pair.mentorName}</p>
                          </div>
                          <svg className="w-5 h-5 text-navy/30" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M13.22 19.03a.75.75 0 0 1 0-1.06L18.19 13H3.75a.75.75 0 0 1 0-1.5h14.44l-4.97-4.97a.75.75 0 0 1 1.06-1.06l6.25 6.25a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 0 1-1.06 0Z" />
                          </svg>
                          <div>
                            <p className="text-[10px] font-bold text-slate uppercase">Mentee</p>
                            <p className="font-display font-bold text-navy">{pair.menteeName}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate mt-1">Paired since {formatDate(pair.createdAt)}</p>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => loadFeedback(pair.id)}
                          className="bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 text-xs font-bold text-navy hover:bg-cloud transition-all"
                        >
                          {feedbackPairId === pair.id ? "Hide" : "View"} Feedback
                        </button>
                        {pair.status === "active" && (
                          <>
                            <button
                              onClick={() => handleUpdatePairStatus(pair.id, "paused")}
                              className="bg-sunny-light border-[3px] border-navy rounded-xl px-4 py-2 text-xs font-bold text-navy hover:ring-2 hover:ring-sunny/30 transition-all"
                            >
                              Pause
                            </button>
                            <button
                              onClick={() => handleUpdatePairStatus(pair.id, "completed")}
                              className="bg-lavender-light border-[3px] border-navy rounded-xl px-4 py-2 text-xs font-bold text-navy hover:ring-2 hover:ring-lavender/30 transition-all"
                            >
                              Complete
                            </button>
                          </>
                        )}
                        {pair.status === "paused" && (
                          <button
                            onClick={() => handleUpdatePairStatus(pair.id, "active")}
                            className="bg-teal-light border-[3px] border-navy rounded-xl px-4 py-2 text-xs font-bold text-navy hover:ring-2 hover:ring-teal/30 transition-all"
                          >
                            Resume
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Feedback history */}
                    {feedbackPairId === pair.id && (
                      <div className="mt-4 pt-4 border-t-[3px] border-cloud space-y-3">
                        {feedbackHistory.length === 0 ? (
                          <p className="text-sm text-slate">No feedback submitted yet.</p>
                        ) : (
                          feedbackHistory.map((fb) => (
                            <div key={fb.id} className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-navy">Week {fb.weekNumber}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    fb.submitterRole === "mentor"
                                      ? "bg-teal-light text-teal"
                                      : "bg-lavender-light text-lavender"
                                  }`}>
                                    {fb.submitterName} ({fb.submitterRole})
                                  </span>
                                  <span className="text-[10px] text-slate">{formatDate(fb.createdAt)}</span>
                                </div>
                                <Stars rating={fb.rating} />
                              </div>
                              <p className="text-sm text-navy/70">{fb.notes}</p>
                              {fb.concerns && (
                                <p className="text-xs text-coral mt-2 italic">Concern: {fb.concerns}</p>
                              )}
                              {fb.topicsCovered && fb.topicsCovered.length > 0 && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                  {fb.topicsCovered.map((t, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded-md bg-lime-light text-navy text-[10px] font-bold">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Pagination page={pairPage} totalPages={Math.ceil(pairs.length / TIMP_PAGE_SIZE)} onPage={setPairPage} className="mt-4" />
        </>
      )}

      {/* ─── Review Modal ─── */}
      {reviewApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setReviewApp(null)} />
          <div className="relative bg-snow border-4 border-navy rounded-3xl p-8 w-full max-w-lg shadow-[6px_6px_0_0_#000]">
            <div
              className={`-mx-8 -mt-8 px-8 py-5 rounded-t-3xl border-b-4 border-navy ${
                reviewAction === "approved" ? "bg-teal" : "bg-coral"
              }`}
            >
              <h3 className="font-display font-black text-xl text-snow">
                {reviewAction === "approved" ? "Approve" : "Reject"} Mentor
              </h3>
              <p className="text-snow/70 text-sm mt-1">{reviewApp.userName}</p>
            </div>

            <div className="mt-6 space-y-4">
              {/* Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewAction("approved")}
                  className={`flex-1 py-2 rounded-xl border-[3px] text-sm font-bold transition-all ${
                    reviewAction === "approved"
                      ? "bg-teal border-navy text-snow"
                      : "bg-ghost border-cloud text-navy hover:border-navy"
                  }`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setReviewAction("rejected")}
                  className={`flex-1 py-2 rounded-xl border-[3px] text-sm font-bold transition-all ${
                    reviewAction === "rejected"
                      ? "bg-coral border-navy text-snow"
                      : "bg-ghost border-cloud text-navy hover:border-navy"
                  }`}
                >
                  Reject
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-navy">Feedback (optional)</label>
                <textarea
                  rows={3}
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="Add feedback for the applicant..."
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setReviewApp(null)}
                  className="flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReview}
                  disabled={submittingReview}
                  className={`flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-snow text-sm font-bold transition-all disabled:opacity-50 ${
                    reviewAction === "approved" ? "bg-teal" : "bg-coral"
                  }`}
                >
                  {submittingReview ? "Processing…" : `Confirm ${reviewAction === "approved" ? "Approve" : "Reject"}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Pair Modal ─── */}
      {showCreatePair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setShowCreatePair(false)} />
          <div className="relative bg-snow border-4 border-navy rounded-3xl p-8 w-full max-w-lg shadow-[6px_6px_0_0_#000]">
            <div className="-mx-8 -mt-8 px-8 py-5 rounded-t-3xl border-b-4 border-navy bg-teal">
              <h3 className="font-display font-black text-xl text-snow">Create Mentorship Pair</h3>
              <p className="text-snow/70 text-sm mt-1">Match an approved mentor with a student</p>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-navy">Mentor</label>
                <select
                  value={newPair.mentorId}
                  onChange={(e) => setNewPair({ ...newPair, mentorId: e.target.value })}
                  title="Select a mentor"
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
                >
                  <option value="">Select approved mentor…</option>
                  {approvedMentors.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.userName} (max {m.maxMentees} mentees)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-navy">Mentee</label>
                <select
                  value={newPair.menteeId}
                  onChange={(e) => setNewPair({ ...newPair, menteeId: e.target.value })}
                  title="Select a mentee"
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
                >
                  <option value="">Select student…</option>
                  {students
                    .filter((s) => s.id !== newPair.mentorId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {`${s.firstName} ${s.lastName}`.trim() || s.email}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreatePair(false)}
                  className="flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePair}
                  disabled={creatingPair || !newPair.mentorId || !newPair.menteeId}
                  className="flex-1 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-navy text-snow text-sm font-bold transition-all disabled:opacity-50"
                >
                  {creatingPair ? "Creating…" : "Create Pair"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(AdminTimpPage, {
  anyPermission: ["timp:manage"],
});
