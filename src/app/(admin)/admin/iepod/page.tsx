"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { useAuth } from "@/context/AuthContext";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import {
  getWsUrl,
  getIepodStats,
  listRegistrations,
  updateRegistration,
  listSocieties,
  createSociety,
  updateSociety,
  deleteSociety,
  listQuizzes,
  createQuiz,
  startLiveQuizSession,
  advanceLiveQuizQuestion,
  getLiveQuizParticipants,
  pauseLiveQuizSession,
  resumeLiveQuizSession,
  getLiveQuizState,
  forceResyncLiveQuiz,
  getLiveQuizReplay,
  revealLiveQuizFinalTop3,
  endLiveQuizSession,
  updateQuiz,
  deleteQuiz,
  listAllSubmissions,
  reviewSubmission,
  listTeams,
  assignMentor,
  awardBonusPoints,
  getLeaderboardAdmin,
  getQuizSystemLeaderboardAdmin,
  searchIepodMembers,
  listBonusPointHistory,
  reverseBonusPoints,
  resetIepodUserData,
  listNicheAudits,
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
  QuizSystemLeaderboardEntry,
  IepodRegistrationStatus,
  IepodPhase,
  IepodSubmissionStatus,
  IepodQuizType,
  QuizQuestion,
  CreateSocietyData,
  CreateQuizData,
  NicheAudit,
  LiveQuizState,
  LiveLeaderboardItem,
  LiveParticipant,
  LiveReplayResponse,
  LiveQuizWsPacket,
  IepodMemberLookupEntry,
  BonusHistoryItem,
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
const TAB_KEY_SET = new Set<Tab>(TABS.map((t) => t.key));
const REG_SUB_TABS = ["pending", "approved", "rejected"] as const;
const PAGE_SIZE = 20;
const POINTS_PAGE_SIZE = 20;

function parseAdminIepodTab(value: string | null): Tab {
  return value && TAB_KEY_SET.has(value as Tab) ? (value as Tab) : "overview";
}

/* ─── Helpers ──────────────────────────────────── */
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}
function csvEscape(value: string | number | null | undefined) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
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

export function AdminIepodPage() {
  const { getAccessToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => parseAdminIepodTab(searchParams.get("tab")));
  const tabSyncReadyRef = useRef(false);
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
  const [quizForm, setQuizForm] = useState<CreateQuizData>({
    title: "",
    quizType: "general" as IepodQuizType,
    questions: [],
    isLive: false,
    intermissionSeconds: 8,
    revealResultsSeconds: 6,
    autoAdvance: true,
  });
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizDefaultQuestionTimer, setQuizDefaultQuestionTimer] = useState(20);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [liveJoinByQuizId, setLiveJoinByQuizId] = useState<Record<string, string>>({});
  const [liveActionByQuizId, setLiveActionByQuizId] = useState<Record<string, "start" | "startQuestion" | "pause" | "resume" | "reveal" | "end" | "resync" | null>>({});
  const [endedLiveByQuizId, setEndedLiveByQuizId] = useState<Record<string, boolean>>({});
  const [liveStateByCode, setLiveStateByCode] = useState<Record<string, LiveQuizState & { leaderboard?: LiveLeaderboardItem[]; finalPodiumRevealed?: boolean }>>({});
  const [liveParticipantsByCode, setLiveParticipantsByCode] = useState<Record<string, LiveParticipant[]>>({});
  const [liveWsStatusByCode, setLiveWsStatusByCode] = useState<Record<string, "connecting" | "open" | "closed">>({});
  const [hostReceiptByQuizId, setHostReceiptByQuizId] = useState<Record<string, { action: string; actionId?: string; ackAt?: string }>>({});
  const liveWsRef = useRef<Record<string, WebSocket>>({});
  const liveReconnectRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const liveHeartbeatRef = useRef<Record<string, ReturnType<typeof setInterval> | null>>({});
  const liveStateVersionByCodeRef = useRef<Record<string, number>>({});

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
  const [pointsView, setPointsView] = useState<"general" | "quiz" | "bonus-history">("general");
  const [pointsPage, setPointsPage] = useState(1);
  const [pointsTotal, setPointsTotal] = useState(0);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [quizLeaderboard, setQuizLeaderboard] = useState<QuizSystemLeaderboardEntry[]>([]);
  const [bonusHistory, setBonusHistory] = useState<BonusHistoryItem[]>([]);
  const [reversingPointId, setReversingPointId] = useState<string | null>(null);
  const [bonusUserId, setBonusUserId] = useState("");
  const [bonusUserSearch, setBonusUserSearch] = useState("");
  const [bonusMemberOptions, setBonusMemberOptions] = useState<IepodMemberLookupEntry[]>([]);
  const [bonusMemberSearchLoading, setBonusMemberSearchLoading] = useState(false);
  const [bonusPoints, setBonusPoints] = useState("");
  const [bonusDesc, setBonusDesc] = useState("");
  const [bonusSubmitting, setBonusSubmitting] = useState(false);
  const [showResetUserModal, setShowResetUserModal] = useState(false);
  const [resetTargetMember, setResetTargetMember] = useState<IepodMemberLookupEntry | null>(null);
  const [resetReason, setResetReason] = useState("");
  const [resetBlockRejoin, setResetBlockRejoin] = useState(true);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  /* ── Reset pages on filter change ── */
  useEffect(() => { setRegPage(1); }, [regSubTab, regPhase, regSearch, regDept]);
  useEffect(() => { setNichePage(1); }, [nicheSearch]);
  useEffect(() => { setPointsPage(1); }, [pointsView]);

  /* ── Keep tab in sync with URL (?tab=quizzes) ── */
  useEffect(() => {
    const nextTab = parseAdminIepodTab(searchParams.get("tab"));
    tabSyncReadyRef.current = true;
    setTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [searchParams]);

  useEffect(() => {
    if (!tabSyncReadyRef.current) return;
    const normalizedCurrent = parseAdminIepodTab(searchParams.get("tab"));
    if (normalizedCurrent === tab) return;

    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [tab, searchParams, router, pathname]);

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
    try {
      const data = await listQuizzes();
      setQuizzes(data);
      const restored: Record<string, string> = {};
      data.forEach((quiz) => {
        const qId = quiz._id || quiz.id;
        if (qId && quiz.activeLiveJoinCode) {
          restored[qId] = quiz.activeLiveJoinCode;
        }
      });
      if (Object.keys(restored).length > 0) {
        setLiveJoinByQuizId((prev) => ({ ...restored, ...prev }));
      }
    } catch (err) { toast.error(getErrorMessage(err, "Failed to load quizzes")); } finally { setQuizLoading(false); }
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

  const fetchPointsPanel = useCallback(async () => {
    setPointsLoading(true);
    try {
      const skip = (pointsPage - 1) * POINTS_PAGE_SIZE;
      if (pointsView === "general") {
        const res = await getLeaderboardAdmin(POINTS_PAGE_SIZE, skip);
        setLeaderboard(res.items);
        setPointsTotal(res.total);
      } else if (pointsView === "quiz") {
        const res = await getQuizSystemLeaderboardAdmin(POINTS_PAGE_SIZE, skip);
        setQuizLeaderboard(res.items);
        setPointsTotal(res.total);
      } else {
        const res = await listBonusPointHistory(POINTS_PAGE_SIZE, skip);
        setBonusHistory(res.items);
        setPointsTotal(res.total);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load points panel"));
    } finally {
      setPointsLoading(false);
    }
  }, [pointsPage, pointsView]);

  const clearLocalLiveSession = useCallback((quizId: string, joinCode: string) => {
    setLiveJoinByQuizId((prev) => {
      if (!prev[quizId]) return prev;
      const next = { ...prev };
      delete next[quizId];
      return next;
    });
    setLiveStateByCode((prev) => {
      if (!prev[joinCode]) return prev;
      const next = { ...prev };
      delete next[joinCode];
      return next;
    });
    setLiveWsStatusByCode((prev) => {
      if (!prev[joinCode]) return prev;
      const next = { ...prev };
      delete next[joinCode];
      return next;
    });
    setLiveParticipantsByCode((prev) => {
      if (!prev[joinCode]) return prev;
      const next = { ...prev };
      delete next[joinCode];
      return next;
    });
    setEndedLiveByQuizId((prev) => ({ ...prev, [quizId]: true }));
  }, []);

  function rememberHostReceipt(quizId: string, action: string, data?: { actionId?: string; ackAt?: string }) {
    setHostReceiptByQuizId((prev) => ({
      ...prev,
      [quizId]: {
        action,
        actionId: data?.actionId,
        ackAt: data?.ackAt ?? new Date().toISOString(),
      },
    }));
  }

  async function runWithSilentTimeoutRetry<T>(runner: () => Promise<T>): Promise<T> {
    try {
      return await runner();
    } catch (err) {
      const msg = getErrorMessage(err, "Request failed");
      if (!/timed out|timeout|aborted/i.test(msg)) throw err;
      return await runner();
    }
  }

  const applyLiveStateForCode = useCallback((code: string, nextState: LiveQuizState & { leaderboard?: LiveLeaderboardItem[]; finalPodiumRevealed?: boolean }) => {
    const normalizedCode = code.trim().toUpperCase();
    const nextVersion = Number(nextState.stateVersion ?? 0);
    if (nextVersion > 0) {
      const currentVersion = liveStateVersionByCodeRef.current[normalizedCode] ?? 0;
      if (nextVersion < currentVersion) return false;
      liveStateVersionByCodeRef.current[normalizedCode] = nextVersion;
    }
    setLiveStateByCode((prev) => ({ ...prev, [normalizedCode]: nextState }));
    return true;
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
    if (tab === "points") fetchPointsPanel();
  }, [tab, fetchStats, fetchRegistrations, fetchSocieties, fetchQuizzes, fetchTeams, fetchSubmissions, fetchNicheAudits, fetchPointsPanel]);

  /* ── Filtered teams (client-side) ── */
  const filteredTeams = useMemo(() => {
    if (!teamSearch.trim()) return teams;
    const q = teamSearch.toLowerCase();
    return teams.filter(t => t.name.toLowerCase().includes(q) || t.problemStatement.toLowerCase().includes(q) || t.members.some(m => m.userName.toLowerCase().includes(q)));
  }, [teams, teamSearch]);

  useEffect(() => {
    if (tab !== "points") return;
    const search = bonusUserSearch.trim();
    if (search.length < 2) {
      setBonusMemberOptions([]);
      setResetTargetMember(null);
      return;
    }

    const timer = setTimeout(async () => {
      setBonusMemberSearchLoading(true);
      try {
        const res = await searchIepodMembers(search, 8);
        setBonusMemberOptions(res.items);
      } catch {
        setBonusMemberOptions([]);
      } finally {
        setBonusMemberSearchLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [bonusUserSearch, tab]);

  useEffect(() => {
    if (tab !== "quizzes") return;

    const activeCodes = new Set(
      Object.values(liveJoinByQuizId)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    );

    const cleanupCode = (code: string) => {
      const socket = liveWsRef.current[code];
      if (socket) {
        socket.onclose = null;
        socket.close();
        delete liveWsRef.current[code];
      }
      if (liveReconnectRef.current[code]) {
        clearTimeout(liveReconnectRef.current[code]!);
        liveReconnectRef.current[code] = null;
      }
      if (liveHeartbeatRef.current[code]) {
        clearInterval(liveHeartbeatRef.current[code]!);
        liveHeartbeatRef.current[code] = null;
      }
      setLiveWsStatusByCode((prev) => {
        const next = { ...prev };
        delete next[code];
        return next;
      });
      setLiveStateByCode((prev) => {
        const next = { ...prev };
        delete next[code];
        return next;
      });
    };

    Object.keys(liveWsRef.current).forEach((code) => {
      if (!activeCodes.has(code)) cleanupCode(code);
    });

    const connectCode = async (code: string, retryToken?: string) => {
      if (liveWsRef.current[code]) return;
      const token = retryToken ?? (await getAccessToken());
      if (!token) return;

      setLiveWsStatusByCode((prev) => ({ ...prev, [code]: "connecting" }));
      const wsUrl = getWsUrl(`/api/v1/iepod/quizzes/live/${encodeURIComponent(code)}/ws?token=${encodeURIComponent(token)}`);
      const ws = new WebSocket(wsUrl);
      liveWsRef.current[code] = ws;

      ws.onopen = () => {
        setLiveWsStatusByCode((prev) => ({ ...prev, [code]: "open" }));
        if (liveHeartbeatRef.current[code]) clearInterval(liveHeartbeatRef.current[code]!);
        liveHeartbeatRef.current[code] = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data) as LiveQuizWsPacket;
          if (packet.type !== "live_state") return;
          const data = packet.data;
          if (!data) return;
          applyLiveStateForCode(code, data);
        } catch {
          // Ignore malformed packets to keep host UI stable.
        }
      };

      ws.onclose = () => {
        setLiveWsStatusByCode((prev) => ({ ...prev, [code]: "closed" }));
        if (liveHeartbeatRef.current[code]) {
          clearInterval(liveHeartbeatRef.current[code]!);
          liveHeartbeatRef.current[code] = null;
        }
        delete liveWsRef.current[code];
        if (activeCodes.has(code)) {
          liveReconnectRef.current[code] = setTimeout(() => {
            void connectCode(code);
          }, 3000);
        }
      };

      ws.onerror = () => ws.close();
    };

    activeCodes.forEach((code) => {
      if (!liveWsRef.current[code]) {
        void connectCode(code);
      }
    });

  }, [liveJoinByQuizId, getAccessToken, tab]);

  useEffect(() => {
    return () => {
      Object.keys(liveWsRef.current).forEach((code) => {
        const socket = liveWsRef.current[code];
        if (socket) {
          socket.onclose = null;
          socket.close();
        }
        if (liveReconnectRef.current[code]) clearTimeout(liveReconnectRef.current[code]!);
        if (liveHeartbeatRef.current[code]) clearInterval(liveHeartbeatRef.current[code]!);
      });
    };
  }, []);

  useEffect(() => {
    if (tab !== "quizzes") return;
    const codes = Array.from(new Set(Object.values(liveJoinByQuizId).filter(Boolean)));
    if (codes.length === 0) return;

    let cancelled = false;
    const hydrateState = async () => {
      await Promise.all(
        codes.map(async (code) => {
          try {
            const next = await getLiveQuizState(code, { showErrorToast: false, timeout: 12000 });
            if (!cancelled) {
              applyLiveStateForCode(code, next);
            }
          } catch {
            // Ignore transient refresh errors; ws and subsequent polls will recover.
          }
        }),
      );
    };

    void hydrateState();
    const timer = setInterval(() => {
      void hydrateState();
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tab, liveJoinByQuizId]);

  useEffect(() => {
    if (tab !== "quizzes") return;
    const codes = Array.from(new Set(Object.values(liveJoinByQuizId).filter(Boolean)));
    if (codes.length === 0) return;

    let cancelled = false;
    const hydrateParticipants = async () => {
      await Promise.all(
        codes.map(async (code) => {
          try {
            const roster = await getLiveQuizParticipants(code, { showErrorToast: false, timeout: 12000 });
            if (!cancelled) {
              setLiveParticipantsByCode((prev) => ({ ...prev, [code]: roster.participants || [] }));
            }
          } catch {
            // Ignore transient participant refresh errors; next poll will reconcile.
          }
        }),
      );
    };

    void hydrateParticipants();
    const timer = setInterval(() => {
      void hydrateParticipants();
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tab, liveJoinByQuizId]);

  /* ── Handlers ── */
  async function handleUpdateRegistration(id: string, status: IepodRegistrationStatus, adminNote?: string, phase?: IepodPhase) {
    try { await updateRegistration(id, { status, adminNote, phase }); toast.success(`Registration ${status}`); fetchRegistrations(); } catch (err) { toast.error(getErrorMessage(err, "Failed to update registration")); }
  }

  async function handleStartQuestionOne(quiz: IepodQuiz) {
    const qId = quiz._id || quiz.id;
    if (!qId) return;
    if (liveActionByQuizId[qId]) return;
    const joinCode = liveJoinByQuizId[qId];
    if (!joinCode) {
      toast.error("No live session found for this quiz");
      return;
    }

    setLiveActionByQuizId((prev) => ({ ...prev, [qId]: "startQuestion" }));
    try {
      const expectedStateVersion = liveStateByCode[joinCode]?.stateVersion;
      const next = await runWithSilentTimeoutRetry(() => advanceLiveQuizQuestion(joinCode, {
        showErrorToast: false,
        timeout: 45000,
        actionId: crypto.randomUUID(),
        expectedStateVersion,
      }));
      const recovered = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 15000 });
      applyLiveStateForCode(joinCode, recovered);
      rememberHostReceipt(qId, "start-question-1", { actionId: next.actionId, ackAt: next.ackAt });
      toast.success("Question 1 started");
    } catch (err) {
      const errMsg = getErrorMessage(err, "Failed to start Question 1");
      const status = (typeof err === "object" && err !== null && "status" in err)
        ? Number((err as { status?: unknown }).status)
        : undefined;
      const staleOrConflict = status === 409 || /stale state|duplicate host action|conflict/i.test(errMsg);
      const timeoutLike = /timed out|timeout|aborted/i.test(errMsg);
      if (staleOrConflict) {
        try {
          const reconciled = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 15000 });
          applyLiveStateForCode(joinCode, reconciled);

          // If Question 1 already started (race between host action and state hydration), treat as success.
          if ((reconciled.currentQuestionIndex ?? -1) >= 0 || reconciled.status === "ended") {
            toast.success("Question 1 started");
            return;
          }

          // Retry once with fresh stateVersion after reconciliation.
          const retried = await runWithSilentTimeoutRetry(() => advanceLiveQuizQuestion(joinCode, {
            showErrorToast: false,
            timeout: 45000,
            actionId: crypto.randomUUID(),
            expectedStateVersion: reconciled.stateVersion,
          }));
          const recovered = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 15000 });
          applyLiveStateForCode(joinCode, recovered);
          rememberHostReceipt(qId, "start-question-1", { actionId: retried.actionId, ackAt: retried.ackAt });
          toast.success("Question 1 started");
          return;
        } catch {
          // Fall through to timeout/general handling below.
        }
      }
      if (timeoutLike) {
        try {
          const recovered = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 20000 });
          applyLiveStateForCode(joinCode, recovered);
          if ((recovered.currentQuestionIndex ?? -1) >= 0 || recovered.status === "ended") {
            toast.success("Question start applied (confirmed after timeout)");
            return;
          }
        } catch {
          // Fall through to the original error toast if reconciliation fails.
        }
      }
      toast.error(errMsg);
    } finally {
      setLiveActionByQuizId((prev) => ({ ...prev, [qId]: null }));
    }
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
      const normalizedQuestions = quizQuestions.map((question) => ({
        ...question,
        // Keep quiz scoring deterministic across quiz types.
        points: 10,
      }));
      await createQuiz({ ...quizForm, questions: normalizedQuestions, autoAdvance: true }); toast.success("Quiz created");
      await fetchQuizzes(); closeQuizModal();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to create quiz")); } finally { setQuizSubmitting(false); }
  }

  function closeQuizModal() {
    setShowQuizModal(false);
    setQuizForm({
      title: "",
      quizType: "general",
      questions: [],
      isLive: false,
      intermissionSeconds: 8,
      revealResultsSeconds: 6,
      autoAdvance: true,
    });
    setQuizQuestions([]);
    setQuizDefaultQuestionTimer(20);
  }

  async function handleToggleQuizLive(quiz: IepodQuiz) {
    const qId = quiz._id || quiz.id;
    if (!qId) return;
    try { await updateQuiz(qId, { isLive: !quiz.isLive }); toast.success(quiz.isLive ? "Quiz unpublished" : "Quiz published"); fetchQuizzes(); } catch (err) { toast.error(getErrorMessage(err, "Failed to update quiz")); }
  }

  async function handleStartLive(quiz: IepodQuiz) {
    const qId = quiz._id || quiz.id;
    if (!qId) return;
    if (liveActionByQuizId[qId]) return;
    setLiveActionByQuizId((prev) => ({ ...prev, [qId]: "start" }));
    try {
      const started = await runWithSilentTimeoutRetry(() => startLiveQuizSession(qId, 20, { showErrorToast: false, timeout: 45000 }));
      setEndedLiveByQuizId((prev) => {
        if (!prev[qId]) return prev;
        const next = { ...prev };
        delete next[qId];
        return next;
      });
      setLiveJoinByQuizId((prev) => ({ ...prev, [qId]: started.joinCode }));
      rememberHostReceipt(qId, "start-live", { actionId: started.actionId, ackAt: started.ackAt });
      try {
        const state = await getLiveQuizState(started.joinCode, { showErrorToast: false, timeout: 12000 });
        applyLiveStateForCode(started.joinCode, state);
      } catch {
        // WebSocket state push will hydrate shortly.
      }
      toast.success(`Live session started. Code: ${started.joinCode}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to start live session"));
    } finally {
      setLiveActionByQuizId((prev) => ({ ...prev, [qId]: null }));
    }
  }

  async function handleRevealLiveFinalTop3(quiz: IepodQuiz) {
    const qId = quiz._id || quiz.id;
    if (!qId) return;
    if (liveActionByQuizId[qId]) return;
    const joinCode = liveJoinByQuizId[qId];
    if (!joinCode) {
      toast.error("Start a live session first");
      return;
    }
    setLiveActionByQuizId((prev) => ({ ...prev, [qId]: "reveal" }));
    try {
      const cached = liveStateByCode[joinCode];
      const before = cached || await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 6000 });
      if (before.status !== "ended") {
        toast.info("Final Top 3 reveal is available after session end.");
        return;
      }
      if (before.finalPodiumRevealed) {
        toast.info("Final podium is already revealed.");
        return;
      }
      const expectedStateVersion = before.stateVersion;
      const revealed = await revealLiveQuizFinalTop3(joinCode, {
        showErrorToast: false,
        timeout: 20000,
        actionId: crypto.randomUUID(),
        expectedStateVersion,
      });
      applyLiveStateForCode(joinCode, {
        ...before,
        finalPodiumRevealed: true,
      });
      rememberHostReceipt(qId, "reveal-top-3", { actionId: revealed.actionId, ackAt: revealed.ackAt });
      toast.success("Final Top 3 reveal is now live");

      // Reconcile in background; do not block host success path on follow-up fetch latency.
      void (async () => {
        try {
          const recovered = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 8000 });
          applyLiveStateForCode(joinCode, recovered);
        } catch {
          // WebSocket push and subsequent polls will converge state.
        }
      })();
    } catch (err) {
      const optimistic = liveStateByCode[joinCode];
      if (optimistic?.finalPodiumRevealed) {
        rememberHostReceipt(qId, "reveal-top-3", { ackAt: new Date().toISOString() });
        toast.success("Final Top 3 reveal already applied");
        return;
      }
      const errMsg = getErrorMessage(err, "Failed to reveal final top 3");
      const status = (typeof err === "object" && err !== null && "status" in err)
        ? Number((err as { status?: unknown }).status)
        : undefined;
      const staleOrConflict = status === 409 || /stale state|duplicate host action|conflict/i.test(errMsg);
      const timeoutLike = /timed out|timeout|aborted/i.test(errMsg);

      if (staleOrConflict) {
        try {
          const reconciled = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 10000 });
          applyLiveStateForCode(joinCode, reconciled);

          if (reconciled.finalPodiumRevealed) {
            rememberHostReceipt(qId, "reveal-top-3", { ackAt: new Date().toISOString() });
            toast.success("Final Top 3 reveal already applied");
            return;
          }

          if (reconciled.status !== "ended") {
            toast.info("Final Top 3 reveal is available after session end.");
            return;
          }

          const retried = await revealLiveQuizFinalTop3(joinCode, {
            showErrorToast: false,
            timeout: 20000,
            actionId: crypto.randomUUID(),
            expectedStateVersion: reconciled.stateVersion,
          });
          const refreshed = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 10000 });
          applyLiveStateForCode(joinCode, refreshed);
          rememberHostReceipt(qId, "reveal-top-3", { actionId: retried.actionId, ackAt: retried.ackAt });
          toast.success("Final Top 3 reveal is now live");
          return;
        } catch {
          // Fall through to timeout/general handling.
        }
      }

      if (timeoutLike) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 1000));
          }
          const liveSnapshot = liveStateByCode[joinCode];
          if (liveSnapshot?.finalPodiumRevealed) {
            rememberHostReceipt(qId, "reveal-top-3", { ackAt: new Date().toISOString() });
            toast.success("Final Top 3 reveal applied");
            return;
          }
          try {
            const recovered = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 6000 });
            applyLiveStateForCode(joinCode, recovered);
            if (recovered.finalPodiumRevealed) {
              toast.success("Final Top 3 reveal applied (confirmed after timeout)");
              return;
            }
          } catch {
            // Keep trying a few times before showing the original timeout message.
          }
        }
      }
      toast.error(errMsg);
    } finally {
      setLiveActionByQuizId((prev) => ({ ...prev, [qId]: null }));
    }
  }

  async function handleEndLive(quiz: IepodQuiz) {
    const qId = quiz._id || quiz.id;
    if (!qId) return;
    if (liveActionByQuizId[qId]) return;
    const joinCode = liveJoinByQuizId[qId];
    if (!joinCode) {
      toast.error("No active live code found for this quiz");
      return;
    }
    setLiveActionByQuizId((prev) => ({ ...prev, [qId]: "end" }));
    try {
      const expectedStateVersion = liveStateByCode[joinCode]?.stateVersion;
      const ended = await runWithSilentTimeoutRetry(() => endLiveQuizSession(joinCode, {
        showErrorToast: false,
        timeout: 45000,
        actionId: crypto.randomUUID(),
        expectedStateVersion,
      }));
      rememberHostReceipt(qId, "end-session", { actionId: ended.actionId, ackAt: ended.ackAt });
      clearLocalLiveSession(qId, joinCode);
      void fetchQuizzes();
      toast.success("Live session ended");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to end live session"));
    } finally {
      setLiveActionByQuizId((prev) => ({ ...prev, [qId]: null }));
    }
  }

  async function handleForceResyncLive(quiz: IepodQuiz) {
    const qId = quiz._id || quiz.id;
    if (!qId) return;
    if (liveActionByQuizId[qId]) return;
    const joinCode = liveJoinByQuizId[qId];
    if (!joinCode) {
      toast.error("No active live code found for this quiz");
      return;
    }
    setLiveActionByQuizId((prev) => ({ ...prev, [qId]: "resync" }));
    try {
      const expectedStateVersion = liveStateByCode[joinCode]?.stateVersion;
      const res = await runWithSilentTimeoutRetry(() => forceResyncLiveQuiz(joinCode, {
        showErrorToast: false,
        timeout: 30000,
        actionId: crypto.randomUUID(),
        expectedStateVersion,
      }));
      const recovered = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 15000 });
      applyLiveStateForCode(joinCode, recovered);
      rememberHostReceipt(qId, "force-resync", { actionId: res.actionId, ackAt: res.ackAt });
      toast.success("Forced resync broadcast sent");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to force resync"));
    } finally {
      setLiveActionByQuizId((prev) => ({ ...prev, [qId]: null }));
    }
  }

  async function handleFetchReplay(quiz: IepodQuiz): Promise<LiveReplayResponse> {
    const qId = quiz._id || quiz.id;
    if (!qId) throw new Error("Missing quiz id");
    const joinCode = liveJoinByQuizId[qId] || quiz.activeLiveJoinCode;
    if (!joinCode) throw new Error("No live code found for this quiz");
    return getLiveQuizReplay(joinCode, { showErrorToast: false, timeout: 30000 });
  }

  async function handleTogglePauseLive(quiz: IepodQuiz) {
    const qId = quiz._id || quiz.id;
    if (!qId) return;
    if (liveActionByQuizId[qId]) return;
    const joinCode = liveJoinByQuizId[qId];
    if (!joinCode) {
      toast.error("No active live code found for this quiz");
      return;
    }

    const snapshot = liveStateByCode[joinCode];
    const wantPause = !snapshot?.isPaused;
    setLiveActionByQuizId((prev) => ({ ...prev, [qId]: wantPause ? "pause" : "resume" }));
    try {
      const expectedStateVersion = snapshot?.stateVersion;
      const fn = wantPause ? pauseLiveQuizSession : resumeLiveQuizSession;
      const res = await runWithSilentTimeoutRetry(() => fn(joinCode, {
        showErrorToast: false,
        timeout: 30000,
        actionId: crypto.randomUUID(),
        expectedStateVersion,
      }));
      if (snapshot) {
        applyLiveStateForCode(joinCode, {
          ...snapshot,
          isPaused: wantPause,
          pausedRemainingSeconds: wantPause
            ? Math.max(0, snapshot.phaseRemainingSeconds ?? snapshot.remainingSeconds ?? 0)
            : 0,
          phaseEndsAt: wantPause ? null : snapshot.phaseEndsAt,
        });
      }
      rememberHostReceipt(qId, wantPause ? "pause-session" : "resume-session", { actionId: res.actionId, ackAt: res.ackAt });
      toast.success(wantPause ? "Live timer paused" : "Live timer resumed");

      void (async () => {
        try {
          const recovered = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 12000 });
          applyLiveStateForCode(joinCode, recovered);
        } catch {
          // State hydration will retry via polling/ws.
        }
      })();
    } catch (err) {
      const errMsg = getErrorMessage(err, wantPause ? "Failed to pause live session" : "Failed to resume live session");
      const status = (typeof err === "object" && err !== null && "status" in err)
        ? Number((err as { status?: unknown }).status)
        : undefined;
      const staleOrConflict = status === 409 || /stale state|duplicate host action|conflict/i.test(errMsg);
      const timeoutLike = /timed out|timeout|aborted/i.test(errMsg);

      if (staleOrConflict) {
        try {
          const reconciled = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 10000 });
          applyLiveStateForCode(joinCode, reconciled);

          // If desired state already applied by a racing request, treat as success.
          if (Boolean(reconciled.isPaused) === wantPause) {
            toast.success(wantPause ? "Live timer paused" : "Live timer resumed");
            return;
          }

          const fnRetry = wantPause ? pauseLiveQuizSession : resumeLiveQuizSession;
          const retried = await runWithSilentTimeoutRetry(() => fnRetry(joinCode, {
            showErrorToast: false,
            timeout: 30000,
            actionId: crypto.randomUUID(),
            expectedStateVersion: reconciled.stateVersion,
          }));

          const recovered = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 12000 });
          applyLiveStateForCode(joinCode, recovered);
          rememberHostReceipt(qId, wantPause ? "pause-session" : "resume-session", { actionId: retried.actionId, ackAt: retried.ackAt });
          toast.success(wantPause ? "Live timer paused" : "Live timer resumed");
          return;
        } catch {
          // Fall through to original error toast.
        }
      }

      if (timeoutLike) {
        try {
          const reconciled = await getLiveQuizState(joinCode, { showErrorToast: false, timeout: 12000 });
          applyLiveStateForCode(joinCode, reconciled);
          if (Boolean(reconciled.isPaused) === wantPause) {
            toast.success(wantPause ? "Live timer paused" : "Live timer resumed");
            return;
          }
        } catch {
          // Fall through to original timeout message.
        }
      }

      toast.error(errMsg);
    } finally {
      setLiveActionByQuizId((prev) => ({ ...prev, [qId]: null }));
    }
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
      toast.success("Points awarded");
      setBonusUserId("");
      setBonusUserSearch("");
      setBonusMemberOptions([]);
      setBonusPoints("");
      setBonusDesc("");
      fetchPointsPanel();
    } catch (err) { toast.error(getErrorMessage(err, "Failed to award bonus points")); } finally { setBonusSubmitting(false); }
  }

  async function handleReverseBonus(pointId: string) {
    const reason = window.prompt("Reason for reversing this bonus award:");
    if (!reason || reason.trim().length < 3) return;
    setReversingPointId(pointId);
    try {
      await reverseBonusPoints(pointId, reason.trim());
      toast.success("Bonus points reversed");
      fetchPointsPanel();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to reverse bonus points"));
    } finally {
      setReversingPointId(null);
    }
  }

  function openResetMemberModal() {
    if (!bonusUserId) {
      toast.error("Select a member first from search before resetting IEPOD data");
      return;
    }
    setShowResetUserModal(true);
  }

  async function handleResetMember() {
    if (!bonusUserId) {
      toast.error("No member selected");
      return;
    }
    if (resetReason.trim().length < 8) {
      toast.error("Please provide a clear reset reason (min 8 characters)");
      return;
    }

    setResetSubmitting(true);
    try {
      const res = await resetIepodUserData(bonusUserId, {
        reason: resetReason.trim(),
        blockRejoin: resetBlockRejoin,
      });
      toast.success(res.message || "Member IEPOD data reset successfully");
      setShowResetUserModal(false);
      setResetReason("");
      setResetBlockRejoin(true);
      setBonusUserId("");
      setBonusUserSearch("");
      setBonusMemberOptions([]);
      setResetTargetMember(null);
      await Promise.allSettled([fetchRegistrations(), fetchPointsPanel(), fetchStats()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to reset member IEPOD data"));
    } finally {
      setResetSubmitting(false);
    }
  }

  function addQuizQuestion() {
    const byTypeDefault = quizForm.quizType === "unfractured_focus"
      ? 15
      : quizForm.quizType === "process_breakdown"
        ? 35
        : 20;
    const timer = Math.max(5, Number(quizDefaultQuestionTimer || byTypeDefault));
    setQuizQuestions([...quizQuestions, { question: "", options: ["", "", "", ""], correctIndex: 0, points: 10, timeLimitSeconds: timer }]);
  }
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
          onStartLive={handleStartLive}
          onStartQuestionOne={handleStartQuestionOne}
          onTogglePauseLive={handleTogglePauseLive}
          onForceResyncLive={handleForceResyncLive}
          onFetchReplay={handleFetchReplay}
          onRevealLive={handleRevealLiveFinalTop3}
          onEndLive={handleEndLive}
          liveJoinByQuizId={liveJoinByQuizId}
          endedLiveByQuizId={endedLiveByQuizId}
          liveActionByQuizId={liveActionByQuizId}
          liveStateByCode={liveStateByCode}
          liveParticipantsByCode={liveParticipantsByCode}
          liveWsStatusByCode={liveWsStatusByCode}
          hostReceiptByQuizId={hostReceiptByQuizId}
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
          pointsView={pointsView}
          setPointsView={setPointsView}
          pointsPage={pointsPage}
          setPointsPage={setPointsPage}
          pointsTotal={pointsTotal}
          pointsLoading={pointsLoading}
          leaderboard={leaderboard}
          quizLeaderboard={quizLeaderboard}
          bonusHistory={bonusHistory}
          reversingPointId={reversingPointId}
          onReverseBonus={handleReverseBonus}
          bonusUserId={bonusUserId} setBonusUserId={setBonusUserId}
          bonusUserSearch={bonusUserSearch} setBonusUserSearch={setBonusUserSearch}
          bonusMemberOptions={bonusMemberOptions}
          bonusMemberSearchLoading={bonusMemberSearchLoading}
          bonusPoints={bonusPoints} setBonusPoints={setBonusPoints}
          bonusDesc={bonusDesc} setBonusDesc={setBonusDesc}
          bonusSubmitting={bonusSubmitting}
          onAwardBonus={handleAwardBonus}
          onOpenResetMemberModal={openResetMemberModal}
          onSelectBonusMember={setResetTargetMember}
        />
      )}

      {/* ═══════ MODALS ═══════════════════════════════ */}

      {/* Society Modal */}
      <Modal isOpen={showSocModal} onClose={closeSocModal} title={editingSociety ? "Edit Society" : "New Society"} size="lg"
        footer={<>
          <button onClick={closeSocModal} className="px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors">Cancel</button>
          <button onClick={(e) => handleSaveSociety(e as unknown as React.FormEvent)} disabled={socSubmitting} className="px-5 py-2.5 rounded-2xl border-[3px] border-navy bg-lime text-navy text-sm font-bold press-3 press-navy transition-all disabled:opacity-50">
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
          <button onClick={(e) => handleSaveQuiz(e as unknown as React.FormEvent)} disabled={quizSubmitting} className="px-5 py-2.5 rounded-2xl border-[3px] border-navy bg-lime text-navy text-sm font-bold press-3 press-navy transition-all disabled:opacity-50">
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
          <div className="bg-ghost border-[3px] border-cloud rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-navy">Track Setup</p>
            <p className="text-xs text-navy-muted mt-1">
              {quizForm.quizType === "live"
                ? "Live Arena mode: host-controlled rounds with intro, answer, reveal, and leaderboard beats."
                : quizForm.quizType === "unfractured_focus"
                  ? "Focus Sprint: short, concentration-first practice rounds for speed and accuracy."
                  : quizForm.quizType === "process_breakdown"
                    ? "Process Drill: step-by-step reasoning checks for applied IEPOD scenarios."
                    : "Quick Check: balanced practice deck for broad revision."}
            </p>
          </div>
          <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Description</label>
            <textarea value={quizForm.description || ""} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })} title="Quiz description" rows={2} placeholder="Tell students what this round is about and what to focus on." className="w-full border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy bg-snow focus:outline-none resize-none" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={quizForm.isLive} onChange={(e) => setQuizForm({ ...quizForm, isLive: e.target.checked })} title="Publish immediately" className="w-4 h-4 accent-lime" />
            <span className="font-bold text-xs text-navy">Make available to students now</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Default Q Timer (s)</label>
              <input type="number" value={quizDefaultQuestionTimer} min={5} max={120} onChange={(e) => setQuizDefaultQuestionTimer(Number(e.target.value))} title="Default per-question timer in seconds" className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none" />
            </div>
            <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Intermission (s)</label>
              <input type="number" value={quizForm.intermissionSeconds ?? 8} min={3} max={30} onChange={(e) => setQuizForm({ ...quizForm, intermissionSeconds: Number(e.target.value) })} title="Leaderboard intermission seconds" disabled={quizForm.quizType !== "live"} className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none disabled:opacity-50" />
            </div>
            <div><label className="text-[10px] font-bold text-slate uppercase block mb-1">Reveal Beat (s)</label>
              <input type="number" value={quizForm.revealResultsSeconds ?? 6} min={3} max={20} onChange={(e) => setQuizForm({ ...quizForm, revealResultsSeconds: Number(e.target.value) })} title="Reveal results duration seconds" disabled={quizForm.quizType !== "live"} className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none disabled:opacity-50" />
            </div>
            <div className="pt-1 sm:col-span-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-navy">Scoring</p>
              <p className="text-xs text-navy-muted">
                {quizForm.quizType === "live"
                  ? "Live scoring is automatic and speed-aware during gameplay."
                  : "Practice scoring is automatic. Per-question points are fixed by the system."}
              </p>
              <p className="text-xs text-navy-muted mt-1">
                {quizForm.quizType === "live"
                  ? "Live mode respects each question timer. Intermission and reveal beats are global host pacing settings."
                  : "Practice mode also uses each question timer for speed scoring. Use the default timer to prefill new questions."}
              </p>
            </div>
          </div>
          {/* Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="font-display font-black text-sm text-navy">Questions ({quizQuestions.length})</h5>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuizQuestions((prev) => prev.map((q) => ({ ...q, timeLimitSeconds: Math.max(5, Number(quizDefaultQuestionTimer || 20)) })))}
                  disabled={quizQuestions.length === 0}
                  className="bg-ghost border-2 border-navy text-navy font-bold text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  Apply Default Timer
                </button>
                <button type="button" onClick={addQuizQuestion} className="bg-navy text-lime font-bold text-xs px-3 py-1.5 rounded-lg press-2 press-lime">+ Add Question</button>
              </div>
            </div>
            {quizQuestions.map((q, qi) => (
              <div key={qi} className="bg-ghost border-[3px] border-cloud rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-black text-xs text-navy">Q{qi + 1}</span>
                  <button type="button" onClick={() => removeQuizQuestion(qi)} className="text-coral text-xs font-bold hover:underline">Remove</button>
                </div>
                <input
                  value={q.question}
                  onChange={(e) => updateQuizQuestion(qi, "question", e.target.value)}
                  placeholder={quizForm.quizType === "live"
                    ? "Live prompt (short, punchy, stage-friendly)…"
                    : quizForm.quizType === "unfractured_focus"
                      ? "Focus prompt (quick recall style)…"
                      : quizForm.quizType === "process_breakdown"
                        ? "Process prompt (step-based reasoning)…"
                        : "Question text…"}
                  className="w-full border-2 border-cloud rounded-lg px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${qi}`} checked={q.correctIndex === oi} onChange={() => updateQuizQuestion(qi, "correctIndex", oi)} title={`Mark option ${String.fromCharCode(65 + oi)} correct`} className="accent-teal" />
                      <input value={opt} onChange={(e) => { const opts = [...q.options]; opts[oi] = e.target.value; updateQuizQuestion(qi, "options", opts); }} placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        className="flex-1 border-2 border-cloud rounded-lg px-3 py-1.5 text-xs text-navy focus:border-navy focus:outline-none" />
                    </div>
                  ))}
                </div>
                <div><label className="text-[10px] text-slate block">Timer (seconds) override</label>
                  <input type="number" value={q.timeLimitSeconds} min={5} max={120} onChange={(e) => updateQuizQuestion(qi, "timeLimitSeconds", Number(e.target.value))} title="Question timer" className="w-28 border-2 border-cloud rounded-lg px-2 py-1 text-xs text-navy focus:border-navy focus:outline-none" />
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showResetUserModal}
        onClose={() => {
          if (resetSubmitting) return;
          setShowResetUserModal(false);
        }}
        title="Reset Member IEPOD Data"
        size="md"
        footer={<>
          <button
            onClick={() => {
              if (resetSubmitting) return;
              setShowResetUserModal(false);
            }}
            className="px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleResetMember}
            disabled={resetSubmitting}
            className="px-5 py-2.5 rounded-2xl border-[3px] border-navy bg-coral text-snow text-sm font-bold press-3 press-black transition-all disabled:opacity-50"
          >
            {resetSubmitting ? "Resetting..." : "Confirm Reset"}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div className="bg-coral-light border-[3px] border-navy rounded-2xl p-3">
            <p className="text-xs font-bold text-navy">Target Member</p>
            <p className="text-sm font-display font-black text-navy mt-1">
              {resetTargetMember?.userName || bonusUserSearch || "Selected member"}
            </p>
            <p className="text-[11px] text-navy-muted mt-1">
              {resetTargetMember?.matricNumber || resetTargetMember?.email || bonusUserId}
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate uppercase block mb-1">Reason for reset *</label>
            <textarea
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
              rows={3}
              placeholder="Example: Duplicate test data cleanup before next onboarding cohort"
              className="w-full border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy bg-snow focus:outline-none resize-none"
            />
          </div>

          <label className="flex items-start gap-2 bg-ghost border-[2px] border-cloud rounded-xl px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={resetBlockRejoin}
              onChange={(e) => setResetBlockRejoin(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-navy">
              Block rejoin after reset until manually unblocked.
            </span>
          </label>
        </div>
      </Modal>

      {/* Submission Review Modal */}
      <Modal isOpen={!!reviewingSub} onClose={() => setReviewingSub(null)} title={`Review — ${reviewingSub?.title ?? ""}`} size="lg"
        footer={<>
          <button onClick={() => setReviewingSub(null)} className="px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors">Cancel</button>
          <button onClick={handleReviewSubmission} disabled={reviewSubmitting} className="px-5 py-2.5 rounded-2xl border-[3px] border-navy bg-teal text-snow text-sm font-bold press-3 press-navy transition-all disabled:opacity-50">
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
                <div>
                  <span className="font-bold text-sm text-lime/80">{s.societyName}</span>
                  {s.hubLeadName && (
                    <p className="text-[10px] text-lime/50">Lead: {s.hubLeadName}</p>
                  )}
                </div>
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
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"page" | "all">("page");
  const [exportLoading, setExportLoading] = useState(false);
  const isApprovedTab = subTab === "approved";

  const exportRows = registrations.filter((r) => r.status === "approved");

  async function getRowsForExport(): Promise<IepodRegistration[]> {
    if (exportScope === "page") {
      return exportRows;
    }

    const collected = new Map<string, IepodRegistration>();
    let skip = 0;
    let total = Number.MAX_SAFE_INTEGER;

    while (skip < total) {
      const res = await listRegistrations({
        status: "approved",
        phase: phase || undefined,
        department: department || undefined,
        search: search || undefined,
        limit: 200,
        skip,
      });
      total = res.total;
      for (const row of res.registrations) {
        if (row.status === "approved") {
          collected.set(row._id, row);
        }
      }
      if (res.registrations.length === 0) break;
      skip += res.registrations.length;
    }

    return Array.from(collected.values());
  }

  async function exportCsv() {
    setExportLoading(true);
    try {
      const rows = await getRowsForExport();
      if (rows.length === 0) {
        toast.info("No approved registrations to export");
        return;
      }
    const headers = [
      "Name",
      "Email",
      "Level",
      "Phone",
      "Department",
      "Phase",
      "Points",
      "Resubmissions",
      "Last Resubmitted",
      "Registered",
    ];
    const lines = rows.map((r) => [
      r.userName,
      r.userEmail,
      r.level || "",
      r.phone || "",
      r.department || "Industrial Engineering",
      PHASE_LABELS[r.phase],
      r.points,
      r.resubmissionCount || 0,
      r.resubmittedAt ? formatDate(r.resubmittedAt) : "",
      formatDate(r.createdAt),
    ]);

    const csv = [headers, ...lines].map((line) => line.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "iepod-approved-registrations.csv";
    link.click();
    URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
    }
  }

  async function exportPdf() {
    setExportLoading(true);
    try {
      const rows = await getRowsForExport();
      if (rows.length === 0) {
        toast.info("No approved registrations to export");
        return;
      }
    const popup = window.open("", "_blank", "width=1200,height=750");
    if (!popup) {
      toast.error("Please allow pop-ups to export PDF");
      return;
    }

    const htmlRows = rows
      .map((r) => `
        <tr>
          <td>${r.userName}</td>
          <td>${r.userEmail}</td>
          <td>${r.phone || "-"}</td>
          <td>${r.level || "-"}</td>
          <td>${r.department || "Industrial Engineering"}</td>
          <td>${PHASE_LABELS[r.phase]}</td>
          <td>${r.points}</td>
          <td>${r.resubmissionCount || 0}</td>
          <td>${r.resubmittedAt ? formatDate(r.resubmittedAt) : "-"}</td>
          <td>${formatDate(r.createdAt)}</td>
        </tr>
      `)
      .join("");

    popup.document.write(`
      <html>
        <head>
          <title>IEPOD Approved Registrations</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { margin-bottom: 8px; }
            p { margin-top: 0; color: #555; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #111; padding: 6px; text-align: left; }
            th { background: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>IEPOD Approved Registrations</h1>
          <p>Exported ${new Date().toLocaleString("en-NG")}</p>
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Phone</th><th>Level</th><th>Department</th><th>Phase</th><th>Points</th><th>Resubmissions</th><th>Last Resubmitted</th><th>Registered</th>
              </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
    } finally {
      setExportLoading(false);
    }
  }

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
        {isApprovedTab && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 ${viewMode === "cards" ? "bg-lime text-navy border-navy" : "bg-snow text-slate border-cloud"}`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 ${viewMode === "table" ? "bg-lime text-navy border-navy" : "bg-snow text-slate border-cloud"}`}
            >
              Table
            </button>
            <div className="relative">
              <button
                onClick={() => setExportOpen((p) => !p)}
                disabled={exportLoading}
                className="bg-navy text-snow border-[3px] border-lime px-3 py-2 rounded-xl text-xs font-bold press-2 press-lime"
              >
                {exportLoading ? "Preparing..." : "Export"}
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-snow border-[3px] border-navy rounded-xl shadow-[4px_4px_0_0_#000] z-20 p-2 space-y-2">
                  <div className="px-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate mb-1">Export Scope</p>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => setExportScope("page")}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${exportScope === "page" ? "bg-lime text-navy border-navy" : "bg-ghost text-slate border-cloud"}`}
                      >
                        This Page
                      </button>
                      <button
                        onClick={() => setExportScope("all")}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${exportScope === "all" ? "bg-lime text-navy border-navy" : "bg-ghost text-slate border-cloud"}`}
                      >
                        All Pages
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-cloud" />
                  <button
                    onClick={async () => {
                      await exportCsv();
                      setExportOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-navy hover:bg-cloud rounded-lg disabled:opacity-60"
                    disabled={exportLoading}
                  >
                    Export CSV ({exportScope === "page" ? "This Page" : "All Pages"})
                  </button>
                  <button
                    onClick={async () => {
                      await exportPdf();
                      setExportOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-navy hover:bg-cloud rounded-lg disabled:opacity-60"
                    disabled={exportLoading}
                  >
                    Export PDF ({exportScope === "page" ? "This Page" : "All Pages"})
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate">{total} registration{total !== 1 ? "s" : ""}</p>

      {loading ? <Spinner /> : registrations.length === 0 ? <EmptyState message={`No ${subTab} registrations`} /> : isApprovedTab && viewMode === "table" ? (
        <div className="bg-snow border-[3px] border-navy rounded-2xl shadow-[4px_4px_0_0_#000] overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-ghost border-b-[3px] border-navy">
              <tr>
                <th className="px-3 py-2 text-left font-black text-navy">Name</th>
                <th className="px-3 py-2 text-left font-black text-navy">Email</th>
                <th className="px-3 py-2 text-left font-black text-navy">Level</th>
                <th className="px-3 py-2 text-left font-black text-navy">Department</th>
                <th className="px-3 py-2 text-left font-black text-navy">Phase</th>
                <th className="px-3 py-2 text-left font-black text-navy">Points</th>
                <th className="px-3 py-2 text-left font-black text-navy">Re-sub</th>
                <th className="px-3 py-2 text-left font-black text-navy">Last Re-sub</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r._id} className="border-b border-cloud last:border-b-0">
                  <td className="px-3 py-2 text-navy font-bold">{r.userName}</td>
                  <td className="px-3 py-2 text-slate">{r.userEmail}</td>
                  <td className="px-3 py-2 text-slate">{r.level || "-"}</td>
                  <td className="px-3 py-2 text-slate">{r.department || "Industrial Engineering"}</td>
                  <td className="px-3 py-2 text-slate">{PHASE_LABELS[r.phase]}</td>
                  <td className="px-3 py-2 text-slate">{r.points}</td>
                  <td className="px-3 py-2 text-slate">{r.resubmissionCount || 0}</td>
                  <td className="px-3 py-2 text-slate">{r.resubmittedAt ? formatDate(r.resubmittedAt) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
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
                {!!(r.resubmissionCount && r.resubmissionCount > 0) && (
                  <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-coral-light border border-coral text-[10px] font-bold text-coral">
                    <span>Re-sub ×{r.resubmissionCount}</span>
                    {r.resubmittedAt && <span>· {formatDate(r.resubmittedAt)}</span>}
                  </div>
                )}
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
              <div className="mb-3 rounded-xl bg-ghost border-2 border-cloud px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate mb-1">Hub Lead (Role)</p>
                {s.hubLeadName ? (
                  <>
                    <p className="text-xs font-bold text-navy">{s.hubLeadName}</p>
                    {s.hubLeadEmail && <p className="text-[11px] text-slate">{s.hubLeadEmail}</p>}
                  </>
                ) : (
                  <p className="text-xs text-slate">Assign in Admin Roles as IEPOD Hub Lead ({s.name})</p>
                )}
              </div>
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

function QuizzesTab({ quizzes, loading, onAdd, onToggleLive, onDelete, onStartLive, onStartQuestionOne, onTogglePauseLive, onForceResyncLive, onFetchReplay, onRevealLive, onEndLive, liveJoinByQuizId, endedLiveByQuizId, liveActionByQuizId, liveStateByCode, liveParticipantsByCode, liveWsStatusByCode, hostReceiptByQuizId }: {
  quizzes: IepodQuiz[]; loading: boolean;
  onAdd: () => void;
  onToggleLive: (q: IepodQuiz) => void;
  onDelete: (q: IepodQuiz) => void;
  onStartLive: (q: IepodQuiz) => void;
  onStartQuestionOne: (q: IepodQuiz) => void;
  onTogglePauseLive: (q: IepodQuiz) => void;
  onForceResyncLive: (q: IepodQuiz) => void;
  onFetchReplay: (q: IepodQuiz) => Promise<LiveReplayResponse>;
  onRevealLive: (q: IepodQuiz) => void;
  onEndLive: (q: IepodQuiz) => void;
  liveJoinByQuizId: Record<string, string>;
  endedLiveByQuizId: Record<string, boolean>;
  liveActionByQuizId: Record<string, "start" | "startQuestion" | "pause" | "resume" | "reveal" | "end" | "resync" | null>;
  liveStateByCode: Record<string, LiveQuizState & { leaderboard?: LiveLeaderboardItem[]; finalPodiumRevealed?: boolean }>;
  liveParticipantsByCode: Record<string, LiveParticipant[]>;
  liveWsStatusByCode: Record<string, "connecting" | "open" | "closed">;
  hostReceiptByQuizId: Record<string, { action: string; actionId?: string; ackAt?: string }>;
}) {
  const activeQuizIds = useMemo(
    () => quizzes
      .map((q) => q._id || q.id || "")
      .filter((id) => Boolean(id) && Boolean(liveJoinByQuizId[id])),
    [quizzes, liveJoinByQuizId],
  );
  const [focusedLiveQuizId, setFocusedLiveQuizId] = useState<string>(activeQuizIds[0] || "");
  const [isControlRoomOpen, setIsControlRoomOpen] = useState(false);
  const [pendingEndQuiz, setPendingEndQuiz] = useState<IepodQuiz | null>(null);
  const [pendingFinalRevealQuiz, setPendingFinalRevealQuiz] = useState<IepodQuiz | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayData, setReplayData] = useState<LiveReplayResponse | null>(null);
  const [replayOpen, setReplayOpen] = useState(false);
  const [replayStepIdx, setReplayStepIdx] = useState(0);

  useEffect(() => {
    if (activeQuizIds.length === 0) {
      setFocusedLiveQuizId("");
      setIsControlRoomOpen(false);
      return;
    }
    if (!activeQuizIds.includes(focusedLiveQuizId)) {
      setFocusedLiveQuizId(activeQuizIds[0]);
    }
  }, [activeQuizIds, focusedLiveQuizId]);

  useEffect(() => {
    if (!isControlRoomOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsControlRoomOpen(false);
        setAudienceMode(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isControlRoomOpen]);

  const focusedQuiz = quizzes.find((q) => (q._id || q.id || "") === focusedLiveQuizId) || null;
  const publishedLiveLaunches = useMemo(
    () => quizzes.filter((q) => q.isLive),
    [quizzes],
  );
  const focusedJoinCode = focusedLiveQuizId ? liveJoinByQuizId[focusedLiveQuizId] : undefined;
  const focusedState = focusedJoinCode ? liveStateByCode[focusedJoinCode] : undefined;
  const focusedParticipants = focusedJoinCode ? (liveParticipantsByCode[focusedJoinCode] || []) : [];
  const focusedWsStatus = focusedJoinCode ? (liveWsStatusByCode[focusedJoinCode] || "connecting") : "closed";
  const focusedLiveAction = focusedLiveQuizId ? liveActionByQuizId[focusedLiveQuizId] : null;
  const focusedLiveBusy = Boolean(focusedLiveAction);
  const focusedCompletion = focusedState?.questionCompletionPercent ?? 0;
  const focusedPhase = useMemo(() => {
    if (!focusedState) return "waiting";
    if (focusedState.phase === "question_intro" || focusedState.phase === "question_answering") return "question";
    if (focusedState.phase === "answer_reveal") return "reveal";
    if (focusedState.phase === "leaderboard_reveal") return "leaderboard";
    if (focusedState.phase === "ended") return "ended";
    if (focusedState.phase === "waiting") return "waiting";
    return focusedState.questionPhase || focusedState.status || "waiting";
  }, [focusedState]);
  const focusedInQuestionPhase = focusedPhase === "question";
  const focusedInLeaderboardPhase = focusedPhase === "leaderboard";
  const focusedInRevealPhase = focusedPhase === "reveal";
  const focusedSessionEnded = focusedState?.status === "ended";
  const focusedPaused = Boolean(focusedState?.isPaused);
  const disableNonResumeControls = focusedPaused && !focusedSessionEnded;
  const [audienceMode, setAudienceMode] = useState(false);
  const audienceContainerRef = useRef<HTMLDivElement | null>(null);
  const openFinalRevealConfirm = (quiz: IepodQuiz) => {
    setIsControlRoomOpen(false);
    setAudienceMode(false);
    setPendingFinalRevealQuiz(quiz);
  };
  const openEndSessionConfirm = (quiz: IepodQuiz) => {
    setIsControlRoomOpen(false);
    setAudienceMode(false);
    setPendingEndQuiz(quiz);
  };

  useEffect(() => {
    if (!audienceMode) {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {
          // Ignore browser permission errors when leaving fullscreen programmatically.
        });
      }
      return;
    }
    const target = audienceContainerRef.current || document.documentElement;
    if (!document.fullscreenElement && target.requestFullscreen) {
      void target.requestFullscreen().catch(() => {
        // Fullscreen may be blocked without a direct user gesture in some browsers.
      });
    }
  }, [audienceMode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!audienceMode) return;
      if (!focusedQuiz || !focusedState) return;
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "e") {
        event.preventDefault();
        if (focusedSessionEnded) return;
        onEndLive(focusedQuiz);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [audienceMode, focusedQuiz, focusedState, onEndLive, focusedSessionEnded]);

  const phaseRemainingSeconds = useMemo(() => {
    if (!focusedState) return 0;
    if (focusedState.phaseEndsAt) {
      const endsAtMs = new Date(focusedState.phaseEndsAt).getTime();
      if (Number.isFinite(endsAtMs)) {
        return Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000));
      }
    }
    return Math.max(0, focusedState.phaseRemainingSeconds ?? focusedState.remainingSeconds ?? 0);
  }, [focusedState]);
  const focusedReceipt = focusedLiveQuizId ? hostReceiptByQuizId[focusedLiveQuizId] : undefined;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-display font-black text-lg text-navy">Quizzes <span className="text-sm font-medium text-slate">({quizzes.length})</span></h3>
        <PermissionGate permission="iepod:manage">
          <button onClick={onAdd} className="bg-lime border-[3px] border-navy press-3 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all">Create Quiz</button>
        </PermissionGate>
      </div>
      <div className="bg-snow border-[4px] border-navy rounded-3xl p-4 shadow-[6px_6px_0_0_#000] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-label-sm text-navy">Live Launchpad</p>
            <p className="text-xs text-navy-muted">Start, monitor, and focus one live session without hunting through all quiz cards.</p>
          </div>
        </div>
        {publishedLiveLaunches.length === 0 ? (
          <p className="text-xs font-bold text-slate">No published quizzes yet. Publish a quiz first, then launch live.</p>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
            {publishedLiveLaunches.map((quiz) => {
              const qId = quiz._id || quiz.id || "";
              const activeCode = liveJoinByQuizId[qId];
              const activeState = activeCode ? liveStateByCode[activeCode] : null;
              const busy = Boolean(liveActionByQuizId[qId]);
              return (
                <div key={`launch-${qId}`} className="bg-ghost border border-navy/20 rounded-xl p-3 space-y-2">
                  <p className="font-display font-black text-sm text-navy truncate">{quiz.title}</p>
                  <p className="text-[11px] text-navy-muted">{activeCode ? `Live code ${activeCode}` : "Not running"}</p>
                  <div className="flex items-center gap-2">
                    {!activeCode ? (
                      <button
                        disabled={busy}
                        onClick={() => onStartLive(quiz)}
                        className="bg-teal border-[2px] border-navy rounded-lg px-3 py-1.5 text-[11px] font-black text-snow press-2 press-black disabled:opacity-60"
                      >
                        {liveActionByQuizId[qId] === "start" ? "Starting..." : "Start Live"}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setFocusedLiveQuizId(qId);
                            setIsControlRoomOpen(true);
                          }}
                          className="bg-lime border-[2px] border-navy rounded-lg px-3 py-1.5 text-[11px] font-black text-navy press-2 press-navy"
                        >
                          Focus Room
                        </button>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded ${activeState?.status === "ended" ? "bg-coral-light text-coral" : "bg-teal-light text-teal"}`}>
                          {activeState?.status === "ended" ? "Ended" : "Live"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {isControlRoomOpen && focusedQuiz && focusedJoinCode && focusedState && (
        <div className="fixed inset-0 z-[160]">
          <button
            aria-label="Close live control room"
            onClick={() => {
              setIsControlRoomOpen(false);
              setAudienceMode(false);
            }}
            className="absolute inset-0 bg-navy/55"
          />
          <div className="relative h-full w-full overflow-auto p-3 sm:p-5 lg:p-8">
            <div ref={audienceContainerRef} className="max-w-7xl mx-auto bg-[linear-gradient(160deg,#2D1374_0%,#4C24A7_52%,#6F3BD0_100%)] border-[3px] border-navy rounded-3xl p-5 space-y-4 shadow-[8px_8px_0_0_#000]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-snow/75 text-label-sm">Live Quiz Control Room</p>
              <h4 className="font-display font-black text-display-sm text-snow">{focusedQuiz.title}</h4>
              <p className="text-snow/70 text-xs mt-1">Code: {focusedJoinCode}</p>
            </div>
            <button
              onClick={() => {
                setIsControlRoomOpen(false);
                setAudienceMode(false);
              }}
              className="px-3 py-2 rounded-xl text-xs font-black border-[3px] bg-coral text-snow border-navy press-2 press-black"
            >
              Close Room
            </button>
            <button
              onClick={() => setAudienceMode((prev) => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-black border-[3px] transition-all ${audienceMode ? "bg-lime text-navy border-navy press-2 press-navy" : "bg-snow text-navy border-navy press-2 press-black"}`}
            >
              {audienceMode ? "Audience Mode On" : "Audience Mode"}
            </button>
            {activeQuizIds.length > 1 && (
              <select
                value={focusedLiveQuizId}
                onChange={(e) => setFocusedLiveQuizId(e.target.value)}
                title="Focused live session"
                className="bg-snow border-[3px] border-navy rounded-xl px-3 py-2 text-xs font-bold text-navy"
              >
                {activeQuizIds.map((qid) => {
                  const optionQuiz = quizzes.find((q) => (q._id || q.id || "") === qid);
                  const optionCode = liveJoinByQuizId[qid];
                  return (
                    <option key={qid} value={qid}>
                      {(optionQuiz?.title || "Live Quiz")} ({optionCode})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <div className="bg-snow border border-navy/20 rounded-2xl p-3">
              <p className="text-navy-muted text-[10px] font-bold uppercase tracking-wider">Connection</p>
              <p className="text-navy font-display font-black text-sm mt-1">{focusedWsStatus === "open" ? "Live" : focusedWsStatus === "connecting" ? "Connecting" : "Reconnecting"}</p>
            </div>
            <div className="bg-snow border border-navy/20 rounded-2xl p-3">
              <p className="text-navy-muted text-[10px] font-bold uppercase tracking-wider">Question</p>
              <p className="text-navy font-display font-black text-sm mt-1">{Math.max(0, focusedState.currentQuestionIndex + 1)} / {focusedState.totalQuestions}</p>
            </div>
            <div className="bg-snow border border-navy/20 rounded-2xl p-3">
              <p className="text-navy-muted text-[10px] font-bold uppercase tracking-wider">Answer Pace</p>
              <p className="text-navy font-display font-black text-sm mt-1">{focusedState.recentAnswerVelocityPer10s || 0} / 10s</p>
            </div>
            <div className="bg-snow border border-navy/20 rounded-2xl p-3">
              <p className="text-navy-muted text-[10px] font-bold uppercase tracking-wider">Completion</p>
              <p className="text-navy font-display font-black text-sm mt-1">{focusedCompletion}%</p>
            </div>
          </div>

          {audienceMode && (
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000]">
              <div className="text-center space-y-4">
                <p className="text-label text-navy">Audience Display</p>
                <h5 className="font-display font-black text-hero text-navy leading-[0.9]">
                  {focusedState?.question?.question || "Get Ready"}
                </h5>
                <p className="font-display font-black text-display-lg text-lavender">
                  {phaseRemainingSeconds}s
                </p>
                <div className="grid sm:grid-cols-2 gap-3 max-w-4xl mx-auto text-left">
                  {(focusedState?.question?.options || []).map((opt, idx) => (
                    <div key={`aud-opt-${idx}`} className="bg-ghost border-[3px] border-navy rounded-2xl px-4 py-3">
                      <p className="font-display font-black text-base text-navy">{String.fromCharCode(65 + idx)}. {opt}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-black text-slate uppercase tracking-wider">Hotkey: E end</p>
              </div>
            </div>
          )}

          {!audienceMode && (
          <div className="bg-navy-light border border-lime/30 rounded-2xl p-3 space-y-3">
            <p className="text-lime text-[10px] font-bold uppercase tracking-wider">Game Flow</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-bold uppercase tracking-wider">
              <div className={`rounded-xl px-2 py-2 text-center border ${focusedPhase === "waiting" ? "bg-sunny text-navy border-navy" : "bg-navy text-lime/70 border-lime/20"}`}>Ready</div>
              <div className={`rounded-xl px-2 py-2 text-center border ${focusedInQuestionPhase ? "bg-teal text-snow border-teal" : "bg-navy text-lime/70 border-lime/20"}`}>Question</div>
              <div className={`rounded-xl px-2 py-2 text-center border ${focusedInRevealPhase ? "bg-lavender text-navy border-navy" : "bg-navy text-lime/70 border-lime/20"}`}>Reveal</div>
              <div className={`rounded-xl px-2 py-2 text-center border ${focusedInLeaderboardPhase ? "bg-sunny text-navy border-navy" : "bg-navy text-lime/70 border-lime/20"}`}>Leaderboard</div>
            </div>
            <div className="text-[11px]">
              <p className="text-lime/80">Phase timer: <span className="font-black text-lime">{focusedState?.phaseRemainingSeconds ?? 0}s</span></p>
            </div>
          </div>
          )}

          {!audienceMode && (
          <div className="bg-snow border border-navy/20 rounded-2xl p-3 space-y-3">
            <p className="text-navy text-[10px] font-bold uppercase tracking-wider">Host Controls</p>
            <div className="flex items-center justify-between rounded-xl border border-navy/20 bg-ghost px-3 py-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-navy-muted">Live Mode</p>
                <p className="text-xs font-black text-navy">Auto Flow (locked)</p>
              </div>
              <span className="rounded-xl px-3 py-2 text-xs font-black border-[3px] border-navy bg-teal text-snow">Auto</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <button
                disabled={focusedLiveBusy || focusedSessionEnded || disableNonResumeControls || ((focusedState?.currentQuestionIndex ?? -1) >= 0)}
                onClick={() => {
                  if (!focusedQuiz) return;
                  onStartQuestionOne(focusedQuiz);
                }}
                className="bg-lime border-[3px] border-navy rounded-xl px-3 py-2 text-xs font-black text-navy press-2 press-navy disabled:opacity-50"
              >
                {focusedLiveAction === "startQuestion" ? "Starting..." : "Start Question 1"}
              </button>
              <button
                disabled={focusedLiveBusy || disableNonResumeControls}
                onClick={() => {
                  if (!focusedQuiz) return;
                  onForceResyncLive(focusedQuiz);
                }}
                className="bg-sunny border-[3px] border-navy rounded-xl px-3 py-2 text-xs font-black text-navy press-2 press-black disabled:opacity-50"
              >
                {focusedLiveAction === "resync" ? "Resyncing..." : "Force Resync"}
              </button>
              <button
                disabled={focusedLiveBusy || focusedSessionEnded}
                onClick={() => {
                  if (!focusedQuiz) return;
                  onTogglePauseLive(focusedQuiz);
                }}
                className="bg-lavender border-[3px] border-navy rounded-xl px-3 py-2 text-xs font-black text-navy press-2 press-black disabled:opacity-50"
              >
                {focusedLiveAction === "pause" ? "Pausing..." : focusedLiveAction === "resume" ? "Resuming..." : focusedState?.isPaused ? "Resume Timer" : "Pause Timer"}
              </button>
              <button
                disabled={focusedLiveBusy || disableNonResumeControls || !focusedSessionEnded || Boolean(focusedState?.finalPodiumRevealed)}
                onClick={() => {
                  if (!focusedQuiz) return;
                  openFinalRevealConfirm(focusedQuiz);
                }}
                className="bg-teal border-[3px] border-navy rounded-xl px-3 py-2 text-xs font-black text-snow press-2 press-black disabled:opacity-50"
              >
                {focusedState?.finalPodiumRevealed ? "Final Top 3 Revealed" : focusedLiveAction === "reveal" ? "Launching..." : "Reveal Final Top 3"}
              </button>
              <button
                disabled={focusedLiveBusy || disableNonResumeControls}
                onClick={() => {
                  if (!focusedQuiz) return;
                  openEndSessionConfirm(focusedQuiz);
                }}
                className="bg-coral border-[3px] border-navy rounded-xl px-3 py-2 text-xs font-black text-snow press-2 press-black disabled:opacity-50"
              >
                {focusedLiveAction === "end" ? "Ending..." : focusedSessionEnded ? "Close Session" : "End Session"}
              </button>
            </div>
            {focusedReceipt && (
              <p className="text-[10px] text-navy-muted">
                Receipt: {focusedReceipt.actionId || "n/a"} / {focusedReceipt.ackAt ? new Date(focusedReceipt.ackAt).toLocaleTimeString("en-NG") : "n/a"}
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-bold uppercase tracking-wider">
              <div className="rounded-xl bg-lime-light px-2 py-2 border border-navy/20 text-navy">Question {focusedState?.questionWindowSeconds ?? 0}s</div>
              <div className="rounded-xl bg-lavender-light px-2 py-2 border border-navy/20 text-navy">Reveal {focusedState?.revealResultsSeconds ?? 0}s</div>
              <div className="rounded-xl bg-teal-light px-2 py-2 border border-navy/20 text-navy">Players {focusedState?.participantsCount ?? 0}</div>
              <div className="rounded-xl bg-sunny-light px-2 py-2 border border-navy/20 text-navy">{focusedState?.isPaused ? "Paused" : `Phase ${focusedPhase}`}</div>
            </div>
            <div className="bg-snow border border-navy/20 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-navy text-[10px] font-bold uppercase tracking-wider">Player States</p>
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                  <span className="px-2 py-0.5 rounded bg-cloud text-slate">Pending/Waiting {focusedParticipants.filter((p) => !p.readyForStart).length}</span>
                  <span className="px-2 py-0.5 rounded bg-lime-light text-navy">Ready {focusedParticipants.filter((p) => p.readyForStart && focusedState?.status !== "live").length}</span>
                  <span className="px-2 py-0.5 rounded bg-teal-light text-teal">Playing {focusedParticipants.filter((p) => p.readyForStart && focusedState?.status === "live").length}</span>
                </div>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {focusedParticipants.map((p) => {
                  const stateLabel = focusedState?.status === "live"
                    ? (p.readyForStart ? "playing" : "pending/waiting")
                    : (p.readyForStart ? "ready" : "pending/waiting");
                  const stateBadgeClass = stateLabel === "playing"
                    ? "bg-teal-light text-teal"
                    : stateLabel === "ready"
                      ? "bg-lime-light text-navy"
                      : "bg-cloud text-slate";
                  return (
                    <div key={`participant-${p.userId}`} className="flex items-center justify-between bg-ghost rounded-lg px-2.5 py-1.5 border border-navy/15">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-navy truncate">{p.userName}</p>
                        <p className="text-[10px] text-navy-muted">score {p.totalScore} • answers {p.answersCount}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${stateBadgeClass}`}>{stateLabel}</span>
                    </div>
                  );
                })}
                {focusedParticipants.length === 0 && <p className="text-xs text-slate">No participant roster yet.</p>}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                disabled={!focusedSessionEnded || replayLoading}
                onClick={async () => {
                  if (!focusedQuiz) return;
                  setIsControlRoomOpen(false);
                  setAudienceMode(false);
                  setReplayLoading(true);
                  try {
                    const replay = await onFetchReplay(focusedQuiz);
                    setReplayData(replay);
                    setReplayStepIdx(0);
                    setReplayOpen(true);
                  } catch (err) {
                    toast.error(getErrorMessage(err, "Failed to load replay timeline"));
                  } finally {
                    setReplayLoading(false);
                  }
                }}
                className="bg-navy border-[3px] border-lime rounded-xl px-3 py-2 text-xs font-black text-lime press-2 press-lime disabled:opacity-50"
              >
                {replayLoading ? "Loading Replay..." : "Open Replay Timeline"}
              </button>
            </div>
          </div>
          )}

          {!audienceMode && (
          <div className="bg-snow border border-navy/20 rounded-2xl p-3 space-y-2">
            <p className="text-navy text-[10px] font-bold uppercase tracking-wider">Active Question</p>
            {focusedSessionEnded ? (
              <div className="bg-coral-light border border-coral/40 rounded-xl p-3">
                <p className="text-coral text-xs font-black uppercase tracking-wider">Session ended</p>
                <p className="text-navy text-sm font-bold mt-1">Question actions are locked until a new live session starts.</p>
              </div>
            ) : focusedState.question ? (
              <>
                <p className="text-navy font-bold text-sm">{focusedState.question.question}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {focusedState.question.options.map((opt, idx) => (
                    <div key={`active-opt-${idx}`} className="bg-ghost border border-navy/20 rounded-lg px-2 py-1.5 text-xs text-navy font-bold">
                      {String.fromCharCode(65 + idx)}. {opt}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-navy-muted">
                  <span>Answered: {focusedState.currentQuestionAnswersCount || 0}/{focusedState.participantsCount}</span>
                  {focusedState.question.correctOption && <span>Correct: {focusedState.question.correctOption}</span>}
                </div>
              </>
            ) : (
              <p className="text-navy-muted text-xs">Waiting for first question to start.</p>
            )}
          </div>
          )}

          {!audienceMode && (
          <div className="bg-snow border border-navy/20 rounded-2xl p-3">
            <p className="text-navy text-[10px] font-bold uppercase tracking-wider mb-2">Realtime Leaderboard (Top 10)</p>
            <div className="space-y-1.5">
              {(focusedState.leaderboard || []).slice(0, 10).map((row) => (
                <div key={row.userId} className="flex items-center justify-between text-xs bg-ghost rounded-lg px-2 py-1.5 border border-navy/20">
                  <span className="text-navy font-bold">#{row.rank} {row.userName}</span>
                  <span className="text-navy font-display font-black">{row.totalScore}</span>
                </div>
              ))}
              {(focusedState.leaderboard || []).length === 0 && (
                <p className="text-navy-muted text-xs">No scores yet.</p>
              )}
            </div>
          </div>
          )}
            </div>
          </div>
        </div>
      )}
      {loading ? <Spinner /> : quizzes.length === 0 ? <EmptyState message="No quizzes created yet" /> : (
        <div className="space-y-3">
          {quizzes.map((q) => {
            const qId = q._id || q.id || "";
            const liveCode = liveJoinByQuizId[qId];
            const liveAction = liveActionByQuizId[qId];
            const liveBusy = Boolean(liveAction);
            const liveSnapshot = liveCode ? liveStateByCode[liveCode] : null;
            const liveWsStatus = liveCode ? (liveWsStatusByCode[liveCode] || "connecting") : "closed";
            const isEnded = Boolean(endedLiveByQuizId[qId]) || liveSnapshot?.status === "ended";
            const hasLiveSession = Boolean(liveCode);
            const hasActiveLiveSession = Boolean(liveCode && liveSnapshot?.status !== "ended");
            const inLeaderboardPhase = liveSnapshot?.questionPhase === "leaderboard";
            const inRevealPhase = liveSnapshot?.questionPhase === "reveal";
            const disableCardNonResume = Boolean(liveSnapshot?.isPaused && liveSnapshot?.status !== "ended");
            return (
              <div key={qId} className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000]">
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div>
                    <h4 className="font-display font-black text-base text-navy">{q.title}</h4>
                    <p className="text-slate text-xs mt-1">{QUIZ_TYPE_LABELS[q.quizType]} • {q.questionCount ?? q.questions?.length ?? 0} questions • {q.participantCount ?? 0} participants</p>
                  </div>
                  <span className={`font-bold text-[10px] px-3 py-1 rounded-full ${isEnded ? "bg-coral-light text-coral" : hasActiveLiveSession ? "bg-teal-light text-teal" : q.isLive ? "bg-lime-light text-navy" : "bg-cloud text-slate"}`}>
                    {isEnded ? "Ended" : hasActiveLiveSession ? "Live Session" : q.isLive ? "Published" : "Draft"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PermissionGate permission="iepod:manage">
                    <button onClick={() => onToggleLive(q)} className="bg-lavender-light border-2 border-navy/20 rounded-xl px-3 py-1.5 text-navy font-black text-xs press-2 press-black">{q.isLive ? "Unpublish" : "Publish"}</button>
                    {!liveCode ? (
                      <button disabled={liveBusy} onClick={() => onStartLive(q)} className="bg-teal-light border-2 border-navy/20 rounded-xl px-3 py-1.5 text-navy font-black text-xs press-2 press-black disabled:opacity-60">
                        {liveAction === "start" ? "Starting..." : "Start Live Session"}
                      </button>
                    ) : (
                      <>
                        {liveSnapshot?.status !== "ended" && (
                          <button
                            disabled={liveBusy}
                            onClick={() => onTogglePauseLive(q)}
                            className="bg-lavender-light border-2 border-navy/20 rounded-xl px-3 py-1.5 text-navy font-black text-xs press-2 press-black disabled:opacity-60"
                          >
                            {liveAction === "pause" ? "Pausing..." : liveAction === "resume" ? "Resuming..." : liveSnapshot?.isPaused ? "Resume Timer" : "Pause Timer"}
                          </button>
                        )}
                        {liveSnapshot?.status === "ended" && (
                          <button disabled={liveBusy || Boolean(liveSnapshot?.finalPodiumRevealed)} onClick={() => openFinalRevealConfirm(q)} className="bg-teal-light border-2 border-navy/20 rounded-xl px-3 py-1.5 text-navy font-black text-xs press-2 press-black disabled:opacity-60">
                            {liveSnapshot?.finalPodiumRevealed ? "Final Top 3 Revealed" : liveAction === "reveal" ? "Launching..." : "Reveal Final Top 3"}
                          </button>
                        )}
                        <button disabled={liveBusy || disableCardNonResume} onClick={() => openEndSessionConfirm(q)} className="bg-coral-light border-2 border-coral/40 rounded-xl px-3 py-1.5 text-coral font-black text-xs press-2 press-black disabled:opacity-60">
                          {liveAction === "end" ? "Ending..." : liveSnapshot?.status === "ended" ? "Close Session" : "End Session"}
                        </button>
                      </>
                    )}
                    {!hasLiveSession && (
                      <button onClick={() => onDelete(q)} className="bg-coral border-2 border-navy rounded-xl px-3 py-1.5 text-snow font-black text-xs press-2 press-black">Delete</button>
                    )}
                  </PermissionGate>
                </div>
                {liveCode && (
                  <div className="mt-3 bg-sunny-light border-2 border-navy rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-navy">Live Join Code</p>
                      <p className="font-display font-black text-base text-navy tracking-[0.2em]">{liveCode}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-navy-muted font-bold">
                        <span className={`px-1.5 py-0.5 rounded-md ${liveWsStatus === "open" ? "bg-teal text-snow" : liveWsStatus === "connecting" ? "bg-sunny text-navy" : "bg-coral text-snow"}`}>
                          {liveWsStatus === "open" ? "Realtime" : liveWsStatus === "connecting" ? "Connecting" : "Reconnecting"}
                        </span>
                        {liveSnapshot && (
                          <>
                            <span>Q {Math.max(0, liveSnapshot.currentQuestionIndex + 1)}/{liveSnapshot.totalQuestions}</span>
                            <span className="uppercase">{liveSnapshot.questionPhase || "waiting"}</span>
                            {typeof liveSnapshot.phaseRemainingSeconds === "number" && (
                              <span>
                                {inRevealPhase ? "Reveal" : inLeaderboardPhase ? "Standings" : "Timer"} {liveSnapshot.phaseRemainingSeconds}s
                              </span>
                            )}
                            <span>Players {liveSnapshot.participantsCount}</span>
                            <span>Answers {liveSnapshot.answersCount || 0}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(liveCode);
                        toast.success("Join code copied");
                      }}
                      className="bg-snow border-[3px] border-navy px-3 py-1.5 rounded-xl text-xs font-bold text-navy press-2 press-black"
                    >
                      Copy Code
                    </button>
                  </div>
                )}
                {(hostReceiptByQuizId[qId]?.actionId || hostReceiptByQuizId[qId]?.ackAt) && (
                  <p className="mt-2 text-[10px] text-navy-muted">
                    Receipt: {hostReceiptByQuizId[qId]?.actionId || "n/a"} / {hostReceiptByQuizId[qId]?.ackAt ? new Date(hostReceiptByQuizId[qId]!.ackAt as string).toLocaleTimeString("en-NG") : "n/a"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {replayOpen && replayData && (
        <Modal isOpen={replayOpen} onClose={() => setReplayOpen(false)} title="Live Quiz Replay Timeline" size="full">
          {(() => {
            const steps = replayData.timeline || [];
            const step = steps[Math.max(0, Math.min(replayStepIdx, steps.length - 1))];
            if (!step) {
              return <p className="text-sm text-slate">No replay steps available.</p>;
            }
            const progressPct = steps.length > 1 ? Math.round((replayStepIdx / (steps.length - 1)) * 100) : 100;
            return (
              <div className="space-y-4">
                <div className="bg-navy border-[3px] border-lime rounded-2xl p-4 text-snow shadow-[6px_6px_0_0_#000]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-label-sm text-lime">Question Replay</p>
                      <p className="font-display font-black text-xl">Q{step.questionIndex + 1}: {step.question}</p>
                    </div>
                    <p className="text-xs font-bold text-lime">Step {replayStepIdx + 1} / {steps.length}</p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-navy-light overflow-hidden">
                    <div className="h-full bg-lime transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
                  <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[5px_5px_0_0_#000] space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-navy-muted">Vote Distribution</p>
                    <div className="space-y-2">
                      {step.distribution.map((d) => {
                        const isCorrect = step.correctIndex === d.optionIndex;
                        return (
                          <div key={`replay-d-${d.optionIndex}`} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-navy">
                              <span className="truncate">{d.option}</span>
                              <span>{d.count} ({d.percent}%)</span>
                            </div>
                            <div className="h-3 rounded-full bg-cloud overflow-hidden border border-navy/10">
                              <div className={`h-full transition-all ${isCorrect ? "bg-teal" : "bg-lavender"}`} style={{ width: `${Math.max(4, d.percent)}%` }} />
                            </div>
                            {isCorrect && <p className="text-[10px] font-black uppercase tracking-wider text-teal">Correct Option</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[5px_5px_0_0_#000]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-navy-muted mb-2">Top Gainers</p>
                      <div className="space-y-1.5">
                      {step.topGainers.map((g) => (
                          <div key={`replay-g-${g.userId}`} className="text-xs text-navy flex justify-between bg-lime-light border border-navy/10 rounded-lg px-2 py-1">
                          <span>{g.userName}</span>
                          <span className="font-black">+{g.points}</span>
                        </div>
                      ))}
                        {step.topGainers.length === 0 && <p className="text-xs text-slate">No score movement on this step.</p>}
                      </div>
                    </div>

                    <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[5px_5px_0_0_#000]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-navy-muted mb-2">Leaderboard Snapshot</p>
                      <div className="space-y-1.5">
                      {step.leaderboardTop.slice(0, 5).map((l) => (
                          <div key={`replay-l-${l.userId}`} className="text-xs text-navy flex justify-between bg-ghost border border-navy/10 rounded-lg px-2 py-1">
                          <span>#{l.rank} {l.userName}</span>
                          <span className="font-black">{l.totalScore}</span>
                        </div>
                      ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setReplayStepIdx((idx) => Math.max(0, idx - 1))}
                    disabled={replayStepIdx <= 0}
                    className="bg-snow border-[3px] border-navy rounded-xl px-3 py-1.5 text-xs font-bold text-navy disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <div className="flex items-center gap-2 overflow-x-auto px-2 py-1 bg-ghost border border-cloud rounded-xl max-w-[55%]">
                    {steps.map((s, idx) => (
                      <button
                        key={`replay-step-chip-${s.questionIndex}-${idx}`}
                        onClick={() => setReplayStepIdx(idx)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap border ${idx === replayStepIdx ? "bg-lime border-navy text-navy" : "bg-snow border-cloud text-slate"}`}
                      >
                        Q{s.questionIndex + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setReplayStepIdx((idx) => Math.min(steps.length - 1, idx + 1))}
                    disabled={replayStepIdx >= steps.length - 1}
                    className="bg-lime border-[3px] border-navy rounded-xl px-3 py-1.5 text-xs font-bold text-navy disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
      {pendingFinalRevealQuiz && (
        <ConfirmModal
          isOpen={!!pendingFinalRevealQuiz}
          title="Reveal Final Top 3"
          message={`Trigger final podium reveal for \"${pendingFinalRevealQuiz.title}\" now?`}
          confirmLabel={(() => {
            const pendingId = pendingFinalRevealQuiz._id || pendingFinalRevealQuiz.id || "";
            return liveActionByQuizId[pendingId] === "reveal" ? "Revealing..." : "Reveal Podium";
          })()}
          variant="default"
          isLoading={(() => {
            const pendingId = pendingFinalRevealQuiz._id || pendingFinalRevealQuiz.id || "";
            return liveActionByQuizId[pendingId] === "reveal";
          })()}
          onConfirm={async () => {
            await onRevealLive(pendingFinalRevealQuiz);
            setPendingFinalRevealQuiz(null);
          }}
          onClose={() => setPendingFinalRevealQuiz(null)}
        />
      )}
      {pendingEndQuiz && (
        <ConfirmModal
          isOpen={!!pendingEndQuiz}
          title="Close Live Session"
          message={`End and close live controls for \"${pendingEndQuiz.title}\"? Active players will be disconnected.`}
          confirmLabel="Close Session"
          variant="danger"
          onConfirm={() => {
            onEndLive(pendingEndQuiz);
            setPendingEndQuiz(null);
          }}
          onClose={() => setPendingEndQuiz(null)}
        />
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
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [exportOpen, setExportOpen] = useState(false);

  const memberRows = teams.flatMap((team) =>
    team.members.map((member) => ({
      teamName: team.name,
      maxMembers: team.maxMembers,
      ...member,
    })),
  );

  function exportCsv() {
    const headers = ["Team", "Member", "Role", "Email", "Matric", "Level", "Department", "Phone", "Joined"];
    const lines = memberRows.map((row) => [
      row.teamName,
      row.userName,
      row.role,
      row.email || "",
      row.matricNumber || "",
      row.level || "",
      row.department || "",
      row.phone || "",
      row.joinedAt ? formatDate(row.joinedAt) : "",
    ]);
    const csv = [headers, ...lines].map((line) => line.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "iepod-team-members.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const popup = window.open("", "_blank", "width=1100,height=750");
    if (!popup) {
      toast.error("Please allow pop-ups to export PDF");
      return;
    }
    const htmlRows = memberRows
      .map(
        (row) => `
        <tr>
          <td>${row.teamName}</td>
          <td>${row.userName}</td>
          <td>${row.role}</td>
          <td>${row.email || "-"}</td>
          <td>${row.matricNumber || "-"}</td>
          <td>${row.level || "-"}</td>
          <td>${row.department || "-"}</td>
          <td>${row.phone || "-"}</td>
          <td>${row.joinedAt ? formatDate(row.joinedAt) : "-"}</td>
        </tr>
      `,
      )
      .join("");
    popup.document.write(`
      <html>
        <head>
          <title>IEPOD Team Members</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { margin-bottom: 8px; }
            p { margin-top: 0; color: #555; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #111; padding: 6px; text-align: left; }
            th { background: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>IEPOD Team Members</h1>
          <p>Exported ${new Date().toLocaleString("en-NG")}</p>
          <table>
            <thead>
              <tr><th>Team</th><th>Member</th><th>Role</th><th>Email</th><th>Matric</th><th>Level</th><th>Department</th><th>Phone</th><th>Joined</th></tr>
            </thead>
            <tbody>${htmlRows}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="font-display font-black text-lg text-navy">Teams <span className="text-sm font-medium text-slate">({teams.length})</span></h3>
        <div className="flex items-center gap-2">
          <div className="w-64"><SearchInput value={search} onChange={setSearch} placeholder="Search teams…" /></div>
          <button
            onClick={() => setViewMode("cards")}
            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 ${viewMode === "cards" ? "bg-lime text-navy border-navy" : "bg-snow text-slate border-cloud"}`}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 ${viewMode === "table" ? "bg-lime text-navy border-navy" : "bg-snow text-slate border-cloud"}`}
          >
            Table
          </button>
          <div className="relative">
            <button
              onClick={() => setExportOpen((p) => !p)}
              className="bg-navy text-snow border-[3px] border-lime px-3 py-2 rounded-xl text-xs font-bold press-2 press-lime"
            >
              Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-snow border-[3px] border-navy rounded-xl shadow-[4px_4px_0_0_#000] z-20 p-1">
                <button
                  onClick={() => {
                    exportCsv();
                    setExportOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-navy hover:bg-cloud rounded-lg"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => {
                    exportPdf();
                    setExportOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-navy hover:bg-cloud rounded-lg"
                >
                  Export PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {loading ? <Spinner /> : teams.length === 0 ? <EmptyState message="No teams yet" /> : viewMode === "cards" ? (
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
      ) : memberRows.length === 0 ? <EmptyState message="No members in these teams yet" /> : (
        <div className="bg-snow border-[3px] border-navy rounded-2xl shadow-[4px_4px_0_0_#000] overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-ghost border-b-[3px] border-navy">
              <tr>
                <th className="px-3 py-2 text-left font-black text-navy">Team</th>
                <th className="px-3 py-2 text-left font-black text-navy">Member</th>
                <th className="px-3 py-2 text-left font-black text-navy">Role</th>
                <th className="px-3 py-2 text-left font-black text-navy">Email</th>
                <th className="px-3 py-2 text-left font-black text-navy">Matric</th>
                <th className="px-3 py-2 text-left font-black text-navy">Level</th>
                <th className="px-3 py-2 text-left font-black text-navy">Department</th>
                <th className="px-3 py-2 text-left font-black text-navy">Phone</th>
              </tr>
            </thead>
            <tbody>
              {memberRows.map((row, idx) => (
                <tr key={`${row.teamName}-${row.userId}-${idx}`} className="border-b border-cloud last:border-b-0">
                  <td className="px-3 py-2 text-navy font-bold">{row.teamName}</td>
                  <td className="px-3 py-2 text-navy">{row.userName}</td>
                  <td className="px-3 py-2 text-slate">{row.role}</td>
                  <td className="px-3 py-2 text-slate">{row.email || "-"}</td>
                  <td className="px-3 py-2 text-slate">{row.matricNumber || "-"}</td>
                  <td className="px-3 py-2 text-slate">{row.level || "-"}</td>
                  <td className="px-3 py-2 text-slate">{row.department || "-"}</td>
                  <td className="px-3 py-2 text-slate">{row.phone || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

function PointsTab({
  pointsView,
  setPointsView,
  pointsPage,
  setPointsPage,
  pointsTotal,
  pointsLoading,
  leaderboard,
  quizLeaderboard,
  bonusHistory,
  reversingPointId,
  onReverseBonus,
  bonusUserId,
  setBonusUserId,
  bonusUserSearch,
  setBonusUserSearch,
  bonusMemberOptions,
  bonusMemberSearchLoading,
  bonusPoints,
  setBonusPoints,
  bonusDesc,
  setBonusDesc,
  bonusSubmitting,
  onAwardBonus,
  onOpenResetMemberModal,
  onSelectBonusMember,
}: {
  pointsView: "general" | "quiz" | "bonus-history";
  setPointsView: (v: "general" | "quiz" | "bonus-history") => void;
  pointsPage: number;
  setPointsPage: (p: number) => void;
  pointsTotal: number;
  pointsLoading: boolean;
  leaderboard: LeaderboardEntry[];
  quizLeaderboard: QuizSystemLeaderboardEntry[];
  bonusHistory: BonusHistoryItem[];
  reversingPointId: string | null;
  onReverseBonus: (pointId: string) => void;
  bonusUserId: string;
  setBonusUserId: (s: string) => void;
  bonusUserSearch: string;
  setBonusUserSearch: (s: string) => void;
  bonusMemberOptions: IepodMemberLookupEntry[];
  bonusMemberSearchLoading: boolean;
  bonusPoints: string;
  setBonusPoints: (s: string) => void;
  bonusDesc: string;
  setBonusDesc: (s: string) => void;
  bonusSubmitting: boolean;
  onAwardBonus: (e: React.FormEvent) => void;
  onOpenResetMemberModal: () => void;
  onSelectBonusMember: (m: IepodMemberLookupEntry | null) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(pointsTotal / POINTS_PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Award bonus */}
      <PermissionGate permission="iepod:manage">
        <div className="bg-lime-light border-4 border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
          <h3 className="font-display font-black text-base text-navy mb-4">Award Bonus Points</h3>
          <form onSubmit={onAwardBonus} className="flex flex-col gap-3">
            <div className="relative">
              <input
                value={bonusUserSearch}
                onChange={(e) => {
                  setBonusUserSearch(e.target.value);
                  setBonusUserId("");
                  onSelectBonusMember(null);
                }}
                placeholder="Search by name, matric number, or email"
                className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none"
              />
              {bonusMemberSearchLoading && <p className="text-[10px] text-slate mt-1">Searching members…</p>}
              {bonusMemberOptions.length > 0 && (
                <div className="mt-2 bg-snow border-[3px] border-navy rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {bonusMemberOptions.map((m) => (
                    <button
                      type="button"
                      key={m.userId}
                      onClick={() => {
                        setBonusUserId(m.userId);
                        setBonusUserSearch(`${m.userName} (${m.matricNumber || m.email || m.userId})`);
                        onSelectBonusMember(m);
                      }}
                      className={`w-full text-left px-3 py-2 border-b border-cloud last:border-b-0 transition-colors ${bonusUserId === m.userId ? "bg-lime-light" : "hover:bg-ghost"}`}
                    >
                      <p className="text-xs font-bold text-navy">{m.userName}</p>
                      <p className="text-[10px] text-slate">
                        {m.matricNumber || m.email || m.userId} · {m.status || "unknown"} · {m.points} pts
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {!bonusUserId && bonusUserSearch.trim().length >= 2 && bonusMemberOptions.length === 0 && !bonusMemberSearchLoading && (
                <p className="text-[10px] text-slate mt-1">No matching registered member found.</p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
            <input type="number" value={bonusPoints} onChange={(e) => setBonusPoints(e.target.value)} placeholder="Points" min={1}
              className="w-24 border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none" />
            <input value={bonusDesc} onChange={(e) => setBonusDesc(e.target.value)} placeholder="Reason"
              className="flex-1 border-[3px] border-navy rounded-xl px-4 py-2 text-sm text-navy bg-snow focus:outline-none" />
            <button type="submit" disabled={bonusSubmitting}
              className="bg-lime border-[3px] border-navy press-3 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all disabled:opacity-50 whitespace-nowrap">
              {bonusSubmitting ? "…" : "Award"}
            </button>
            <button type="button" onClick={onOpenResetMemberModal}
              className="bg-coral-light border-[3px] border-navy press-3 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all whitespace-nowrap">
              Reset Member Data
            </button>
            </div>
          </form>
        </div>
      </PermissionGate>

      {/* Points views */}
      <div className="bg-navy border-4 border-lime rounded-3xl p-6 shadow-[6px_6px_0_0_#C8F31D]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-display font-black text-lg text-lime">Points Center</h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setPointsView("general")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black border-2 transition-all ${pointsView === "general" ? "bg-lime text-navy border-lime" : "bg-navy-light text-lime/70 border-navy-light"}`}
            >
              General Leaderboard
            </button>
            <button
              onClick={() => setPointsView("quiz")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black border-2 transition-all ${pointsView === "quiz" ? "bg-lime text-navy border-lime" : "bg-navy-light text-lime/70 border-navy-light"}`}
            >
              Quiz Leaderboard
            </button>
            <button
              onClick={() => setPointsView("bonus-history")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black border-2 transition-all ${pointsView === "bonus-history" ? "bg-lime text-navy border-lime" : "bg-navy-light text-lime/70 border-navy-light"}`}
            >
              Bonus Audit Trail
            </button>
          </div>
        </div>

        {pointsLoading ? <Spinner /> : (
          <>
            {pointsView === "general" && (
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
            )}

            {pointsView === "quiz" && (
              <div className="space-y-2">
                {quizLeaderboard.map((entry) => (
                  <div key={entry.userId} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-navy-light">
                    <span className={`font-display font-black text-sm w-8 text-center ${entry.rank === 1 ? "text-sunny" : entry.rank === 2 ? "text-cloud" : entry.rank === 3 ? "text-coral" : "text-lime/40"}`}>#{entry.rank}</span>
                    <p className="font-bold text-sm text-lime/80 flex-1 truncate">{entry.userName}</p>
                    <span className="font-display font-black text-base text-lime">{entry.totalPoints}</span>
                  </div>
                ))}
                {quizLeaderboard.length === 0 && <p className="text-lime/50 text-sm text-center py-8">No quiz points yet</p>}
              </div>
            )}

            {pointsView === "bonus-history" && (
              <div className="space-y-2">
                {bonusHistory.map((item) => (
                  <div key={item.id} className="px-4 py-3 rounded-xl bg-navy-light border border-lime/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-lime/85 truncate">{item.userName}</p>
                        <p className="text-[10px] text-lime/50">{new Date(item.awardedAt).toLocaleString("en-NG")}</p>
                        <p className="text-xs text-lime/70 mt-1">{item.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-display font-black text-base ${item.points >= 0 ? "text-lime" : "text-coral"}`}>{item.points > 0 ? `+${item.points}` : item.points}</p>
                        <p className="text-[10px] text-lime/50">{item.action}</p>
                      </div>
                    </div>
                    {item.isReversible && (
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => onReverseBonus(item.id)}
                          disabled={reversingPointId === item.id}
                          className="bg-coral-light border-2 border-navy text-navy px-3 py-1 rounded-lg text-[10px] font-bold press-2 press-navy disabled:opacity-60"
                        >
                          {reversingPointId === item.id ? "Reversing…" : "Reverse Award"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {bonusHistory.length === 0 && <p className="text-lime/50 text-sm text-center py-8">No bonus history yet</p>}
              </div>
            )}

            <Pagination page={pointsPage} totalPages={totalPages} onPage={setPointsPage} className="mt-4" />
          </>
        )}
      </div>
    </div>
  );
}

export default withAuth(AdminIepodPage, {
  anyPermission: ["iepod:manage", "iepod:view"],
});
