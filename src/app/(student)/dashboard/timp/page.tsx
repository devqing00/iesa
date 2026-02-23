"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { toast } from "sonner";
import {
  getMyTimpInfo,
  applyAsMentor,
  submitTimpFeedback,
  getPairFeedback,
  APPLICATION_STATUS_STYLES,
  PAIR_STATUS_STYLES,
} from "@/lib/api";
import type {
  MyTimpInfo,
  MentorshipPair,
  TimpFeedback,
} from "@/lib/api";

/* ─── Helpers ────────────────────────────── */

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

/* ─── Component ──────────────────────────── */

export default function TimpPage() {
  const { user } = useAuth();
  const [info, setInfo] = useState<MyTimpInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Application form
  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({
    motivation: "",
    skills: "",
    availability: "",
    maxMentees: 2,
  });
  const [submitting, setSubmitting] = useState(false);

  // Feedback
  const [feedbackPair, setFeedbackPair] = useState<MentorshipPair | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    rating: 4,
    notes: "",
    concerns: "",
    topicsCovered: "",
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Feedback history
  const [viewFeedback, setViewFeedback] = useState<string | null>(null);
  const [feedbackHistory, setFeedbackHistory] = useState<TimpFeedback[]>([]);

  useEffect(() => {
    if (user) fetchInfo();
  }, [user]);

  const fetchInfo = async () => {
    try {
      const data = await getMyTimpInfo();
      setInfo(data);
    } catch {
      // first load, might 404 — that's fine
      setInfo({ application: null, pairs: [], isMentor: false, isMentee: false, formOpen: false, userLevel: null });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await applyAsMentor(applyForm);
      toast.success("Mentor application submitted!");
      setShowApply(false);
      await fetchInfo();
    } catch {
      toast.error("Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackPair) return;
    setSubmittingFeedback(true);
    try {
      await submitTimpFeedback(feedbackPair.id, {
        rating: feedbackForm.rating,
        notes: feedbackForm.notes,
        concerns: feedbackForm.concerns || undefined,
        topicsCovered: feedbackForm.topicsCovered
          ? feedbackForm.topicsCovered.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
      });
      toast.success("Feedback submitted!");
      setFeedbackPair(null);
      setFeedbackForm({ rating: 4, notes: "", concerns: "", topicsCovered: "" });
      await fetchInfo();
    } catch {
      toast.error("Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const loadFeedbackHistory = async (pairId: string) => {
    if (viewFeedback === pairId) {
      setViewFeedback(null);
      return;
    }
    try {
      const fb = await getPairFeedback(pairId);
      setFeedbackHistory(fb);
      setViewFeedback(pairId);
    } catch {
      toast.error("Failed to load feedback history");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader title="TIMP" />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-[3px] border-teal border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate uppercase tracking-wider">Loading TIMP…</p>
          </div>
        </div>
      </div>
    );
  }

  const hasApplication = info?.application != null;
  const isApproved = info?.application?.status === "approved";
  const formOpen = info?.formOpen ?? true;
  const userLevel = info?.userLevel ?? null;
  const is100L = userLevel !== null && userLevel < 200;

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="TIMP" />

      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8 space-y-8">
        {/* ── Hero ── */}
        <div className="bg-teal border-4 border-navy rounded-3xl p-8 shadow-[6px_6px_0_0_#000] relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 w-36 h-36 rounded-full bg-navy/10 pointer-events-none" />
          <svg className="absolute top-5 right-8 w-5 h-5 text-snow/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-snow/60 mb-2">Mentoring Program</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-snow leading-tight">
            <span className="brush-highlight brush-navy">TIMP</span>
          </h1>
          <p className="text-snow/70 text-sm mt-3 max-w-lg">
            The IESA Mentoring Project pairs experienced students with newcomers for academic guidance, career advice, and personal growth.
          </p>
        </div>

        {/* ── Application Status ── */}
        {hasApplication && (
          <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
            <h2 className="font-display font-black text-lg text-navy mb-4">Your Mentor Application</h2>
            <div className="flex items-center gap-3 mb-3">
              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${APPLICATION_STATUS_STYLES[info!.application!.status].bg} ${APPLICATION_STATUS_STYLES[info!.application!.status].text}`}>
                {APPLICATION_STATUS_STYLES[info!.application!.status].label}
              </span>
              <span className="text-xs text-slate">{formatDate(info!.application!.createdAt)}</span>
            </div>
            {info!.application!.feedback && (
              <p className="text-sm text-navy/60 italic bg-ghost rounded-xl p-3 border-2 border-cloud">
                {info!.application!.feedback}
              </p>
            )}
          </div>
        )}

        {/* ── Apply as Mentor ── */}
        {!hasApplication && (
          <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
            {is100L ? (
              /* 100L students — can only be mentees */
              <div className="text-center space-y-3 py-4">
                <div className="w-14 h-14 bg-lavender-light rounded-2xl flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A18.034 18.034 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="font-display font-black text-lg text-navy">You&apos;ll be Matched with a Mentor</h2>
                <p className="text-sm text-navy/60 max-w-md mx-auto">
                  As a 100-level student, you&apos;ll be paired with an experienced mentor by the TIMP lead.
                  Sit tight — your mentor will be assigned to you soon!
                </p>
              </div>
            ) : !formOpen ? (
              /* Form is closed */
              <div className="text-center space-y-3 py-4">
                <div className="w-14 h-14 bg-coral-light rounded-2xl flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-coral" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="font-display font-black text-lg text-navy">Applications Closed</h2>
                <p className="text-sm text-navy/60 max-w-md mx-auto">
                  TIMP mentor applications are currently closed. Check back later or wait to be paired as a mentee.
                </p>
              </div>
            ) : (
              /* Can apply */
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-display font-black text-lg text-navy">Become a Mentor</h2>
                    <p className="text-sm text-navy/60">Share your experience and guide junior students</p>
                  </div>
                  {!showApply && (
                    <button
                      onClick={() => setShowApply(true)}
                      className="bg-lime border-4 border-navy press-3 press-navy px-6 py-2.5 rounded-2xl font-display font-bold text-sm text-navy transition-all"
                    >
                      Apply Now
                    </button>
                  )}
                </div>

                {showApply && (
                  <form onSubmit={handleApply} className="space-y-4 mt-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-navy">Why do you want to be a mentor?</label>
                      <textarea
                        required
                        minLength={20}
                        maxLength={1000}
                        rows={4}
                        value={applyForm.motivation}
                        onChange={(e) => setApplyForm({ ...applyForm, motivation: e.target.value })}
                        placeholder="Share your motivation for joining TIMP as a mentor..."
                        className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-navy">Skills & Expertise</label>
                        <input
                          required
                          value={applyForm.skills}
                          onChange={(e) => setApplyForm({ ...applyForm, skills: e.target.value })}
                          placeholder="e.g. Python, MATLAB, Operations Research"
                          className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-navy">Availability</label>
                        <input
                          required
                          value={applyForm.availability}
                          onChange={(e) => setApplyForm({ ...applyForm, availability: e.target.value })}
                          placeholder="e.g. Weekdays after 4pm, weekends"
                          className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-navy">Max Mentees</label>
                      <select
                        value={applyForm.maxMentees}
                        onChange={(e) => setApplyForm({ ...applyForm, maxMentees: Number(e.target.value) })}
                        title="Maximum number of mentees"
                        className="px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm appearance-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowApply(false)}
                        className="px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-navy text-snow text-sm font-bold press-3 press-navy transition-all disabled:opacity-50"
                      >
                        {submitting ? "Submitting\u2026" : "Submit Application"}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        )}

        {/* ── My Mentorship Pairs ── */}
        {info && info.pairs.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-display font-black text-xl text-navy">
              {isApproved ? "My Mentees" : "My Mentorship"}
            </h2>

            {info.pairs.map((pair) => {
              const userId = user?.id;
              const isMentor = pair.mentorId !== pair.menteeId; // always true
              const otherName = info.isMentor ? pair.menteeName : pair.mentorName;
              const otherRole = info.isMentor ? "Mentee" : "Mentor";
              const statusStyle = PAIR_STATUS_STYLES[pair.status];

              return (
                <div
                  key={pair.id}
                  className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${statusStyle.bg} ${statusStyle.text}`}>
                          {statusStyle.label}
                        </span>
                        <span className="text-xs text-slate">{otherRole}</span>
                      </div>
                      <h3 className="font-display font-black text-lg text-navy">{otherName}</h3>
                      <p className="text-xs text-slate">
                        Paired since {formatDate(pair.createdAt)} · {pair.feedbackCount} feedback entries
                      </p>
                    </div>

                    {pair.status === "active" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setFeedbackPair(pair);
                            setFeedbackForm({ rating: 4, notes: "", concerns: "", topicsCovered: "" });
                          }}
                          className="bg-lime border-[3px] border-navy press-3 press-navy px-4 py-2 rounded-xl font-display font-bold text-xs text-navy transition-all"
                        >
                          Submit Feedback
                        </button>
                        <button
                          onClick={() => loadFeedbackHistory(pair.id)}
                          className="bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 font-display font-bold text-xs text-navy hover:bg-cloud transition-all"
                        >
                          {viewFeedback === pair.id ? "Hide" : "View"} History
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Feedback history */}
                  {viewFeedback === pair.id && feedbackHistory.length > 0 && (
                    <div className="space-y-3 mt-4 pt-4 border-t-[3px] border-cloud">
                      {feedbackHistory.map((fb) => (
                        <div key={fb.id} className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-navy">Week {fb.weekNumber}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fb.submitterRole === "mentor" ? "bg-teal-light text-teal" : "bg-lavender-light text-lavender"}`}>
                                {fb.submitterName} ({fb.submitterRole})
                              </span>
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
                      ))}
                    </div>
                  )}
                  {viewFeedback === pair.id && feedbackHistory.length === 0 && (
                    <p className="text-sm text-slate mt-4 pt-4 border-t-[3px] border-cloud">No feedback submitted yet.</p>
                  )}
                </div>
              );

              // Silence unused variable warnings
              void userId;
              void isMentor;
            })}
          </div>
        )}

        {/* ── No involvement yet ── */}
        {info && !hasApplication && info.pairs.length === 0 && !showApply && (
          <div className="bg-lavender-light border-4 border-navy rounded-3xl p-10 text-center shadow-[4px_4px_0_0_#000] space-y-4">
            <div className="w-16 h-16 bg-teal-light rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-teal" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A18.034 18.034 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-display font-black text-lg text-navy">
              {is100L ? "TIMP Mentoring" : "Join TIMP"}
            </h3>
            <p className="text-sm text-navy/60 max-w-md mx-auto">
              {is100L
                ? "As a 100-level student, you'll be paired with a mentor by the TIMP lead. No action needed — stay tuned!"
                : !formOpen
                  ? "TIMP mentor applications are currently closed. Check back later or wait to be paired as a mentee."
                  : "Apply as a mentor to guide junior students, or wait to be matched with a mentor by the TIMP lead."}
            </p>
          </div>
        )}

        {/* ── Feedback Modal ── */}
        {feedbackPair && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-navy/50" onClick={() => setFeedbackPair(null)} />
            <div className="relative bg-snow border-4 border-navy rounded-3xl p-8 w-full max-w-lg shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Weekly Check-in</p>
                  <h3 className="font-display font-black text-xl text-navy">Submit Feedback</h3>
                </div>
                <button onClick={() => setFeedbackPair(null)} className="p-2 rounded-xl hover:bg-cloud transition-colors" aria-label="Close">
                  <svg className="w-5 h-5 text-navy/60" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleFeedback} className="space-y-5">
                {/* Rating */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFeedbackForm({ ...feedbackForm, rating: r })}
                        className={`w-10 h-10 rounded-xl border-[3px] font-bold transition-all ${
                          r <= feedbackForm.rating
                            ? "bg-sunny border-navy text-navy"
                            : "bg-ghost border-cloud text-slate hover:border-navy"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">Notes</label>
                  <textarea
                    required
                    minLength={10}
                    maxLength={1000}
                    rows={3}
                    value={feedbackForm.notes}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, notes: e.target.value })}
                    placeholder="How did the session go this week?"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate resize-none"
                  />
                </div>

                {/* Topics */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">
                    Topics Covered <span className="text-slate font-normal">(comma-separated)</span>
                  </label>
                  <input
                    value={feedbackForm.topicsCovered}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, topicsCovered: e.target.value })}
                    placeholder="e.g. Python basics, CGPA calculation"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate"
                  />
                </div>

                {/* Concerns */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-navy">
                    Concerns <span className="text-slate font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={feedbackForm.concerns}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, concerns: e.target.value })}
                    placeholder="Any issues or concerns?"
                    className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-2xl text-navy text-sm placeholder:text-slate resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setFeedbackPair(null)}
                    className="flex-1 px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingFeedback}
                    className="flex-1 px-5 py-2.5 rounded-2xl bg-navy border-[3px] border-navy text-snow text-sm font-bold press-3 press-navy transition-all disabled:opacity-50"
                  >
                    {submittingFeedback ? "Submitting…" : "Submit Feedback"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
