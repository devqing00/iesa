"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
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
  listNicheAudits,
  getQuizResults,
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
  NicheAudit,
  QuizResult,
} from "@/lib/api";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { getErrorMessage } from "@/lib/adminApiError";

/* ─── Types ────────────────────────────────────── */
type Tab = "overview" | "registrations" | "societies" | "quizzes" | "teams" | "submissions" | "niche-audits" | "points";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "registrations", label: "Registrations" },
  { key: "societies", label: "Societies" },
  { key: "quizzes", label: "Quizzes" },
  { key: "teams", label: "Teams" },
  { key: "submissions", label: "Submissions" },
  { key: "niche-audits", label: "Niche Audits" },
  { key: "points", label: "Points" },
];
const REG_SUB_TABS = ["pending", "approved", "rejected"] as const;
const PAGE_SIZE = 20;

/* ─── Helpers ──────────────────────────────────── */
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}
function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-[3px] border-teal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-snow border-[3px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
      <svg className="w-10 h-10 text-cloud mx-auto mb-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M6.912 3a3 3 0 0 0-2.868 2.118l-2.411 7.838a3 3 0 0 0-.133.882V18a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-4.162c0-.299-.045-.596-.133-.882l-2.412-7.838A3 3 0 0 0 17.088 3H6.912Zm13.823 9.75-2.213-7.191A1.5 1.5 0 0 0 17.088 4.5H6.912a1.5 1.5 0 0 0-1.434 1.059L3.265 12.75H6.11a3 3 0 0 1 2.684 1.658l.256.513a1.5 1.5 0 0 0 1.342.829h3.218a1.5 1.5 0 0 0 1.342-.83l.256-.512a3 3 0 0 1 2.684-1.658h2.844Z" clipRule="evenodd" />
      </svg>
      <p className="text-sm text-slate font-medium">{message}</p>
    </div>
  );
}
function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" strokeLinecap="round" />
      </svg>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 bg-ghost border-[3px] border-cloud rounded-xl text-sm text-navy placeholder:text-slate focus:border-navy focus:outline-none transition-colors" />
    </div>
  );
}
function StatCard({ label, value, bg }: { label: string; value: number | string; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl p-4 text-center border-2 border-cloud`}>
      <p className="text-2xl font-display font-black text-navy">{value}</p>
      <p className="text-[10px] font-bold text-slate uppercase tracking-wider">{label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ADMIN IEPOD PAGE
   ═══════════════════════════════════════════════════ */

function AdminIepodPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-iepod");

  /* ── Stats ── */
  const [stats, setStats] = useState<IepodStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  /* ── Registrations ── */
  const [registrations, setRegistrations] = useState<IepodRegistration[]>([]);
  const [regTotal, setRegTotal] = useState(0);
  const [regSubTab, setRegSubTab] = useState<string>("pending");
  const [regPhase, setRegPhase] = useState<string>("");
  const [regSearch, setRegSearch] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regPage, setRegPage] = useState(1);
  const [regDept, setRegDept] = useState<string>("");

  /* ── Societies ── */
  const [societies, setSocieties] = useState<Society[]>([]);
  const [socLoading, setSocLoading] = useState(false);
  const [showSocModal, setShowSocModal] = useState(false);
  const [editingSociety, setEditingSociety] = useState<Society | null>(null);
  const [socForm, setSocForm] = useState<CreateSocietyData>({ name: "", shortName: "", description: "", focusArea: "", color: "#C8F31D" });
  const [socSubmitting, setSocSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  /* ── Quizzes ── */
  const [quizzes, setQuizzes] = useState<IepodQuiz[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizForm, setQuizForm] = useState<CreateQuizData>({ title: "", quizType: "general" as IepodQuizType, questions: [], isLive: false });
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [showResultsQuizId, setShowResultsQuizId] = useState<string | null>(null);

  /* ── Teams ── */
  const [teams, setTeams] = useState<IepodTeam[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [mentorInput, setMentorInput] = useState<Record<string, string>>({});
  const [teamSearch, setTeamSearch] = useState("");

  /* ── Submissions ── */
  const [submissions, setSubmissions] = useState<IepodSubmission[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subStatusFilter, setSubStatusFilter] = useState("");
  const [reviewingSub, setReviewingSub] = useState<IepodSubmission | null>(null);
  const [reviewForm, setReviewForm] = useState<{ status: IepodSubmissionStatus; feedback: string; score: string }>({ status: "reviewed", feedback: "", score: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  /* ── Niche Audits ── */
  const [nicheAudits, setNicheAudits] = useState<NicheAudit[]>([]);
  const [nicheTotal, setNicheTotal] = useState(0);
  const [nicheLoading, setNicheLoading] = useState(false);
  const [nicheSearch, setNicheSearch] = useState("");
  const [nichePage, setNichePage] = useState(1);
  const [viewingAudit, setViewingAudit] = useState<NicheAudit | null>(null);

  /* ── Points/Leaderboard ── */
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [bonusUserId, setBonusUserId] = useState("");
  const [bonusPoints, setBonusPoints] = useState("");
  const [bonusDesc, setBonusDesc] = useState("");
  const [bonusSubmitting, setBonusSubmitting] = useState(false);

  /* ── Reset pages on filter change ── */
  useEffect(() => { setRegPage(1); }, [regSubTab, regPhase, regSearch, regDept]);
  useEffect(() => { setNichePage(1); }, [nicheSearch]);

  /* ── Fetchers ── */
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try { setStats(await getIepodStats()); } catch (err) { toast.error(getErrorMessage(err, "Failed to load stats")); } finally { setStatsLoading(false); }
  }, []);

  const fetchRegistrations = useCallback(async () => {
    setRegLoading(true);
    try {
      const res = await listRegistrations({ status: regSubTab, phase: regPhase || undefined, department: regDept || undefined, search: regSearch || undefined, limit: PAGE_SIZE, skip: (regPage - 1) * PAGE_SIZE });
      setRegistrations(res.registrations); setRegTotal(res.total);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load registrations")); } finally { setRegLoading(false); }
  }, [regSubTab, regPhase, regSearch, regPage, regDept]);

  const fetchSocieties = useCallback(async () => {
    setSocLoading(true);
    try { setSocieties(await listSocieties(false)); } catch (err) { toast.error(getErrorMessage(err, "Failed to load societies")); } finally { setSocLoading(false); }
  }, []);

  const fetchQuizzes = useCallback(async () => {
    setQuizLoading(true);
    try { setQuizzes(await listQuizzes()); } catch (err) { toast.error(getErrorMessage(err, "Failed to load quizzes")); } finally { setQuizLoading(false); }
  }, []);

  const fetchTeams = useCallback(async () => {
    setTeamLoading(true);
    try { const res = await listTeams({}); setTeams(res.teams); } catch (err) { toast.error(getErrorMessage(err, "Failed to load teams")); } finally { setTeamLoading(false); }
  }, []);

  const fetchSubmissions = useCallback(async () => {
    setSubLoading(true);
    try { const res = await listAllSubmissions({ status: subStatusFilter || undefined, limit: 100 }); setSubmissions(res.submissions); } catch (err) { toast.error(getErrorMessage(err, "Failed to load submissions")); } finally { setSubLoading(false); }
  }, [subStatusFilter]);

  const fetchNicheAudits = useCallback(async () => {
    setNicheLoading(true);
    try { const res = await listNicheAudits({ search: nicheSearch || undefined, limit: PAGE_SIZE, skip: (nichePage - 1) * PAGE_SIZE }); setNicheAudits(res.audits); setNicheTotal(res.total); } catch (err) { toast.error(getErrorMessage(err, "Failed to load niche audits")); } finally { setNicheLoading(false); }
  }, [nicheSearch, nichePage]);

  const fetchLeaderboard = useCallback(async () => {
    try { setLeaderboard(await getLeaderboard(100)); } catch (err) { toast.error(getErrorMessage(err, "Failed to load leaderboard")); }
  }, []);

  /* ── Trigger fetches ── */
  useEffect(() => {
    if (tab === "overview") fetchStats();
    if (tab === "registrations") fetchRegistrations();
    if (tab === "societies") fetchSocieties();
    if (tab === "quizzes") fetchQuizzes();
    if (tab === "teams") fetchTeams();
    if (tab === "submissions") fetchSubmissions();
    if (tab === "niche-audits") fetchNicheAudits();
    if (tab === "points") fetchLeaderboard();
  }, [tab, fetchStats, fetchRegistrations, fetchSocieties, fetchQuizzes, fetchTeams, fetchSubmissions, fetchNicheAudits, fetchLeaderboard]);

  /* ── Filtered teams (client-side) ── */
  const filteredTeams = useMemo(() => {
    if (!teamSearch.trim()) return teams;
    const q = teamSearch.toLowerCase();
    return teams.filter(t => t.name.toLowerCase().includes(q) || t.problemStatement.toLowerCase().includes(q) || t.members.some(m => m.userName.toLowerCase().includes(q)));
  }, [teams, teamSearch]);

  /* ── Handlers ── */
  async function handleUpdateRegistration(id: string, status: IepodRegistrationStatus, adminNote?: string, phase?: IepodPhase) {
    try { await updateRegistration(id, { status, adminNote, phase }); toast.success(`Registration ${status}`); fetchRegistrations(); } catch (err) { toast.error(getErrorMessage(err, "Failed to update registration")); }
  }

  async function handleSaveSociety(e: React.FormEvent) {
    e.preventDefault();
    if (!socForm.name || !socForm.shortName || !socForm.description || !socForm.focusArea) { toast.error("All required fields must be filled"); return; }
    setSocSubmitting(true);
    try {
      if (editingSociety) { await updateSociety(editingSociety._id, socForm); toast.success("Society updated"); }
      else { await createSociety(socForm); toast.success("Society created"); }
      await fetchSocieties(); closeSocModal();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to save society")); } finally { setSocSubmitting(false); }
  }

  function closeSocModal() {
    setShowSocModal(false); setEditingSociety(null);
    setSocForm({ name: "", shortName: "", description: "", focusArea: "", color: "#C8F31D" });
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "society") { await deleteSociety(deleteTarget.id); toast.success("Society deleted"); await fetchSocieties(); }
      else if (deleteTarget.type === "quiz") { await deleteQuiz(deleteTarget.id); toast.success("Quiz deleted"); await fetchQuizzes(); }
    } catch (err) { toast.error(getErrorMessage(err, "Failed to delete item")); } finally { setDeleteTarget(null); }
  }

  async function handleSaveQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!quizForm.title || quizQuestions.length === 0) { toast.error("Title and at least one question required"); return; }
    setQuizSubmitting(true);
    try {
      await createQuiz({ ...quizForm, questions: quizQuestions }); toast.success("Quiz created");
      await fetchQuizzes(); closeQuizModal();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to create quiz")); } finally { setQuizSubmitting(false); }
  }

  function closeQuizModal() {
    setShowQuizModal(false);
    setQuizForm({ title: "", quizType: "general", questions: [], isLive: false });
    setQuizQuestions([]);
  }

  async function handleToggleQuizLive(quiz: IepodQuiz) {
    const qId = quiz._id || quiz.id;
    if (!qId) return;
    try { await updateQuiz(qId, { isLive: !quiz.isLive }); toast.success(quiz.isLive ? "Quiz unpublished" : "Quiz published"); fetchQuizzes(); } catch (err) { toast.error(getErrorMessage(err, "Failed to update quiz")); }
  }

  async function handleViewQuizResults(quizId: string) {
    if (showResultsQuizId === quizId) { setShowResultsQuizId(null); return; }
    try { const results = await getQuizResults(quizId); setQuizResults(results); setShowResultsQuizId(quizId); } catch (err) { toast.error(getErrorMessage(err, "Failed to load quiz results")); }
  }

  async function handleAssignMentor(teamId: string) {
    const userId = mentorInput[teamId];
    if (!userId) { toast.error("Enter a mentor user ID"); return; }
    try { await assignMentor(teamId, userId); toast.success("Mentor assigned"); setMentorInput({ ...mentorInput, [teamId]: "" }); fetchTeams(); } catch (err) { toast.error(getErrorMessage(err, "Failed to assign mentor")); }
  }

  async function handleReviewSubmission() {
    if (!reviewingSub) return;
    setReviewSubmitting(true);
    try {
      await reviewSubmission(reviewingSub._id, { status: reviewForm.status, feedback: reviewForm.feedback || undefined, score: reviewForm.score ? Number(reviewForm.score) : undefined });
      toast.success("Submission reviewed"); setReviewingSub(null); setReviewForm({ status: "reviewed", feedback: "", score: "" }); fetchSubmissions();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to review submission")); } finally { setReviewSubmitting(false); }
  }

  async function handleAwardBonus(e: React.FormEvent) {
    e.preventDefault();
    if (!bonusUserId || !bonusPoints || !bonusDesc) { toast.error("All fields required"); return; }
    setBonusSubmitting(true);
    try {
      await awardBonusPoints({ userId: bonusUserId, points: Number(bonusPoints), description: bonusDesc });
      toast.success("Points awarded"); setBonusUserId(""); setBonusPoints(""); setBonusDesc(""); fetchLeaderboard();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to award bonus points")); } finally { setBonusSubmitting(false); }
  }

  function addQuizQuestion() { setQuizQuestions([...quizQuestions, { question: "", options: ["", "", "", ""], correctIndex: 0, points: 10 }]); }
  function updateQuizQuestion(idx: number, field: string, value: string | number | string[]) {
    const updated = [...quizQuestions];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[idx] as any)[field] = value;
    setQuizQuestions(updated);
  }
  function removeQuizQuestion(idx: number) { setQuizQuestions(quizQuestions.filter((_, i) => i !== idx)); }

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <ToolHelpModal toolId="admin-iepod" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>
      {/* ─── Header ─── */}
      <div>
        <h1 className="font-display font-black text-2xl md:text-3xl text-navy">
          IEPOD <span className="brush-highlight">Admin</span>
        </h1>
        <p className="text-sm text-slate mt-1">Manage the IESA Professional Development Hub</p>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-xs font-display font-black whitespace-nowrap transition-all ${tab === t.key ? "bg-navy text-snow" : "bg-ghost border-2 border-cloud text-navy hover:border-navy"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════ OVERVIEW ═══════════════════════════════ */}
      {tab === "overview" && <OverviewTab stats={stats} loading={statsLoading} />}

      {/* ═══════ REGISTRATIONS ══════════════════════════ */}
      {tab === "registrations" && (
        <RegistrationsTab
          registrations={registrations} total={regTotal} loading={regLoading}
          subTab={regSubTab} setSubTab={setRegSubTab}
          phase={regPhase} setPhase={setRegPhase}
          department={regDept} setDepartment={setRegDept}
          search={regSearch} setSearch={setRegSearch}
          page={regPage} setPage={setRegPage}
          onUpdateStatus={handleUpdateRegistration}
        />
      )}

      {/* ═══════ SOCIETIES ═════════════════════════════ */}
      {tab === "societies" && (
        <SocietiesTab
          societies={societies} loading={socLoading}
          onAdd={() => { setEditingSociety(null); setSocForm({ name: "", shortName: "", description: "", focusArea: "", color: "#C8F31D" }); setShowSocModal(true); }}
          onEdit={(s) => { setEditingSociety(s); setSocForm({ name: s.name, shortName: s.shortName, description: s.description, focusArea: s.focusArea, color: s.color }); setShowSocModal(true); }}
          onDelete={(s) => setDeleteTarget({ type: "society", id: s._id, name: s.name })}
        />
      )}

      {/* ═══════ QUIZZES ═══════════════════════════════ */}
      {tab === "quizzes" && (
        <QuizzesTab
          quizzes={quizzes} loading={quizLoading}
          onAdd={() => setShowQuizModal(true)}
          onToggleLive={handleToggleQuizLive}
          onDelete={(q) => setDeleteTarget({ type: "quiz", id: q._id || q.id || "", name: q.title })}
          onViewResults={handleViewQuizResults}
          showResultsQuizId={showResultsQuizId}
          quizResults={quizResults}
        />
      )}

      {/* ═══════ TEAMS ═════════════════════════════════ */}
      {tab === "teams" && (
        <TeamsTab
          teams={filteredTeams} loading={teamLoading}
          search={teamSearch} setSearch={setTeamSearch}
          mentorInput={mentorInput} setMentorInput={setMentorInput}
          onAssignMentor={handleAssignMentor}
        />
      )}

      {/* ═══════ SUBMISSIONS ═══════════════════════════ */}
      {tab === "submissions" && (
        <SubmissionsTab
          submissions={submissions} loading={subLoading}
          statusFilter={subStatusFilter} setStatusFilter={setSubStatusFilter}
          onReview={(sub) => { setReviewingSub(sub); setReviewForm({ status: sub.status === "submitted" ? "reviewed" : sub.status, feedback: sub.feedback || "", score: sub.score?.toString() || "" }); }}
        />
      )}

      {/* ═══════ NICHE AUDITS ═════════════════════════ */}
      {tab === "niche-audits" && (
        <NicheAuditsTab
          audits={nicheAudits} total={nicheTotal} loading={nicheLoading}
          search={nicheSearch} setSearch={setNicheSearch}
          page={nichePage} setPage={setNichePage}
          onView={setViewingAudit}
        />
      )}

      {/* ═══════ POINTS ════════════════════════════════ */}
      {tab === "points" && (
        <PointsTab
          leaderboard={leaderboard}
          bonusUserId={bonusUserId} setBonusUserId={setBonusUserId}
          bonusPoints={bonusPoints} setBonusPoints={setBonusPoints}
          bonusDesc={bonusDesc} setBonusDesc={setBonusDesc}
          bonusSubmitting={bonusSubmitting}
          onAwardBonus={handleAwardBonus}
        />
      )}

      {/* ═══════ MODALS ═══════════════════════════════ */}

      {/* Society Modal */}
      <Modal isOpen={showSocModal} onClose={closeSocModal} title={editingSociety ? "Edit Society" : "New Society"} size="lg"
        footer={<>
          <button onClick={closeSocModal} className="px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors">Cancel</button>
          <button onClick={(e) => handleSaveSociety(e as unknown as React.FormEvent)} disabled={socSubmitting} className="px-5 py-2.5 rounded-2xl border-[3px] border-navy bg-lime text-navy text-sm font-bold transition-all disabled:opacity-50">
            {socSubmitting ? "Saving…" : editingSociety ? "Update" : "Create"}
          </button>
        </>}>
        <form onSubmit={handleSaveSociety} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Name *</label>
              <input value={socForm.name} onChange={(e) => setSocForm({ ...socForm, name: e.target.value })} title="Society name" className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none" />
            </div>
            <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Short Name *</label>
              <input value={socForm.shortName} onChange={(e) => setSocForm({ ...socForm, shortName: e.target.value })} maxLength={10} title="Short name" className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none" />
            </div>
          </div>
          <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Description *</label>
            <textarea value={socForm.description} onChange={(e) => setSocForm({ ...socForm, description: e.target.value })} title="Society description" rows={2} className="w-full border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy bg-snow focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Focus Area *</label>
              <input value={socForm.focusArea} onChange={(e) => setSocForm({ ...socForm, focusArea: e.target.value })} title="Focus area" className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none" />
            </div>
            <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Color</label>
              <input type="color" value={socForm.color} onChange={(e) => setSocForm({ ...socForm, color: e.target.value })} title="Society color" className="w-16 h-10 border-[3px] border-navy rounded-xl cursor-pointer" />
            </div>
          </div>
        </form>
      </Modal>

      {/* Quiz Modal */}
      <Modal isOpen={showQuizModal} onClose={closeQuizModal} title="New Quiz" size="xl"
        footer={<>
          <button onClick={closeQuizModal} className="px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors">Cancel</button>
          <button onClick={(e) => handleSaveQuiz(e as unknown as React.FormEvent)} disabled={quizSubmitting} className="px-5 py-2.5 rounded-2xl border-[3px] border-navy bg-lime text-navy text-sm font-bold transition-all disabled:opacity-50">
            {quizSubmitting ? "Saving…" : "Create Quiz"}
          </button>
        </>}>
        <form onSubmit={handleSaveQuiz} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Title *</label>
              <input value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} title="Quiz title" className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none" />
            </div>
            <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Type</label>
              <select value={quizForm.quizType} onChange={(e) => setQuizForm({ ...quizForm, quizType: e.target.value as IepodQuizType })} title="Quiz type" className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow">
                {(Object.keys(QUIZ_TYPE_LABELS) as IepodQuizType[]).map((t) => <option key={t} value={t}>{QUIZ_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Description</label>
            <textarea value={quizForm.description || ""} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })} title="Quiz description" rows={2} className="w-full border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy bg-snow focus:outline-none resize-none" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={quizForm.isLive} onChange={(e) => setQuizForm({ ...quizForm, isLive: e.target.checked })} title="Publish immediately" className="w-4 h-4 accent-lime" />
            <span className="font-bold text-xs text-navy">Publish immediately</span>
          </label>
          {/* Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="font-display font-black text-sm text-navy">Questions ({quizQuestions.length})</h5>
              <button type="button" onClick={addQuizQuestion} className="bg-navy text-lime font-bold text-xs px-3 py-1.5 rounded-lg press-2 press-lime">+ Add Question</button>
            </div>
            {quizQuestions.map((q, qi) => (
              <div key={qi} className="bg-ghost border-[3px] border-cloud rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-black text-xs text-navy">Q{qi + 1}</span>
                  <button type="button" onClick={() => removeQuizQuestion(qi)} className="text-coral text-xs font-bold hover:underline">Remove</button>
                </div>
                <input value={q.question} onChange={(e) => updateQuizQuestion(qi, "question", e.target.value)} placeholder="Question text…" className="w-full border-2 border-cloud rounded-lg px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${qi}`} checked={q.correctIndex === oi} onChange={() => updateQuizQuestion(qi, "correctIndex", oi)} title={`Mark option ${String.fromCharCode(65 + oi)} correct`} className="accent-teal" />
                      <input value={opt} onChange={(e) => { const opts = [...q.options]; opts[oi] = e.target.value; updateQuizQuestion(qi, "options", opts); }} placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        className="flex-1 border-2 border-cloud rounded-lg px-3 py-1.5 text-xs text-navy focus:border-navy focus:outline-none" />
                    </div>
                  ))}
                </div>
                <div><label className="text-[10px] text-slate block">Points</label>
                  <input type="number" value={q.points} min={1} max={100} onChange={(e) => updateQuizQuestion(qi, "points", Number(e.target.value))} title="Points" className="w-20 border-2 border-cloud rounded-lg px-2 py-1 text-xs text-navy focus:border-navy focus:outline-none" />
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      {/* Submission Review Modal */}
      <Modal isOpen={!!reviewingSub} onClose={() => setReviewingSub(null)} title={`Review — ${reviewingSub?.title ?? ""}`} size="lg"
        footer={<>
          <button onClick={() => setReviewingSub(null)} className="px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors">Cancel</button>
          <button onClick={handleReviewSubmission} disabled={reviewSubmitting} className="px-5 py-2.5 rounded-2xl border-[3px] border-navy bg-teal text-snow text-sm font-bold transition-all disabled:opacity-50">
            {reviewSubmitting ? "Saving…" : "Save Review"}
          </button>
        </>}>
        <div className="space-y-4">
          {reviewingSub && (
            <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud space-y-2">
              <p className="text-xs text-slate">Team: <span className="font-bold text-navy">{reviewingSub.teamName}</span> · Iteration #{reviewingSub.iterationNumber}</p>
              <p className="text-sm text-navy-muted">{reviewingSub.description}</p>
              <details><summary className="text-xs text-lavender font-bold cursor-pointer">Process Log</summary>
                <p className="text-xs text-navy-muted mt-1">{reviewingSub.processLog}</p>
              </details>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Status</label>
              <select value={reviewForm.status} onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value as IepodSubmissionStatus })} title="Review status" className="w-full border-[3px] border-navy rounded-xl px-3 py-2 text-sm text-navy bg-snow">
                {(["reviewed", "finalist"] as IepodSubmissionStatus[]).map((s) => <option key={s} value={s}>{SUBMISSION_STATUS_STYLES[s].label}</option>)}
              </select>
            </div>
            <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Score (0-100)</label>
              <input type="number" value={reviewForm.score} onChange={(e) => setReviewForm({ ...reviewForm, score: e.target.value })} min={0} max={100} title="Score" className="w-full border-[3px] border-navy rounded-xl px-3 py-2 text-sm text-navy bg-snow focus:outline-none" />
            </div>
          </div>
          <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Feedback</label>
            <textarea value={reviewForm.feedback} onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })} placeholder="Feedback…" rows={3} className="w-full border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy bg-snow focus:outline-none resize-none" />
          </div>
        </div>
      </Modal>

      {/* Niche Audit Detail Modal */}
      <Modal isOpen={!!viewingAudit} onClose={() => setViewingAudit(null)} title={viewingAudit ? `${viewingAudit.userName}'s Niche Audit` : ""} size="lg">
        {viewingAudit && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-ghost rounded-xl p-3 border-2 border-cloud">
                <p className="text-[10px] font-bold text-slate uppercase mb-1">Focus Problem</p>
                <p className="text-sm text-navy">{viewingAudit.focusProblem}</p>
              </div>
              <div className="bg-ghost rounded-xl p-3 border-2 border-cloud">
                <p className="text-[10px] font-bold text-slate uppercase mb-1">Target Audience</p>
                <p className="text-sm text-navy">{viewingAudit.targetAudience}</p>
              </div>
              <div className="bg-ghost rounded-xl p-3 border-2 border-cloud">
                <p className="text-[10px] font-bold text-slate uppercase mb-1">Constraints</p>
                <p className="text-sm text-navy">{viewingAudit.constraints}</p>
              </div>
              <div className="bg-ghost rounded-xl p-3 border-2 border-cloud">
                <p className="text-[10px] font-bold text-slate uppercase mb-1">Proposed Approach</p>
                <p className="text-sm text-navy">{viewingAudit.proposedApproach}</p>
              </div>
            </div>
            {viewingAudit.relevantSkills.length > 0 && (
              <div className="bg-ghost rounded-xl p-3 border-2 border-cloud">
                <p className="text-[10px] font-bold text-slate uppercase mb-1">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {viewingAudit.relevantSkills.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-lime-light text-navy text-[10px] font-bold">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {viewingAudit.inspirations && (
              <div className="bg-ghost rounded-xl p-3 border-2 border-cloud">
                <p className="text-[10px] font-bold text-slate uppercase mb-1">Inspirations</p>
                <p className="text-sm text-navy-muted">{viewingAudit.inspirations}</p>
              </div>
            )}
            <p className="text-xs text-slate">Submitted {formatDate(viewingAudit.submittedAt)}</p>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmModal isOpen={!!deleteTarget} title={`Delete ${deleteTarget.type === "society" ? "Society" : "Quiz"}`}
          message={`Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete" variant="danger" onConfirm={handleDeleteConfirm} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════ */

function OverviewTab({ stats, loading }: { stats: IepodStats | null; loading: boolean }) {
  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (<div key={i} className="bg-snow border-[3px] border-cloud rounded-2xl p-6 animate-pulse"><div className="h-4 bg-cloud rounded w-1/2 mb-2" /><div className="h-8 bg-cloud rounded w-1/3" /></div>))}
    </div>
  );
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Registrations" value={stats.totalRegistrations} bg="bg-lime-light" />
        <StatCard label="Pending" value={stats.pending} bg="bg-sunny-light" />
        <StatCard label="Approved" value={stats.approved} bg="bg-teal-light" />
        <StatCard label="Rejected" value={stats.rejected} bg="bg-coral-light" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Phase Breakdown */}
        <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
          <h3 className="font-display font-black text-base text-navy mb-3">Phase Breakdown</h3>
          <div className="space-y-3">
            {(["stimulate", "carve", "pitch"] as IepodPhase[]).map((p) => (
              <div key={p} className="flex items-center justify-between">
                <span className="font-bold text-sm text-navy">{PHASE_LABELS[p]}</span>
                <span className="font-display font-black text-lg text-navy">{stats.phases[p]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
          <h3 className="font-display font-black text-base text-navy mb-3">Resources</h3>
          <div className="space-y-3">
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

        {/* Society members */}
        <div className="bg-navy border-4 border-lime rounded-3xl p-6 shadow-[6px_6px_0_0_#C8F31D]">
          <h3 className="font-display font-black text-base text-lime mb-3">Society Members</h3>
          <div className="space-y-3">
            {stats.societyBreakdown.map((s) => (
              <div key={s.societyId} className="flex items-center justify-between">
                <span className="font-bold text-sm text-lime/80">{s.societyName}</span>
                <span className="font-display font-black text-lg text-lime">{s.memberCount}</span>
              </div>
            ))}
            {stats.societyBreakdown.length === 0 && <p className="text-lime/50 text-sm">No societies yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   REGISTRATIONS TAB
   ═══════════════════════════════════════════════════ */

function RegistrationsTab({ registrations, total, loading, subTab, setSubTab, phase, setPhase, department, setDepartment, search, setSearch, page, setPage, onUpdateStatus }: {
  registrations: IepodRegistration[]; total: number; loading: boolean;
  subTab: string; setSubTab: (s: string) => void;
  phase: string; setPhase: (s: string) => void;
  department: string; setDepartment: (s: string) => void;
  search: string; setSearch: (s: string) => void;
  page: number; setPage: (p: number) => void;
  onUpdateStatus: (id: string, status: IepodRegistrationStatus) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {REG_SUB_TABS.map((st) => (
          <button key={st} onClick={() => setSubTab(st)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${subTab === st ? "bg-navy text-snow" : "bg-cloud text-navy hover:bg-navy/10"}`}>
            {st}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search by name or email…" /></div>
        <select value={phase} onChange={(e) => setPhase(e.target.value)} title="Phase filter" className="border-[3px] border-cloud rounded-xl px-3 py-2 text-xs font-medium text-navy bg-ghost focus:border-navy focus:outline-none">
          <option value="">All Phases</option>
          {(["stimulate", "carve", "pitch"] as IepodPhase[]).map((p) => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
        </select>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} title="Department filter" className="border-[3px] border-cloud rounded-xl px-3 py-2 text-xs font-medium text-navy bg-ghost focus:border-navy focus:outline-none">
          <option value="">All Depts</option>
          <option value="ipe">IPE Only</option>
          <option value="external">External Only</option>
        </select>
      </div>

      <p className="text-xs text-slate">{total} registration{total !== 1 ? "s" : ""}</p>

      {loading ? <Spinner /> : registrations.length === 0 ? <EmptyState message={`No ${subTab} registrations`} /> : (
        <div className="space-y-3">
          {registrations.map((r) => {
            const statusStyle = REG_STATUS_STYLES[r.status];
            return (
              <div key={r._id} className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-display font-black text-sm text-navy">{r.userName}</h4>
                    <p className="text-slate text-xs">{r.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${statusStyle.bg} ${statusStyle.text}`}>{statusStyle.label}</span>
                    {r.level && <span className="px-2 py-0.5 rounded-md bg-ghost border border-cloud text-[10px] font-bold text-slate">{r.level}</span>}
                    {r.isExternalStudent ? (
                      <span className="px-2 py-0.5 rounded-md bg-sunny-light border border-sunny text-[10px] font-bold text-navy">External</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-teal-light border border-teal text-[10px] font-bold text-navy">IPE</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate mb-2">
                  <span>{PHASE_LABELS[r.phase]}</span><span>·</span>
                  <span>{r.points} pts</span><span>·</span>
                  <span>{formatDate(r.createdAt)}</span>
                  {r.isExternalStudent && r.department && (<><span>·</span><span className="text-sunny font-bold">{r.department}</span></>)}
                </div>
                <p className="text-xs text-navy-muted mb-1"><strong>Interests:</strong> {r.interests.join(", ")}</p>
                <details className="mb-2">
                  <summary className="text-lavender text-xs font-bold cursor-pointer">Why Join</summary>
                  <p className="text-navy-muted text-xs mt-1">{r.whyJoin}</p>
                </details>
                {r.status === "pending" && (
                  <PermissionGate permission="iepod:manage">
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => onUpdateStatus(r._id, "approved")} className="bg-teal border-[3px] border-navy text-snow font-bold text-xs px-4 py-1.5 rounded-xl press-2 press-navy transition-all">Approve</button>
                      <button onClick={() => onUpdateStatus(r._id, "rejected")} className="bg-coral border-[3px] border-navy text-snow font-bold text-xs px-4 py-1.5 rounded-xl press-2 press-navy transition-all">Reject</button>
                    </div>
                  </PermissionGate>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPage={setPage} className="mt-4" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SOCIETIES TAB
   ═══════════════════════════════════════════════════ */

function SocietiesTab({ societies, loading, onAdd, onEdit, onDelete }: {
  societies: Society[]; loading: boolean;
  onAdd: () => void; onEdit: (s: Society) => void; onDelete: (s: Society) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-display font-black text-lg text-navy">Societies <span className="text-sm font-medium text-slate">({societies.length})</span></h3>
        <PermissionGate permission="iepod:manage">
          <button onClick={onAdd} className="bg-lime border-[3px] border-navy press-3 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all">Add Society</button>
        </PermissionGate>
      </div>
      {loading ? <Spinner /> : societies.length === 0 ? <EmptyState message="No societies yet" /> : (
        <div className="grid md:grid-cols-2 gap-4">
          {societies.map((s) => (
            <div key={s._id} className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-sm border border-cloud`} data-color={s.color}>
                    <div className="w-full h-full rounded-sm" aria-hidden="true" ref={(el) => { if (el) el.style.backgroundColor = s.color; }} />
                  </div>
                  <h4 className="font-display font-black text-sm text-navy">{s.name}</h4>
                  <span className="text-[10px] text-slate font-bold">({s.shortName})</span>
                </div>
                <span className={`font-bold text-[10px] px-2 py-0.5 rounded-lg ${s.isActive ? "bg-teal-light text-teal" : "bg-coral-light text-coral"}`}>
                  {s.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-navy-muted text-xs mb-1">{s.focusArea}</p>
              <p className="text-xs text-slate mb-3">{s.memberCount} member{s.memberCount !== 1 ? "s" : ""}</p>
              <PermissionGate permission="iepod:manage">
                <div className="flex gap-3">
                  <button onClick={() => onEdit(s)} className="text-lavender font-bold text-xs hover:underline">Edit</button>
                  <button onClick={() => onDelete(s)} className="text-coral font-bold text-xs hover:underline">Delete</button>
                </div>
              </PermissionGate>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   QUIZZES TAB
   ═══════════════════════════════════════════════════ */

function QuizzesTab({ quizzes, loading, onAdd, onToggleLive, onDelete, onViewResults, showResultsQuizId, quizResults }: {
  quizzes: IepodQuiz[]; loading: boolean;
  onAdd: () => void;
  onToggleLive: (q: IepodQuiz) => void;
  onDelete: (q: IepodQuiz) => void;
  onViewResults: (quizId: string) => void;
  showResultsQuizId: string | null;
  quizResults: QuizResult[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-display font-black text-lg text-navy">Quizzes <span className="text-sm font-medium text-slate">({quizzes.length})</span></h3>
        <PermissionGate permission="iepod:manage">
          <button onClick={onAdd} className="bg-lime border-[3px] border-navy press-3 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all">Create Quiz</button>
        </PermissionGate>
      </div>
      {loading ? <Spinner /> : quizzes.length === 0 ? <EmptyState message="No quizzes created yet" /> : (
        <div className="space-y-3">
          {quizzes.map((q) => {
            const qId = q._id || q.id || "";
            const isShowingResults = showResultsQuizId === qId;
            return (
              <div key={qId} className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-display font-black text-sm text-navy">{q.title}</h4>
                    <p className="text-slate text-[10px]">{QUIZ_TYPE_LABELS[q.quizType]} · {q.questionCount ?? q.questions?.length ?? 0} questions · {q.participantCount ?? 0} participants</p>
                  </div>
                  <span className={`font-bold text-[10px] px-2 py-0.5 rounded-lg ${q.isLive ? "bg-teal-light text-teal" : "bg-cloud text-slate"}`}>{q.isLive ? "Live" : "Draft"}</span>
                </div>
                <div className="flex gap-3">
                  <PermissionGate permission="iepod:manage">
                    <button onClick={() => onToggleLive(q)} className="text-lavender font-bold text-xs hover:underline">{q.isLive ? "Unpublish" : "Publish"}</button>
                    <button onClick={() => onDelete(q)} className="text-coral font-bold text-xs hover:underline">Delete</button>
                  </PermissionGate>
                  <button onClick={() => onViewResults(qId)} className="text-teal font-bold text-xs hover:underline">{isShowingResults ? "Hide" : "View"} Results</button>
                </div>
                {isShowingResults && (
                  <div className="mt-3 pt-3 border-t-[3px] border-cloud space-y-2">
                    {quizResults.length === 0 ? <p className="text-sm text-slate">No results yet.</p> : (
                      quizResults.map((r, i) => (
                        <div key={r._id} className="flex items-center justify-between bg-ghost rounded-xl px-4 py-2 border-2 border-cloud">
                          <div className="flex items-center gap-3">
                            <span className={`font-display font-black text-sm w-6 text-center ${i === 0 ? "text-sunny" : i === 1 ? "text-slate" : i === 2 ? "text-coral" : "text-navy/40"}`}>#{i + 1}</span>
                            <span className="font-bold text-sm text-navy">{r.userName}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-display font-black text-sm text-navy">{r.score}/{r.maxScore}</span>
                            <span className="text-[10px] text-slate ml-2">({r.percentage}%)</span>
                          </div>
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TEAMS TAB
   ═══════════════════════════════════════════════════ */

function TeamsTab({ teams, loading, search, setSearch, mentorInput, setMentorInput, onAssignMentor }: {
  teams: IepodTeam[]; loading: boolean;
  search: string; setSearch: (s: string) => void;
  mentorInput: Record<string, string>; setMentorInput: (v: Record<string, string>) => void;
  onAssignMentor: (teamId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="font-display font-black text-lg text-navy">Teams <span className="text-sm font-medium text-slate">({teams.length})</span></h3>
        <div className="w-64"><SearchInput value={search} onChange={setSearch} placeholder="Search teams…" /></div>
      </div>
      {loading ? <Spinner /> : teams.length === 0 ? <EmptyState message="No teams yet" /> : (
        <div className="space-y-3">
          {teams.map((t) => (
            <div key={t._id} className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-display font-black text-sm text-navy">{t.name}</h4>
                  <p className="text-slate text-[10px]">{t.members.length}/{t.maxMembers} members · {t.submissionCount} submissions</p>
                </div>
                <span className={`${TEAM_STATUS_STYLES[t.status].bg} ${TEAM_STATUS_STYLES[t.status].text} font-bold text-[10px] px-2 py-0.5 rounded-lg`}>{TEAM_STATUS_STYLES[t.status].label}</span>
              </div>
              <p className="text-navy-muted text-xs mb-2 line-clamp-1">{t.problemStatement}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {t.members.map((m) => (
                  <span key={m.userId} className="bg-ghost text-navy font-bold text-[10px] px-2 py-0.5 rounded-lg border border-cloud">{m.userName} <span className="text-slate">({m.role})</span></span>
                ))}
              </div>
              {t.mentorName ? (
                <span className="bg-lavender-light text-lavender font-bold text-[10px] px-2 py-0.5 rounded-lg">Mentor: {t.mentorName}</span>
              ) : (
                <PermissionGate permission="iepod:manage">
                  <div className="flex gap-2 items-center">
                    <input value={mentorInput[t._id] || ""} onChange={(e) => setMentorInput({ ...mentorInput, [t._id]: e.target.value })} placeholder="Mentor user ID…"
                      className="border-2 border-cloud rounded-lg px-3 py-1.5 text-xs text-navy focus:border-navy focus:outline-none w-44" />
                    <button onClick={() => onAssignMentor(t._id)} className="bg-teal border-2 border-navy text-snow font-bold text-[10px] px-3 py-1.5 rounded-lg press-2 press-navy transition-all">Assign</button>
                  </div>
                </PermissionGate>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SUBMISSIONS TAB
   ═══════════════════════════════════════════════════ */

function SubmissionsTab({ submissions, loading, statusFilter, setStatusFilter, onReview }: {
  submissions: IepodSubmission[]; loading: boolean;
  statusFilter: string; setStatusFilter: (s: string) => void;
  onReview: (sub: IepodSubmission) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-display font-black text-lg text-navy">Submissions <span className="text-sm font-medium text-slate">({submissions.length})</span></h3>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} title="Status filter"
          className="border-[3px] border-cloud rounded-xl px-3 py-1.5 text-xs font-medium text-navy bg-ghost focus:border-navy focus:outline-none">
          <option value="">All Status</option>
          {(Object.keys(SUBMISSION_STATUS_STYLES) as IepodSubmissionStatus[]).map((s) => <option key={s} value={s}>{SUBMISSION_STATUS_STYLES[s].label}</option>)}
        </select>
      </div>
      {loading ? <Spinner /> : submissions.length === 0 ? <EmptyState message="No submissions yet" /> : (
        <div className="space-y-3">
          {submissions.map((sub) => {
            const style = SUBMISSION_STATUS_STYLES[sub.status];
            return (
              <div key={sub._id} className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-display font-black text-sm text-navy">{sub.title}</h4>
                    <p className="text-slate text-[10px]">Team: {sub.teamName} · Iter #{sub.iterationNumber} · {formatDate(sub.submittedAt)}</p>
                  </div>
                  <span className={`${style.bg} ${style.text} font-bold text-[10px] px-2 py-0.5 rounded-lg`}>{style.label}</span>
                </div>
                <p className="text-navy-muted text-xs mb-2 line-clamp-2">{sub.description}</p>
                {sub.feedback && <p className="text-xs text-navy-muted bg-ghost p-2 rounded-lg border-2 border-cloud italic mb-2">{sub.feedback} {sub.score != null && <span className="not-italic font-bold text-navy"> — Score: {sub.score}/100</span>}</p>}
                <PermissionGate permission="iepod:manage">
                  <button onClick={() => onReview(sub)} className="text-lavender font-bold text-xs hover:underline">Review</button>
                </PermissionGate>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   NICHE AUDITS TAB
   ═══════════════════════════════════════════════════ */

function NicheAuditsTab({ audits, total, loading, search, setSearch, page, setPage, onView }: {
  audits: NicheAudit[]; total: number; loading: boolean;
  search: string; setSearch: (s: string) => void;
  page: number; setPage: (p: number) => void;
  onView: (a: NicheAudit) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="font-display font-black text-lg text-navy">Niche Audits <span className="text-sm font-medium text-slate">({total})</span></h3>
        <div className="w-64"><SearchInput value={search} onChange={setSearch} placeholder="Search audits…" /></div>
      </div>
      {loading ? <Spinner /> : audits.length === 0 ? <EmptyState message="No niche audits submitted yet" /> : (
        <div className="space-y-3">
          {audits.map((a) => (
            <div key={a._id} className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[4px_4px_0_0_#000]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-display font-black text-sm text-navy">{a.userName}</h4>
                  <p className="text-slate text-[10px]">{formatDate(a.submittedAt)}</p>
                </div>
                <button onClick={() => onView(a)} className="bg-lavender-light border-[3px] border-navy text-navy text-xs font-bold px-4 py-1.5 rounded-xl press-2 press-navy transition-all">View Details</button>
              </div>
              <p className="text-navy-muted text-xs line-clamp-2">{a.focusProblem}</p>
              {a.relevantSkills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {a.relevantSkills.slice(0, 5).map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-lime-light text-navy text-[10px] font-bold">{s}</span>
                  ))}
                  {a.relevantSkills.length > 5 && <span className="text-[10px] text-slate">+{a.relevantSkills.length - 5} more</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPage={setPage} className="mt-4" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   POINTS TAB
   ═══════════════════════════════════════════════════ */

function PointsTab({ leaderboard, bonusUserId, setBonusUserId, bonusPoints, setBonusPoints, bonusDesc, setBonusDesc, bonusSubmitting, onAwardBonus }: {
  leaderboard: LeaderboardEntry[];
  bonusUserId: string; setBonusUserId: (s: string) => void;
  bonusPoints: string; setBonusPoints: (s: string) => void;
  bonusDesc: string; setBonusDesc: (s: string) => void;
  bonusSubmitting: boolean;
  onAwardBonus: (e: React.FormEvent) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Award bonus */}
      <PermissionGate permission="iepod:manage">
        <div className="bg-lime-light border-4 border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
          <h3 className="font-display font-black text-base text-navy mb-4">Award Bonus Points</h3>
          <form onSubmit={onAwardBonus} className="flex flex-col sm:flex-row gap-3">
            <input value={bonusUserId} onChange={(e) => setBonusUserId(e.target.value)} placeholder="User ID"
              className="flex-1 border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none" />
            <input type="number" value={bonusPoints} onChange={(e) => setBonusPoints(e.target.value)} placeholder="Points" min={1}
              className="w-24 border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none" />
            <input value={bonusDesc} onChange={(e) => setBonusDesc(e.target.value)} placeholder="Reason"
              className="flex-1 border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none" />
            <button type="submit" disabled={bonusSubmitting}
              className="bg-lime border-[3px] border-navy press-3 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all disabled:opacity-50 whitespace-nowrap">
              {bonusSubmitting ? "…" : "Award"}
            </button>
          </form>
        </div>
      </PermissionGate>

      {/* Leaderboard */}
      <div className="bg-navy border-4 border-lime rounded-3xl p-6 shadow-[6px_6px_0_0_#C8F31D]">
        <h3 className="font-display font-black text-lg text-lime mb-4">Full Leaderboard</h3>
        <div className="space-y-2">
          {leaderboard.map((entry) => (
            <div key={entry.userId} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-navy-light">
              <span className={`font-display font-black text-sm w-8 text-center ${entry.rank === 1 ? "text-sunny" : entry.rank === 2 ? "text-cloud" : entry.rank === 3 ? "text-coral" : "text-lime/40"}`}>#{entry.rank}</span>
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
          {leaderboard.length === 0 && <p className="text-lime/50 text-sm text-center py-8">No rankings yet</p>}
        </div>
      </div>
    </div>
  );
}

export default withAuth(AdminIepodPage, {
  anyPermission: ["iepod:manage", "iepod:view"],
});
