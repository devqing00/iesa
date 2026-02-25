"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { ConfirmModal } from "@/components/ui/Modal";
import {
  getIepodStats,
  listRegistrations,
  updateRegistration,
  listSocieties,
  createSociety,
  updateSociety,
  deleteSociety,
  listQuizzes,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  listAllSubmissions,
  reviewSubmission,
  listTeams,
  assignMentor,
  awardBonusPoints,
  getLeaderboard,
  REG_STATUS_STYLES,
  TEAM_STATUS_STYLES,
  SUBMISSION_STATUS_STYLES,
  PHASE_LABELS,
  QUIZ_TYPE_LABELS,
} from "@/lib/api";
import type {
  IepodStats,
  IepodRegistration,
  Society,
  IepodQuiz,
  IepodSubmission,
  IepodTeam,
  LeaderboardEntry,
  IepodRegistrationStatus,
  IepodPhase,
  IepodSubmissionStatus,
  IepodQuizType,
  QuizQuestion,
  CreateSocietyData,
  CreateQuizData,
} from "@/lib/api";

type Tab = "overview" | "registrations" | "societies" | "quizzes" | "teams" | "submissions" | "points";

/* ─── Tab definitions ─────────────────────── */
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "registrations", label: "Registrations" },
  { key: "societies", label: "Societies" },
  { key: "quizzes", label: "Quizzes" },
  { key: "teams", label: "Teams" },
  { key: "submissions", label: "Submissions" },
  { key: "points", label: "Points" },
];

function AdminIepodPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  /* ── Stats ── */
  const [stats, setStats] = useState<IepodStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  /* ── Registrations ── */
  const [registrations, setRegistrations] = useState<IepodRegistration[]>([]);
  const [regTotal, setRegTotal] = useState(0);
  const [regStatus, setRegStatus] = useState("");
  const [regPhase, setRegPhase] = useState<string>("");
  const [regSearch, setRegSearch] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  /* ── Societies ── */
  const [societies, setSocieties] = useState<Society[]>([]);
  const [showSocForm, setShowSocForm] = useState(false);
  const [editingSociety, setEditingSociety] = useState<Society | null>(null);
  const [socForm, setSocForm] = useState<CreateSocietyData>({
    name: "", shortName: "", description: "", focusArea: "", color: "#C8F31D",
  });
  const [socSubmitting, setSocSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  /* ── Quizzes ── */
  const [quizzes, setQuizzes] = useState<IepodQuiz[]>([]);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [quizForm, setQuizForm] = useState<CreateQuizData>({
    title: "", quizType: "general" as IepodQuizType, questions: [], isLive: false,
  });
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  /* ── Teams ── */
  const [teams, setTeams] = useState<IepodTeam[]>([]);
  const [mentorInput, setMentorInput] = useState<Record<string, string>>({});

  /* ── Submissions ── */
  const [submissions, setSubmissions] = useState<IepodSubmission[]>([]);
  const [subStatusFilter, setSubStatusFilter] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<{ status: IepodSubmissionStatus; feedback: string; score: string }>({ status: "reviewed", feedback: "", score: "" });

  /* ── Points/Leaderboard ── */
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [bonusUserId, setBonusUserId] = useState("");
  const [bonusPoints, setBonusPoints] = useState("");
  const [bonusDesc, setBonusDesc] = useState("");
  const [bonusSubmitting, setBonusSubmitting] = useState(false);

  /* ── Fetch based on tab ── */

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getIepodStats();
      setStats(data);
    } catch {
      toast.error("Failed to load IEPOD stats");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchRegistrations = useCallback(async () => {
    setRegLoading(true);
    try {
      const res = await listRegistrations({
        status: regStatus || undefined,
        phase: regPhase || undefined,
        search: regSearch || undefined,
        limit: 50,
      });
      setRegistrations(res.registrations);
      setRegTotal(res.total);
    } catch {
      toast.error("Failed to load registrations");
    } finally {
      setRegLoading(false);
    }
  }, [regStatus, regPhase, regSearch]);

  const fetchSocieties = useCallback(async () => {
    try {
      const data = await listSocieties(false);
      setSocieties(data);
    } catch {
      toast.error("Failed to load societies");
    }
  }, []);

  const fetchQuizzes = useCallback(async () => {
    try {
      const data = await listQuizzes();
      setQuizzes(data);
    } catch {
      toast.error("Failed to load quizzes");
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await listTeams({});
      setTeams(res.teams);
    } catch {
      toast.error("Failed to load teams");
    }
  }, []);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await listAllSubmissions({ status: subStatusFilter || undefined, limit: 100 });
      setSubmissions(res.submissions);
    } catch {
      toast.error("Failed to load submissions");
    }
  }, [subStatusFilter]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await getLeaderboard(100);
      setLeaderboard(data);
    } catch {
      toast.error("Failed to load leaderboard");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (tab === "overview") fetchStats();
    if (tab === "registrations") fetchRegistrations();
    if (tab === "societies") fetchSocieties();
    if (tab === "quizzes") fetchQuizzes();
    if (tab === "teams") fetchTeams();
    if (tab === "submissions") fetchSubmissions();
    if (tab === "points") fetchLeaderboard();
  }, [user, tab, fetchStats, fetchRegistrations, fetchSocieties, fetchQuizzes, fetchTeams, fetchSubmissions, fetchLeaderboard]);

  /* ── Handlers ── */

  async function handleUpdateRegistration(id: string, status: IepodRegistrationStatus, adminNote?: string, phase?: IepodPhase) {
    try {
      await updateRegistration(id, { status, adminNote, phase });
      toast.success(`Registration ${status}`);
      fetchRegistrations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleSaveSociety(e: React.FormEvent) {
    e.preventDefault();
    if (!socForm.name || !socForm.shortName || !socForm.description || !socForm.focusArea) {
      toast.error("All required fields must be filled");
      return;
    }
    setSocSubmitting(true);
    try {
      if (editingSociety) {
        await updateSociety(editingSociety._id, socForm);
        toast.success("Society updated");
      } else {
        await createSociety(socForm);
        toast.success("Society created");
      }
      await fetchSocieties();
      setShowSocForm(false);
      setEditingSociety(null);
      setSocForm({ name: "", shortName: "", description: "", focusArea: "", color: "#C8F31D" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSocSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "society") {
        await deleteSociety(deleteTarget.id);
        toast.success("Society deleted");
        await fetchSocieties();
      } else if (deleteTarget.type === "quiz") {
        await deleteQuiz(deleteTarget.id);
        toast.success("Quiz deleted");
        await fetchQuizzes();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleSaveQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!quizForm.title || quizQuestions.length === 0) {
      toast.error("Title and at least one question required");
      return;
    }
    setQuizSubmitting(true);
    try {
      await createQuiz({ ...quizForm, questions: quizQuestions });
      toast.success("Quiz created");
      await fetchQuizzes();
      setShowQuizForm(false);
      setQuizForm({ title: "", quizType: "general", questions: [], isLive: false });
      setQuizQuestions([]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setQuizSubmitting(false);
    }
  }

  async function handleToggleQuizLive(quiz: IepodQuiz) {
    const qId = quiz._id || quiz.id;
    if (!qId) return;
    try {
      await updateQuiz(qId, { isLive: !quiz.isLive });
      toast.success(quiz.isLive ? "Quiz unpublished" : "Quiz published");
      fetchQuizzes();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    }
  }

  async function handleAssignMentor(teamId: string) {
    const userId = mentorInput[teamId];
    if (!userId) { toast.error("Enter a mentor user ID"); return; }
    try {
      await assignMentor(teamId, userId);
      toast.success("Mentor assigned");
      setMentorInput({ ...mentorInput, [teamId]: "" });
      fetchTeams();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Assign failed");
    }
  }

  async function handleReviewSubmission(subId: string) {
    try {
      await reviewSubmission(subId, {
        status: reviewForm.status,
        feedback: reviewForm.feedback || undefined,
        score: reviewForm.score ? Number(reviewForm.score) : undefined,
      });
      toast.success("Submission reviewed");
      setReviewingId(null);
      setReviewForm({ status: "reviewed", feedback: "", score: "" });
      fetchSubmissions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    }
  }

  async function handleAwardBonus(e: React.FormEvent) {
    e.preventDefault();
    if (!bonusUserId || !bonusPoints || !bonusDesc) {
      toast.error("All fields required");
      return;
    }
    setBonusSubmitting(true);
    try {
      await awardBonusPoints({ userId: bonusUserId, points: Number(bonusPoints), description: bonusDesc });
      toast.success("Points awarded");
      setBonusUserId("");
      setBonusPoints("");
      setBonusDesc("");
      fetchLeaderboard();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Award failed");
    } finally {
      setBonusSubmitting(false);
    }
  }

  function addQuizQuestion() {
    setQuizQuestions([
      ...quizQuestions,
      { question: "", options: ["", "", "", ""], correctIndex: 0, points: 10 },
    ]);
  }

  function updateQuizQuestion(idx: number, field: string, value: string | number | string[]) {
    const updated = [...quizQuestions];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[idx] as any)[field] = value;
    setQuizQuestions(updated);
  }

  function removeQuizQuestion(idx: number) {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== idx));
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b-[3px] border-navy bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="font-display font-black text-3xl text-navy">IEPOD Admin</h1>
          <p className="text-slate text-sm mt-1">Manage the IESA Professional Development Hub</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="border-b-[2px] border-cloud bg-ghost">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto py-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-xs font-display font-black whitespace-nowrap transition-all ${
                tab === t.key
                  ? "bg-navy text-lime"
                  : "text-navy hover:bg-cloud"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ═══════ OVERVIEW ═══════════════════════════════════ */}
        {tab === "overview" && (
          <div className="space-y-6">
            {statsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-snow border-[3px] border-cloud rounded-2xl p-6 animate-pulse">
                    <div className="h-4 bg-cloud rounded w-1/2 mb-2" />
                    <div className="h-8 bg-cloud rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : stats ? (
              <>
                {/* Top stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Registrations", value: stats.totalRegistrations, bg: "bg-lime-light" },
                    { label: "Pending", value: stats.pending, bg: "bg-sunny-light" },
                    { label: "Approved", value: stats.approved, bg: "bg-teal-light" },
                    { label: "Rejected", value: stats.rejected, bg: "bg-coral-light" },
                  ].map((s) => (
                    <div key={s.label} className={`${s.bg} border-[3px] border-navy rounded-2xl p-5`}>
                      <p className="text-label text-navy text-xs mb-1">{s.label}</p>
                      <p className="font-display font-black text-3xl text-navy">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Phase + resource counts */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                    <h3 className="font-display font-black text-base text-navy mb-3">Phase Breakdown</h3>
                    <div className="space-y-2">
                      {(["stimulate", "carve", "pitch"] as IepodPhase[]).map((p) => (
                        <div key={p} className="flex items-center justify-between">
                          <span className="font-bold text-sm text-navy">{PHASE_LABELS[p]}</span>
                          <span className="font-display font-black text-lg text-navy">{stats.phases[p]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                    <h3 className="font-display font-black text-base text-navy mb-3">Resources</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Societies", value: stats.totalSocieties },
                        { label: "Teams", value: stats.totalTeams },
                        { label: "Quizzes", value: stats.totalQuizzes },
                        { label: "Submissions", value: stats.totalSubmissions },
                        { label: "Niche Audits", value: stats.totalNicheAudits },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center justify-between">
                          <span className="font-bold text-sm text-navy">{r.label}</span>
                          <span className="font-display font-black text-lg text-navy">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-navy border-[4px] border-lime rounded-3xl p-6 shadow-[6px_6px_0_0_#C8F31D]">
                    <h3 className="font-display font-black text-base text-lime mb-3">Society Members</h3>
                    <div className="space-y-2">
                      {stats.societyBreakdown.map((s) => (
                        <div key={s.societyId} className="flex items-center justify-between">
                          <span className="font-bold text-sm text-lime/80">{s.societyName}</span>
                          <span className="font-display font-black text-lg text-lime">{s.memberCount}</span>
                        </div>
                      ))}
                      {stats.societyBreakdown.length === 0 && (
                        <p className="text-lime/50 text-sm">No societies yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ═══════ REGISTRATIONS ══════════════════════════════ */}
        {tab === "registrations" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={regSearch}
                onChange={(e) => setRegSearch(e.target.value)}
                placeholder="Search by name/email..."
                className="flex-1 border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime"
              />
              <select
                value={regStatus}
                onChange={(e) => setRegStatus(e.target.value)}
                className="border-[3px] border-navy rounded-xl px-3 py-2 text-sm font-medium text-navy bg-snow"
              >
                <option value="">All Status</option>
                {(["pending", "approved", "rejected"] as IepodRegistrationStatus[]).map((s) => (
                  <option key={s} value={s}>{REG_STATUS_STYLES[s].label}</option>
                ))}
              </select>
              <select
                value={regPhase}
                onChange={(e) => setRegPhase(e.target.value)}
                className="border-[3px] border-navy rounded-xl px-3 py-2 text-sm font-medium text-navy bg-snow"
              >
                <option value="">All Phases</option>
                {(["stimulate", "carve", "pitch"] as IepodPhase[]).map((p) => (
                  <option key={p} value={p}>{PHASE_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <p className="text-slate text-xs">{regTotal} registration{regTotal !== 1 ? "s" : ""}</p>

            {regLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-snow border-[3px] border-cloud rounded-2xl p-6">
                    <div className="h-4 bg-cloud rounded w-1/3 mb-2" />
                    <div className="h-4 bg-cloud rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {registrations.map((r) => {
                  const statusStyle = REG_STATUS_STYLES[r.status];
                  return (
                    <div key={r._id} className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-display font-black text-sm text-navy">{r.userName}</h4>
                          <p className="text-slate text-xs">{r.userEmail}</p>
                        </div>
                        <span className={`${statusStyle.bg} ${statusStyle.text} font-bold text-[10px] px-2 py-0.5 rounded-lg`}>
                          {statusStyle.label}
                        </span>
                      </div>
                      <p className="text-navy/70 text-xs mb-1"><strong>Level:</strong> {r.level} &bull; <strong>Phase:</strong> {PHASE_LABELS[r.phase]} &bull; <strong>Points:</strong> {r.points}</p>
                      <p className="text-navy/60 text-xs mb-1"><strong>Interests:</strong> {r.interests.join(", ")}</p>
                      <details className="mb-2">
                        <summary className="text-lavender text-xs font-bold cursor-pointer">Why Join</summary>
                        <p className="text-navy/60 text-xs mt-1">{r.whyJoin}</p>
                      </details>

                      {r.status === "pending" && (
                        <PermissionGate permission="iepod:manage">
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleUpdateRegistration(r._id, "approved")}
                            className="bg-teal border-[2px] border-navy text-navy font-bold text-xs px-4 py-1.5 rounded-xl press-2 press-navy"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleUpdateRegistration(r._id, "rejected")}
                            className="bg-coral border-[2px] border-navy text-snow font-bold text-xs px-4 py-1.5 rounded-xl press-2 press-navy"
                          >
                            Reject
                          </button>
                        </div>
                        </PermissionGate>
                      )}
                    </div>
                  );
                })}
                {registrations.length === 0 && (
                  <div className="text-center py-12 bg-ghost rounded-3xl border-[3px] border-cloud">
                    <p className="text-slate font-medium">No registrations found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════ SOCIETIES ══════════════════════════════════ */}
        {tab === "societies" && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-black text-lg text-navy">Societies</h3>
              <PermissionGate permission="iepod:manage">
              <button
                onClick={() => {
                  setEditingSociety(null);
                  setSocForm({ name: "", shortName: "", description: "", focusArea: "", color: "#C8F31D" });
                  setShowSocForm(!showSocForm);
                }}
                className="bg-lime border-[3px] border-navy press-4 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all"
              >
                {showSocForm ? "Cancel" : "Add Society"}
              </button>
              </PermissionGate>
            </div>

            {showSocForm && (
              <PermissionGate permission="iepod:manage">
              <form onSubmit={handleSaveSociety} className="bg-lime-light border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
                <h4 className="font-display font-black text-base text-navy">
                  {editingSociety ? "Edit Society" : "New Society"}
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-label text-navy text-xs mb-1 block">Name *</label>
                    <input value={socForm.name} onChange={(e) => setSocForm({ ...socForm, name: e.target.value })}
                      className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime" />
                  </div>
                  <div>
                    <label className="text-label text-navy text-xs mb-1 block">Short Name *</label>
                    <input value={socForm.shortName} onChange={(e) => setSocForm({ ...socForm, shortName: e.target.value })}
                      maxLength={10} className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime" />
                  </div>
                </div>
                <div>
                  <label className="text-label text-navy text-xs mb-1 block">Description *</label>
                  <textarea value={socForm.description} onChange={(e) => setSocForm({ ...socForm, description: e.target.value })}
                    rows={2} className="w-full border-[3px] border-navy rounded-xl px-4 py-3 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-label text-navy text-xs mb-1 block">Focus Area *</label>
                    <input value={socForm.focusArea} onChange={(e) => setSocForm({ ...socForm, focusArea: e.target.value })}
                      className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime" />
                  </div>
                  <div>
                    <label className="text-label text-navy text-xs mb-1 block">Color</label>
                    <input type="color" value={socForm.color} onChange={(e) => setSocForm({ ...socForm, color: e.target.value })}
                      className="w-16 h-10 border-[3px] border-navy rounded-xl cursor-pointer" />
                  </div>
                </div>
                <button type="submit" disabled={socSubmitting}
                  className="bg-lime border-[4px] border-navy press-5 press-navy px-6 py-3 rounded-xl font-display font-black text-sm text-navy transition-all disabled:opacity-50">
                  {socSubmitting ? "Saving..." : editingSociety ? "Update Society" : "Create Society"}
                </button>
              </form>
              </PermissionGate>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {societies.map((s) => (
                <div key={s._id} className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: s.color }} />
                      <h4 className="font-display font-black text-sm text-navy">{s.name}</h4>
                    </div>
                    <span className={`font-bold text-[10px] px-2 py-0.5 rounded-lg ${s.isActive ? "bg-teal-light text-teal" : "bg-coral-light text-coral"}`}>
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-navy/70 text-xs mb-2">{s.focusArea} &bull; {s.memberCount} members</p>
                  <PermissionGate permission="iepod:manage">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingSociety(s);
                        setSocForm({ name: s.name, shortName: s.shortName, description: s.description, focusArea: s.focusArea, color: s.color });
                        setShowSocForm(true);
                      }}
                      className="text-lavender font-bold text-xs hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: "society", id: s._id, name: s.name })}
                      className="text-coral font-bold text-xs hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                  </PermissionGate>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ QUIZZES ═══════════════════════════════════ */}
        {tab === "quizzes" && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-black text-lg text-navy">Quizzes</h3>
              <PermissionGate permission="iepod:manage">
              <button
                onClick={() => setShowQuizForm(!showQuizForm)}
                className="bg-lime border-[3px] border-navy press-4 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all"
              >
                {showQuizForm ? "Cancel" : "Create Quiz"}
              </button>
              </PermissionGate>
            </div>

            {showQuizForm && (
              <PermissionGate permission="iepod:manage">
              <form onSubmit={handleSaveQuiz} className="bg-lavender-light border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
                <h4 className="font-display font-black text-base text-navy">New Quiz</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-label text-navy text-xs mb-1 block">Title *</label>
                    <input value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                      className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime" />
                  </div>
                  <div>
                    <label className="text-label text-navy text-xs mb-1 block">Type</label>
                    <select value={quizForm.quizType} onChange={(e) => setQuizForm({ ...quizForm, quizType: e.target.value as IepodQuizType })}
                      className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow">
                      {(Object.keys(QUIZ_TYPE_LABELS) as IepodQuizType[]).map((t) => (
                        <option key={t} value={t}>{QUIZ_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-label text-navy text-xs mb-1 block">Description</label>
                  <textarea value={quizForm.description || ""} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                    rows={2} className="w-full border-[3px] border-navy rounded-xl px-4 py-3 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={quizForm.isLive} onChange={(e) => setQuizForm({ ...quizForm, isLive: e.target.checked })}
                      className="w-4 h-4 accent-lime" />
                    <span className="font-bold text-xs text-navy">Publish immediately</span>
                  </label>
                </div>

                {/* Questions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-display font-black text-sm text-navy">Questions ({quizQuestions.length})</h5>
                    <button type="button" onClick={addQuizQuestion}
                      className="bg-navy text-lime font-bold text-xs px-3 py-1.5 rounded-lg press-2 press-navy">
                      + Add Question
                    </button>
                  </div>
                  {quizQuestions.map((q, qi) => (
                    <div key={qi} className="bg-snow border-[3px] border-navy rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-display font-black text-xs text-navy">Q{qi + 1}</span>
                        <button type="button" onClick={() => removeQuizQuestion(qi)}
                          className="text-coral text-xs font-bold hover:underline">Remove</button>
                      </div>
                      <input value={q.question} onChange={(e) => updateQuizQuestion(qi, "question", e.target.value)}
                        placeholder="Question text..."
                        className="w-full border-[2px] border-cloud rounded-lg px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none" />
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${qi}`}
                              checked={q.correctIndex === oi}
                              onChange={() => updateQuizQuestion(qi, "correctIndex", oi)}
                              className="accent-teal"
                            />
                            <input
                              value={opt}
                              onChange={(e) => {
                                const opts = [...q.options];
                                opts[oi] = e.target.value;
                                updateQuizQuestion(qi, "options", opts);
                              }}
                              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                              className="flex-1 border-[2px] border-cloud rounded-lg px-3 py-1.5 text-xs text-navy focus:border-navy focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <div>
                          <label className="text-[10px] text-slate block">Points</label>
                          <input type="number" value={q.points} min={1} max={100}
                            onChange={(e) => updateQuizQuestion(qi, "points", Number(e.target.value))}
                            className="w-20 border-[2px] border-cloud rounded-lg px-2 py-1 text-xs text-navy focus:border-navy focus:outline-none" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="submit" disabled={quizSubmitting}
                  className="bg-lime border-[4px] border-navy press-5 press-navy px-6 py-3 rounded-xl font-display font-black text-sm text-navy transition-all disabled:opacity-50">
                  {quizSubmitting ? "Saving..." : "Create Quiz"}
                </button>
              </form>
              </PermissionGate>
            )}

            <div className="space-y-3">
              {quizzes.map((q) => {
                const qId = q._id || q.id || "";
                return (
                  <div key={qId} className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-display font-black text-sm text-navy">{q.title}</h4>
                        <p className="text-slate text-[10px]">
                          {QUIZ_TYPE_LABELS[q.quizType]} &bull; {q.questionCount ?? 0} questions &bull; {q.participantCount ?? 0} participants
                        </p>
                      </div>
                      <span className={`font-bold text-[10px] px-2 py-0.5 rounded-lg ${q.isLive ? "bg-teal-light text-teal" : "bg-cloud text-slate"}`}>
                        {q.isLive ? "Live" : "Draft"}
                      </span>
                    </div>
                    <PermissionGate permission="iepod:manage">
                    <div className="flex gap-2">
                      <button onClick={() => handleToggleQuizLive(q)}
                        className="text-lavender font-bold text-xs hover:underline">
                        {q.isLive ? "Unpublish" : "Publish"}
                      </button>
                      <button onClick={() => setDeleteTarget({ type: "quiz", id: qId, name: q.title })}
                        className="text-coral font-bold text-xs hover:underline">
                        Delete
                      </button>
                    </div>
                    </PermissionGate>
                  </div>
                );
              })}
              {quizzes.length === 0 && (
                <div className="text-center py-12 bg-ghost rounded-3xl border-[3px] border-cloud">
                  <p className="text-slate font-medium">No quizzes created yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ TEAMS ══════════════════════════════════════ */}
        {tab === "teams" && (
          <div className="space-y-4">
            <h3 className="font-display font-black text-lg text-navy">Teams</h3>
            {teams.map((t) => (
              <div key={t._id} className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-display font-black text-sm text-navy">{t.name}</h4>
                    <p className="text-slate text-[10px]">
                      {t.members.length}/{t.maxMembers} members &bull; {t.submissionCount} submissions
                    </p>
                  </div>
                  <span className={`${TEAM_STATUS_STYLES[t.status].bg} ${TEAM_STATUS_STYLES[t.status].text} font-bold text-[10px] px-2 py-0.5 rounded-lg`}>
                    {TEAM_STATUS_STYLES[t.status].label}
                  </span>
                </div>
                <p className="text-navy/70 text-xs mb-2 line-clamp-1">{t.problemStatement}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {t.members.map((m) => (
                    <span key={m.userId} className="bg-ghost text-navy font-bold text-[10px] px-2 py-0.5 rounded-lg">
                      {m.userName} ({m.role})
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {t.mentorName ? (
                    <span className="bg-lavender-light text-lavender font-bold text-[10px] px-2 py-0.5 rounded-lg">
                      Mentor: {t.mentorName}
                    </span>
                  ) : (
                    <PermissionGate permission="iepod:manage">
                    <div className="flex gap-2 items-center">
                      <input
                        value={mentorInput[t._id] || ""}
                        onChange={(e) => setMentorInput({ ...mentorInput, [t._id]: e.target.value })}
                        placeholder="Mentor user ID..."
                        className="border-[2px] border-cloud rounded-lg px-3 py-1 text-xs text-navy focus:border-navy focus:outline-none w-44"
                      />
                      <button
                        onClick={() => handleAssignMentor(t._id)}
                        className="text-teal font-bold text-xs hover:underline"
                      >
                        Assign
                      </button>
                    </div>
                    </PermissionGate>
                  )}
                </div>
              </div>
            ))}
            {teams.length === 0 && (
              <div className="text-center py-12 bg-ghost rounded-3xl border-[3px] border-cloud">
                <p className="text-slate font-medium">No teams yet</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════ SUBMISSIONS ════════════════════════════════ */}
        {tab === "submissions" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <h3 className="font-display font-black text-lg text-navy">Submissions</h3>
              <select value={subStatusFilter} onChange={(e) => setSubStatusFilter(e.target.value)}
                className="border-[3px] border-navy rounded-xl px-3 py-1.5 text-xs font-medium text-navy bg-snow">
                <option value="">All Status</option>
                {(Object.keys(SUBMISSION_STATUS_STYLES) as IepodSubmissionStatus[]).map((s) => (
                  <option key={s} value={s}>{SUBMISSION_STATUS_STYLES[s].label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {submissions.map((sub) => {
                const style = SUBMISSION_STATUS_STYLES[sub.status];
                const isReviewing = reviewingId === sub._id;
                return (
                  <div key={sub._id} className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-display font-black text-sm text-navy">{sub.title}</h4>
                        <p className="text-slate text-[10px]">
                          Team: {sub.teamName} &bull; Iteration #{sub.iterationNumber} &bull; {new Date(sub.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`${style.bg} ${style.text} font-bold text-[10px] px-2 py-0.5 rounded-lg`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-navy/70 text-xs mb-2 line-clamp-2">{sub.description}</p>

                    <PermissionGate permission="iepod:manage">
                    {!isReviewing ? (
                      <button
                        onClick={() => {
                          setReviewingId(sub._id);
                          setReviewForm({
                            status: sub.status === "submitted" ? "reviewed" : sub.status,
                            feedback: sub.feedback || "",
                            score: sub.score?.toString() || "",
                          });
                        }}
                        className="text-lavender font-bold text-xs hover:underline"
                      >
                        Review
                      </button>
                    ) : (
                      <div className="mt-3 space-y-3 bg-ghost rounded-xl p-4">
                        <div className="flex gap-3">
                          <select value={reviewForm.status} onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value as IepodSubmissionStatus })}
                            className="border-[2px] border-navy rounded-lg px-3 py-1.5 text-xs text-navy bg-snow">
                            {(["reviewed", "finalist"] as IepodSubmissionStatus[]).map((s) => (
                              <option key={s} value={s}>{SUBMISSION_STATUS_STYLES[s].label}</option>
                            ))}
                          </select>
                          <input type="number" value={reviewForm.score} onChange={(e) => setReviewForm({ ...reviewForm, score: e.target.value })}
                            placeholder="Score (0-100)" min={0} max={100}
                            className="w-32 border-[2px] border-navy rounded-lg px-3 py-1.5 text-xs text-navy bg-snow" />
                        </div>
                        <textarea value={reviewForm.feedback} onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                          placeholder="Feedback..." rows={2}
                          className="w-full border-[2px] border-navy rounded-lg px-3 py-2 text-xs text-navy bg-snow resize-none" />
                        <div className="flex gap-2">
                          <button onClick={() => handleReviewSubmission(sub._id)}
                            className="bg-teal border-[2px] border-navy text-navy font-bold text-xs px-4 py-1.5 rounded-lg press-2 press-navy">
                            Save Review
                          </button>
                          <button onClick={() => setReviewingId(null)}
                            className="text-slate font-bold text-xs hover:underline">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    </PermissionGate>
                  </div>
                );
              })}
              {submissions.length === 0 && (
                <div className="text-center py-12 bg-ghost rounded-3xl border-[3px] border-cloud">
                  <p className="text-slate font-medium">No submissions yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ POINTS ════════════════════════════════════ */}
        {tab === "points" && (
          <div className="space-y-6">
            {/* Award bonus */}
            <PermissionGate permission="iepod:manage">
            <div className="bg-lime-light border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <h3 className="font-display font-black text-base text-navy mb-4">Award Bonus Points</h3>
              <form onSubmit={handleAwardBonus} className="flex flex-col sm:flex-row gap-3">
                <input value={bonusUserId} onChange={(e) => setBonusUserId(e.target.value)}
                  placeholder="User ID" className="flex-1 border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow" />
                <input type="number" value={bonusPoints} onChange={(e) => setBonusPoints(e.target.value)}
                  placeholder="Points" min={1} className="w-24 border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow" />
                <input value={bonusDesc} onChange={(e) => setBonusDesc(e.target.value)}
                  placeholder="Reason" className="flex-1 border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow" />
                <button type="submit" disabled={bonusSubmitting}
                  className="bg-lime border-[3px] border-navy press-4 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all disabled:opacity-50 whitespace-nowrap">
                  {bonusSubmitting ? "..." : "Award"}
                </button>
              </form>
            </div>
            </PermissionGate>

            {/* Leaderboard */}
            <div className="bg-navy border-[4px] border-lime rounded-3xl p-6 shadow-[8px_8px_0_0_#C8F31D]">
              <h3 className="font-display font-black text-lg text-lime mb-4">Full Leaderboard</h3>
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div key={entry.userId} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-navy-light">
                    <span className={`font-display font-black text-sm w-8 text-center ${
                      entry.rank === 1 ? "text-sunny" : entry.rank === 2 ? "text-cloud" : entry.rank === 3 ? "text-coral" : "text-lime/40"
                    }`}>
                      #{entry.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-lime/80 truncate">{entry.userName}</p>
                      <div className="flex items-center gap-2">
                        {entry.phase && <span className="text-lime/40 text-[10px]">{PHASE_LABELS[entry.phase]}</span>}
                        {entry.societyName && <span className="text-lime/40 text-[10px]">{entry.societyName}</span>}
                      </div>
                    </div>
                    <span className="font-display font-black text-base text-lime">{entry.totalPoints}</span>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <p className="text-lime/50 text-sm text-center py-8">No rankings yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          title={`Delete ${deleteTarget.type === "society" ? "Society" : "Quiz"}`}
          message={`Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default withAuth(AdminIepodPage, {
  anyPermission: ["iepod:manage", "iepod:view"],
});
