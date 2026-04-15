"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  listMentorApplications,
  reviewMentorApplication,
  createPair,
  listPairs,
  updatePairStatus,
  getPairFeedback,
  getEnrichedMentors,
  getMenteeCandidates,
  getTimpUserDetails,
  getTimpSettings,
  updateTimpSettings,
  getTimpAnalytics,
  getPairMessages,
  APPLICATION_STATUS_STYLES,
  PAIR_STATUS_STYLES,
} from "@/lib/api";
import type {
  MentorApplication,
  MentorshipPair,
  TimpFeedback,
  PairStatus,
  EnrichedMentor,
  MenteeCandidate,
  TimpUserDetails,
  TimpAnalytics,
  TimpMessage,
} from "@/lib/api";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { Modal } from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import Image from "next/image";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { toast } from "sonner";

/* ── Types ────────────────────────────────────── */
type Tab = "applications" | "assignment" | "pairs" | "analytics";
const SUB_TABS = ["pending", "approved", "rejected"] as const;
const PAIR_TABS = ["active", "paused", "completed"] as const;
const PAGE_SIZE = 10;

/* ─── Helpers ──────────────────────────────────── */
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
          aria-hidden="true"
        >
          <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
        </svg>
      ))}
    </div>
  );
}

function Avatar({ name, url, size = "md" }: { name: string; url?: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-10 h-10 text-sm";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (url) {
    const dim = size === "sm" ? 32 : size === "lg" ? 56 : 40;
    return <Image src={url} alt={name} width={dim} height={dim} className={`${sz} rounded-full object-cover border-2 border-navy`} />;
  }
  return (
    <div className={`${sz} rounded-full bg-lavender-light border-2 border-navy flex items-center justify-center font-display font-bold text-navy`}>
      {initials}
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
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 bg-ghost border-[3px] border-cloud rounded-xl text-sm text-navy placeholder:text-slate focus:border-navy focus:outline-none transition-colors"
      />
    </div>
  );
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

type InferredGender = "female" | "male" | "unknown";

interface AutoPairDraft {
  menteeId: string;
  mentorId: string;
  reason: string;
}

function parseLevelNumber(level?: string | number | null): number {
  if (typeof level === "number") return level;
  if (!level) return 0;
  const num = Number(String(level).replace(/[^0-9]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function inferGender(value?: string | null): InferredGender {
  const raw = (value || "").toLowerCase().trim();
  if (["f", "female", "woman", "girl"].includes(raw)) return "female";
  if (["m", "male", "man", "boy"].includes(raw)) return "male";
  return "unknown";
}

function buildSmartDraft(
  mentors: EnrichedMentor[],
  mentees: MenteeCandidate[],
): AutoPairDraft[] {
  const availableMentors = mentors.filter((mentor) => !mentor.isFull);
  const availableMentees = mentees.filter((mentee) => !mentee.alreadyPaired);

  const remainingSlots = new Map<string, number>(
    availableMentors.map((mentor) => [mentor.userId, Math.max(0, mentor.maxMentees - mentor.activePairs)]),
  );

  const mentorById = new Map(availableMentors.map((mentor) => [mentor.userId, mentor]));

  const sortedMentees = [...availableMentees].sort((left, right) => {
    const leftGender = inferGender(left.gender);
    const rightGender = inferGender(right.gender);
    if (leftGender === rightGender) {
      return `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`);
    }
    if (leftGender === "female") return -1;
    if (rightGender === "female") return 1;
    return 0;
  });

  const drafts: AutoPairDraft[] = [];

  for (const mentee of sortedMentees) {
    const menteeName = `${mentee.firstName} ${mentee.lastName}`;
    const menteeGender = inferGender(mentee.gender);
    const menteeLevel = parseLevelNumber(mentee.level);

    let mentorsWithCapacity = availableMentors.filter((mentor) => (remainingSlots.get(mentor.userId) || 0) > 0);
    if (menteeGender === "female") {
      mentorsWithCapacity = mentorsWithCapacity.filter((mentor) => inferGender(mentor.gender) !== "male");
    }
    if (mentorsWithCapacity.length === 0) continue;

    let bestMentor: EnrichedMentor | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const mentor of mentorsWithCapacity) {
      const mentorGender = inferGender(mentor.gender);
      const mentorLevel = parseLevelNumber(mentor.level);
      const remaining = remainingSlots.get(mentor.userId) || 0;

      let score = 0;
      score += Math.max(0, menteeLevel - mentorLevel) * 10;
      score += Math.abs(mentorLevel - menteeLevel);
      score += mentor.activePairs * 2;
      score += (mentor.maxMentees - remaining) * 0.5;

      if (menteeGender === "female" && mentorGender === "male") {
        score += 1000;
      }

      if (score < bestScore) {
        bestScore = score;
        bestMentor = mentor;
      }
    }

    if (!bestMentor) continue;

    const mentorGender = inferGender(bestMentor.gender);
    const matchedOnGender = menteeGender === "female" && mentorGender === "female";
    drafts.push({
      menteeId: mentee.userId,
      mentorId: bestMentor.userId,
      reason: matchedOnGender
        ? "Matched by level proximity and female-mentor preference"
        : "Matched by level proximity and balanced mentor workload",
    });

    remainingSlots.set(bestMentor.userId, Math.max(0, (remainingSlots.get(bestMentor.userId) || 0) - 1));
    const mentor = mentorById.get(bestMentor.userId);
    if (mentor) {
      mentor.activePairs += 1;
    }
  }

  return drafts;
}

/* ═══════════════════════════════════════════════════
   ADMIN TIMP PAGE
   ═══════════════════════════════════════════════════ */

export function AdminTimpPage() {
  const [tab, setTab] = useState<Tab>("applications");
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-timp");

  /* ── Form toggle ── */
  const [formOpen, setFormOpen] = useState(true);
  const [togglingForm, setTogglingForm] = useState(false);

  useEffect(() => {
    getTimpSettings()
      .then((s) => setFormOpen(s.formOpen))
      .catch(() => toast.error("Failed to load TIMP settings"));
  }, []);

  const handleToggleForm = async () => {
    setTogglingForm(true);
    try {
      const updated = await updateTimpSettings(!formOpen);
      setFormOpen(updated.formOpen);
    } catch { toast.error("Failed to toggle application form"); } finally {
      setTogglingForm(false);
    }
  };

  /* ── Applications state ── */
  const [apps, setApps] = useState<MentorApplication[]>([]);
  const [totalApps, setTotalApps] = useState(0);
  const [appSubTab, setAppSubTab] = useState<string>("pending");
  const [loadingApps, setLoadingApps] = useState(true);
  const [appPage, setAppPage] = useState(1);

  const [reviewApp, setReviewApp] = useState<MentorApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  /* ── Assignment state ── */
  const [mentors, setMentors] = useState<EnrichedMentor[]>([]);
  const [mentees, setMentees] = useState<MenteeCandidate[]>([]);
  const [loadingAssignment, setLoadingAssignment] = useState(true);
  const [mentorSearch, setMentorSearch] = useState("");
  const [menteeSearch, setMenteeSearch] = useState("");
  const [selectedMentor, setSelectedMentor] = useState<EnrichedMentor | null>(null);
  const [selectedMentee, setSelectedMentee] = useState<MenteeCandidate | null>(null);
  const [creatingPair, setCreatingPair] = useState(false);
  const [detailUser, setDetailUser] = useState<TimpUserDetails | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showMenteeFilter, setShowMenteeFilter] = useState<"all" | "available" | "paired">("available");
  const [autoDraft, setAutoDraft] = useState<AutoPairDraft[]>([]);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [applyingAuto, setApplyingAuto] = useState(false);

  /* ── Pairs state ── */
  const [pairs, setPairs] = useState<MentorshipPair[]>([]);
  const [totalPairs, setTotalPairs] = useState(0);
  const [pairSubTab, setPairSubTab] = useState<string>("active");
  const [loadingPairs, setLoadingPairs] = useState(true);
  const [pairPage, setPairPage] = useState(1);
  const [feedbackPairId, setFeedbackPairId] = useState<string | null>(null);
  const [feedbackHistory, setFeedbackHistory] = useState<TimpFeedback[]>([]);

  /* ── Analytics state ── */
  const [analytics, setAnalytics] = useState<TimpAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  /* ── Pair messages state (admin view) ── */
  const [messagesPairId, setMessagesPairId] = useState<string | null>(null);
  const [pairMessages, setPairMessages] = useState<TimpMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  /* ── Reset pages on sub-tab change ── */
  useEffect(() => { setAppPage(1); }, [appSubTab]);
  useEffect(() => { setPairPage(1); }, [pairSubTab]);

  /* ── Fetch: Applications ── */
  const fetchApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const data = await listMentorApplications({
        status: appSubTab,
        limit: PAGE_SIZE,
        skip: (appPage - 1) * PAGE_SIZE,
      });
      setApps(data.items ?? []);
      setTotalApps(data.total ?? 0);
    } catch { toast.error("Failed to load applications"); } finally {
      setLoadingApps(false);
    }
  }, [appSubTab, appPage]);

  /* ── Fetch: Assignment data ── */
  const fetchAssignment = useCallback(async () => {
    setLoadingAssignment(true);
    try {
      const [mentorsRes, menteesRes] = await Promise.all([
        getEnrichedMentors(),
        getMenteeCandidates(),
      ]);
      setMentors(mentorsRes.items ?? []);
      setMentees(menteesRes.items ?? []);
    } catch { toast.error("Failed to load assignment data"); } finally {
      setLoadingAssignment(false);
    }
  }, []);

  /* ── Fetch: Pairs ── */
  const fetchPairs = useCallback(async () => {
    setLoadingPairs(true);
    try {
      const data = await listPairs({
        status: pairSubTab,
        limit: PAGE_SIZE,
        skip: (pairPage - 1) * PAGE_SIZE,
      });
      setPairs(data.items ?? []);
      setTotalPairs(data.total ?? 0);
    } catch { toast.error("Failed to load pairs"); } finally {
      setLoadingPairs(false);
    }
  }, [pairSubTab, pairPage]);

  /* ── Fetch: Analytics ── */
  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const data = await getTimpAnalytics();
      setAnalytics(data);
    } catch { toast.error("Failed to load analytics"); } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  /* ── Load pair messages (admin) ── */
  const loadMessages = async (pairId: string) => {
    if (messagesPairId === pairId) { setMessagesPairId(null); return; }
    setLoadingMessages(true);
    try {
      const msgs = await getPairMessages(pairId, 100);
      setPairMessages(msgs);
      setMessagesPairId(pairId);
    } catch { toast.error("Failed to load messages"); } finally {
      setLoadingMessages(false);
    }
  };

  /* ── Trigger fetches ── */
  useEffect(() => { if (tab === "applications") fetchApps(); }, [tab, fetchApps]);
  useEffect(() => { if (tab === "assignment") fetchAssignment(); }, [tab, fetchAssignment]);
  useEffect(() => { if (tab === "pairs") fetchPairs(); }, [tab, fetchPairs]);
  useEffect(() => { if (tab === "analytics") fetchAnalytics(); }, [tab, fetchAnalytics]);

  /* ── Filtered mentors/mentees from local search ── */
  const filteredMentors = useMemo(() => {
    if (!mentorSearch.trim()) return mentors;
    const q = mentorSearch.toLowerCase();
    return mentors.filter(
      (m) =>
        m.userName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.matricNumber.toLowerCase().includes(q)
    );
  }, [mentors, mentorSearch]);

  const filteredMentees = useMemo(() => {
    let list = mentees;
    if (showMenteeFilter === "available") list = list.filter((m) => !m.alreadyPaired);
    else if (showMenteeFilter === "paired") list = list.filter((m) => m.alreadyPaired);
    if (!menteeSearch.trim()) return list;
    const q = menteeSearch.toLowerCase();
    return list.filter(
      (m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.matricNumber.toLowerCase().includes(q)
    );
  }, [mentees, menteeSearch, showMenteeFilter]);

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
      toast.success(`Application ${reviewAction}`);
    } catch { toast.error("Failed to review application"); } finally {
      setSubmittingReview(false);
    }
  };

  const handleCreatePair = async () => {
    if (!selectedMentor || !selectedMentee) return;
    setCreatingPair(true);
    try {
      await createPair({ mentorId: selectedMentor.userId, menteeId: selectedMentee.userId });
      setSelectedMentor(null);
      setSelectedMentee(null);
      await fetchAssignment();
      toast.success("Mentorship pair created");
    } catch { toast.error("Failed to create pair"); } finally {
      setCreatingPair(false);
    }
  };

  const handleGenerateAutoDraft = async () => {
    setAutoAssigning(true);
    try {
      const draft = buildSmartDraft(mentors, mentees);
      if (draft.length === 0) {
        toast.info("No eligible auto-assignment candidates found");
        setAutoDraft([]);
        return;
      }
      setAutoDraft(draft);
      toast.success(`Drafted ${draft.length} smart mentor-mentee assignments`);
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleUpdateAutoDraftMentor = (menteeId: string, mentorId: string) => {
    setAutoDraft((prev) =>
      prev.map((row) =>
        row.menteeId === menteeId ? { ...row, mentorId } : row,
      ),
    );
  };

  const handleRemoveAutoDraftRow = (menteeId: string) => {
    setAutoDraft((prev) => prev.filter((row) => row.menteeId !== menteeId));
  };

  const handleApplyAutoDraft = async () => {
    if (autoDraft.length === 0) return;
    setApplyingAuto(true);
    let successCount = 0;
    let failureCount = 0;
    let filteredCount = 0;
    try {
      for (const row of autoDraft) {
        const mentor = mentors.find((m) => m.userId === row.mentorId);
        const mentee = mentees.find((m) => m.userId === row.menteeId);
        const mentorGender = inferGender(mentor?.gender);
        const menteeGender = inferGender(mentee?.gender);

        if (menteeGender === "female" && mentorGender === "male") {
          filteredCount += 1;
          continue;
        }

        try {
          await createPair({ mentorId: row.mentorId, menteeId: row.menteeId });
          successCount += 1;
        } catch {
          failureCount += 1;
        }
      }

      await fetchAssignment();
      await fetchPairs();

      if (successCount > 0) {
        toast.success(`Applied ${successCount} assignments${failureCount ? ` (${failureCount} skipped)` : ""}`);
      } else {
        toast.error("No assignments were applied");
      }

      if (filteredCount > 0) {
        toast.info(`${filteredCount} auto-assignment${filteredCount === 1 ? " was" : "s were"} skipped by the female-mentee rule`);
      }

      setAutoDraft([]);
    } finally {
      setApplyingAuto(false);
    }
  };

  const handleUpdatePairStatus = async (pairId: string, status: PairStatus) => {
    try {
      await updatePairStatus(pairId, status);
      await fetchPairs();
      toast.success(`Pair status updated to ${status}`);
    } catch { toast.error("Failed to update pair status"); }
  };

  const loadFeedback = async (pairId: string) => {
    if (feedbackPairId === pairId) { setFeedbackPairId(null); return; }
    try {
      const fb = await getPairFeedback(pairId);
      setFeedbackHistory(fb);
      setFeedbackPairId(pairId);
    } catch { toast.error("Failed to load feedback"); }
  };

  const openUserDetail = async (userId: string) => {
    setLoadingDetail(true);
    setDetailUser(null);
    try {
      const detail = await getTimpUserDetails(userId);
      setDetailUser(detail);
    } catch { toast.error("Failed to load user details"); } finally {
      setLoadingDetail(false);
    }
  };

  /* ── Stats ── */
  const statCards = useMemo(() => {
    if (tab === "applications") {
      return [
        { label: "Showing", count: apps.length, bg: "bg-sunny-light" },
        { label: "Total", count: totalApps, bg: "bg-teal-light" },
      ];
    }
    if (tab === "assignment") {
      return [
        { label: "Mentors", count: mentors.length, bg: "bg-teal-light" },
        { label: "Available", count: mentors.filter((m) => !m.isFull).length, bg: "bg-lime-light" },
        { label: "Freshmen", count: mentees.length, bg: "bg-lavender-light" },
        { label: "Unpaired", count: mentees.filter((m) => !m.alreadyPaired).length, bg: "bg-sunny-light" },
      ];
    }
    if (tab === "analytics") return []; // analytics has its own display
    return [
      { label: "Showing", count: pairs.length, bg: "bg-teal-light" },
      { label: "Total", count: totalPairs, bg: "bg-lavender-light" },
    ];
  }, [tab, apps.length, totalApps, mentors, mentees, pairs.length, totalPairs]);

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <ToolHelpModal toolId="admin-timp" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl md:text-3xl text-navy">
            TIMP <span className="brush-highlight">Management</span>
          </h1>
          <p className="text-sm text-slate mt-1">
            The IESA Mentoring Project — manage mentors, pairs & assignments
          </p>
        </div>
        <PermissionGate permission="timp:manage">
        <button
          onClick={handleToggleForm}
          disabled={togglingForm}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-display font-bold text-sm border-[3px] press-3 press-navy transition-all disabled:opacity-50 self-start ${
            formOpen ? "bg-teal border-navy text-navy" : "bg-coral border-navy text-snow"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {formOpen ? (
              <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clipRule="evenodd" />
            ) : (
              <>
                <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
              </>
            )}
          </svg>
          {togglingForm ? "Updating…" : formOpen ? "Form Open" : "Form Closed"}
        </button>
        </PermissionGate>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            { key: "applications", label: "Applications" },
            { key: "assignment", label: "Assignment" },
            { key: "pairs", label: "Pairs" },
            { key: "analytics", label: "Analytics" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-xl font-display font-bold text-sm border-[3px] transition-all ${
              tab === t.key
                ? "bg-navy border-lime text-snow"
                : "bg-ghost border-cloud text-navy hover:border-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Stats ─── */}
      {statCards.length > 0 && (
        <div className={`grid gap-3 ${statCards.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
          {statCards.map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center border-2 border-cloud`}>
              <p className="text-2xl font-display font-black text-navy">{s.count}</p>
              <p className="text-xs font-bold text-slate uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════ APPLICATIONS TAB ═══════════════ */}
      {tab === "applications" && (
        <ApplicationsTab
          apps={apps}
          totalApps={totalApps}
          loading={loadingApps}
          subTab={appSubTab}
          setSubTab={setAppSubTab}
          page={appPage}
          setPage={setAppPage}
          onReview={(app, action) => {
            setReviewApp(app);
            setReviewAction(action);
            setReviewFeedback("");
          }}
          onViewDetail={openUserDetail}
        />
      )}

      {/* ═══════════════ ASSIGNMENT TAB ═══════════════ */}
      {tab === "assignment" && (
        <AssignmentTab
          loading={loadingAssignment}
          mentors={filteredMentors}
          mentees={filteredMentees}
          mentorSearch={mentorSearch}
          setMentorSearch={setMentorSearch}
          menteeSearch={menteeSearch}
          setMenteeSearch={setMenteeSearch}
          menteeFilter={showMenteeFilter}
          setMenteeFilter={setShowMenteeFilter}
          selectedMentor={selectedMentor}
          setSelectedMentor={setSelectedMentor}
          selectedMentee={selectedMentee}
          setSelectedMentee={setSelectedMentee}
          onCreatePair={handleCreatePair}
          creatingPair={creatingPair}
          onViewDetail={openUserDetail}
          autoDraft={autoDraft}
          autoAssigning={autoAssigning}
          applyingAuto={applyingAuto}
          onGenerateAutoDraft={handleGenerateAutoDraft}
          onUpdateAutoDraftMentor={handleUpdateAutoDraftMentor}
          onRemoveAutoDraftRow={handleRemoveAutoDraftRow}
          onApplyAutoDraft={handleApplyAutoDraft}
        />
      )}

      {/* ═══════════════ PAIRS TAB ═══════════════ */}
      {tab === "pairs" && (
        <PairsTab
          pairs={pairs}
          totalPairs={totalPairs}
          loading={loadingPairs}
          subTab={pairSubTab}
          setSubTab={setPairSubTab}
          page={pairPage}
          setPage={setPairPage}
          feedbackPairId={feedbackPairId}
          feedbackHistory={feedbackHistory}
          onLoadFeedback={loadFeedback}
          onUpdateStatus={handleUpdatePairStatus}
          onViewDetail={openUserDetail}
          messagesPairId={messagesPairId}
          pairMessages={pairMessages}
          loadingMessages={loadingMessages}
          onLoadMessages={loadMessages}
        />
      )}

      {/* ═══════════════ ANALYTICS TAB ═══════════════ */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {loadingAnalytics ? (
            <Spinner />
          ) : !analytics ? (
            <EmptyState message="No analytics data available" />
          ) : (
            <>
              {/* Application overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-teal-light border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000] text-center">
                  <p className="font-display font-black text-3xl text-navy">{analytics.applications.total}</p>
                  <p className="text-[10px] font-bold text-slate uppercase tracking-wider mt-1">Total Applications</p>
                </div>
                <div className="bg-sunny-light border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000] text-center">
                  <p className="font-display font-black text-3xl text-navy">{analytics.applications.pending}</p>
                  <p className="text-[10px] font-bold text-slate uppercase tracking-wider mt-1">Pending</p>
                </div>
                <div className="bg-lime-light border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000] text-center">
                  <p className="font-display font-black text-3xl text-teal">{analytics.applications.approved}</p>
                  <p className="text-[10px] font-bold text-slate uppercase tracking-wider mt-1">Approved</p>
                </div>
                <div className="bg-coral-light border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000] text-center">
                  <p className="font-display font-black text-3xl text-coral">{analytics.applications.rejected}</p>
                  <p className="text-[10px] font-bold text-slate uppercase tracking-wider mt-1">Rejected</p>
                </div>
              </div>

              {/* Approval rate + Pairs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
                  <h3 className="font-display font-black text-lg text-navy mb-3">Approval Rate</h3>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20">
                      <svg aria-hidden="true" viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-cloud" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.9" fill="none"
                          className={analytics.applications.approvalRate >= 50 ? "stroke-teal" : "stroke-coral"}
                          strokeWidth="3"
                          strokeDasharray={`${analytics.applications.approvalRate} ${100 - analytics.applications.approvalRate}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center font-display font-black text-lg text-navy">
                        {analytics.applications.approvalRate}%
                      </span>
                    </div>
                    <div className="text-sm text-slate">
                      <p>{analytics.applications.approved} approved out of {analytics.applications.total} total applications</p>
                    </div>
                  </div>
                </div>

                <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
                  <h3 className="font-display font-black text-lg text-navy mb-3">Mentorship Pairs</h3>
                  <div className="space-y-2">
                    {[
                      { label: "Active", count: analytics.pairs.active, color: "bg-teal" },
                      { label: "Paused", count: analytics.pairs.paused, color: "bg-sunny" },
                      { label: "Completed", count: analytics.pairs.completed, color: "bg-lavender" },
                    ].map((p) => (
                      <div key={p.label} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${p.color}`} />
                        <span className="text-sm font-bold text-navy flex-1">{p.label}</span>
                        <span className="font-display font-black text-lg text-navy">{p.count}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t-2 border-cloud flex items-center justify-between">
                      <span className="text-xs font-bold text-slate uppercase">Total</span>
                      <span className="font-display font-black text-xl text-navy">{analytics.pairs.total}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              <div className="bg-lime border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
                <h3 className="font-display font-black text-lg text-navy mb-2">Feedback Overview</h3>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="font-display font-black text-4xl text-navy">{analytics.feedback.total}</p>
                    <p className="text-xs font-bold text-slate uppercase">Total Entries</p>
                  </div>
                  <div className="w-px h-12 bg-cloud" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display font-black text-4xl text-navy">{analytics.feedback.averageRating}</p>
                      <Stars rating={Math.round(analytics.feedback.averageRating)} />
                    </div>
                    <p className="text-xs font-bold text-slate uppercase">Avg Rating</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════ REVIEW MODAL ═══════════════ */}
      <Modal
        isOpen={!!reviewApp}
        onClose={() => setReviewApp(null)}
        title={`${reviewAction === "approved" ? "Approve" : "Reject"} Mentor — ${reviewApp?.userName ?? ""}`}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setReviewApp(null)}
              className="px-5 py-2.5 rounded-2xl border-[3px] border-navy text-navy text-sm font-bold hover:bg-cloud transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReview}
              disabled={submittingReview}
              className={`px-5 py-2.5 rounded-2xl border-[3px] border-navy text-snow text-sm font-bold press-3 press-navy transition-all disabled:opacity-50 ${
                reviewAction === "approved" ? "bg-teal" : "bg-coral"
              }`}
            >
              {submittingReview ? "Processing…" : `Confirm ${reviewAction === "approved" ? "Approve" : "Reject"}`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
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

          {/* App details */}
          {reviewApp && (
            <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Motivation</p>
                  <p className="text-navy-muted">{reviewApp.motivation}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Skills</p>
                  <p className="text-navy-muted">{reviewApp.skills}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Availability</p>
                  <p className="text-navy-muted">{reviewApp.availability}</p>
                </div>
              </div>
              <p className="text-xs text-slate">Max mentees: {reviewApp.maxMentees} · Applied {formatDate(reviewApp.createdAt)}</p>
            </div>
          )}

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
        </div>
      </Modal>

      {/* ═══════════════ USER DETAIL MODAL ═══════════════ */}
      <Modal
        isOpen={!!detailUser || loadingDetail}
        onClose={() => { setDetailUser(null); setLoadingDetail(false); }}
        title={detailUser ? `${detailUser.firstName} ${detailUser.lastName}` : "Loading…"}
        size="lg"
      >
        {loadingDetail ? (
          <Spinner />
        ) : detailUser ? (
          <div className="space-y-5">
            {/* Profile header */}
            <div className="flex items-center gap-4">
              <Avatar
                name={`${detailUser.firstName} ${detailUser.lastName}`}
                url={detailUser.profilePictureUrl}
                size="lg"
              />
              <div>
                <p className="font-display font-bold text-lg text-navy">
                  {detailUser.firstName} {detailUser.lastName}
                </p>
                <p className="text-sm text-slate">{detailUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  {detailUser.level && (
                    <span className="px-2 py-0.5 rounded-md bg-lavender-light border border-cloud text-[10px] font-bold text-navy">
                      {detailUser.level}
                    </span>
                  )}
                  {detailUser.gender && (
                    <span className="px-2 py-0.5 rounded-md bg-coral-light border border-cloud text-[10px] font-bold text-navy capitalize">
                      {detailUser.gender}
                    </span>
                  )}
                  <span className="text-xs text-slate">{detailUser.matricNumber}</span>
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {detailUser.gender && (
                <div className="bg-ghost rounded-xl p-3 border-2 border-cloud">
                  <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Gender</p>
                  <p className="text-sm text-navy capitalize">{detailUser.gender}</p>
                </div>
              )}
              {detailUser.phone && (
                <div className="bg-ghost rounded-xl p-3 border-2 border-cloud">
                  <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Phone</p>
                  <p className="text-sm text-navy">{detailUser.phone}</p>
                </div>
              )}
              {detailUser.bio && (
                <div className="bg-ghost rounded-xl p-3 border-2 border-cloud sm:col-span-2">
                  <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Bio</p>
                  <p className="text-sm text-navy-muted">{detailUser.bio}</p>
                </div>
              )}
              {detailUser.skills && detailUser.skills.length > 0 && (
                <div className="bg-ghost rounded-xl p-3 border-2 border-cloud sm:col-span-2">
                  <p className="text-[10px] font-bold text-slate uppercase mb-1">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {detailUser.skills.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-lime-light text-navy text-[10px] font-bold">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* TIMP application */}
            {detailUser.application && (
              <div className="bg-ghost rounded-xl p-4 border-2 border-cloud">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-bold text-navy uppercase">Mentor Application</p>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                    APPLICATION_STATUS_STYLES[detailUser.application.status].bg
                  } ${APPLICATION_STATUS_STYLES[detailUser.application.status].text}`}>
                    {APPLICATION_STATUS_STYLES[detailUser.application.status].label}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-slate uppercase">Motivation</p>
                    <p className="text-navy-muted text-xs">{detailUser.application.motivation}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate uppercase">Skills</p>
                    <p className="text-navy-muted text-xs">{detailUser.application.skills}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate uppercase">Availability</p>
                    <p className="text-navy-muted text-xs">{detailUser.application.availability}</p>
                  </div>
                </div>
              </div>
            )}

            {/* TIMP pairs */}
            {detailUser.pairs.length > 0 && (
              <div>
                <p className="text-xs font-bold text-navy uppercase mb-2">Mentorship Pairs ({detailUser.pairs.length})</p>
                <div className="space-y-2">
                  {detailUser.pairs.map((p) => {
                    const style = PAIR_STATUS_STYLES[p.status];
                    return (
                      <div key={p.id} className="flex items-center justify-between bg-ghost rounded-xl p-3 border-2 border-cloud">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                          <div className="text-sm text-navy">
                            <span className="font-bold">{p.mentorName}</span>
                            <span className="text-slate mx-1">&rarr;</span>
                            <span className="font-bold">{p.menteeName}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate">{formatDate(p.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   APPLICATIONS TAB COMPONENT
   ═══════════════════════════════════════════════════ */

function ApplicationsTab({
  apps,
  totalApps,
  loading,
  subTab,
  setSubTab,
  page,
  setPage,
  onReview,
  onViewDetail,
}: {
  apps: MentorApplication[];
  totalApps: number;
  loading: boolean;
  subTab: string;
  setSubTab: (s: string) => void;
  page: number;
  setPage: (p: number) => void;
  onReview: (app: MentorApplication, action: "approved" | "rejected") => void;
  onViewDetail: (userId: string) => void;
}) {
  return (
    <>
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {SUB_TABS.map((st) => (
          <button
            key={st}
            onClick={() => setSubTab(st)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
              subTab === st
                ? "bg-navy text-snow"
                : "bg-cloud text-navy hover:bg-navy/10"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : apps.length === 0 ? (
        <EmptyState message={`No ${subTab} applications`} />
      ) : (
        <div className="space-y-4">
          {apps.map((app) => {
            const style = APPLICATION_STATUS_STYLES[app.status];
            return (
              <div key={app.id} className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onViewDetail(app.userId)}
                        className="font-display font-black text-lg text-navy hover:text-teal transition-colors text-left"
                      >
                        {app.userName}
                      </button>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                      {app.userLevel != null && (
                        <span className="px-2 py-0.5 rounded-md bg-ghost border border-cloud text-[10px] font-bold text-slate">
                          {typeof app.userLevel === "number" ? `${app.userLevel}L` : app.userLevel}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Motivation</p>
                        <p className="text-navy-muted line-clamp-3">{app.motivation}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Skills</p>
                        <p className="text-navy-muted">{app.skills}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate uppercase mb-0.5">Availability</p>
                        <p className="text-navy-muted">{app.availability}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate">
                      <span>Max mentees: {app.maxMentees}</span>
                      <span>·</span>
                      <span>{formatDate(app.createdAt)}</span>
                    </div>

                    {app.feedback && (
                      <p className="text-sm text-navy-muted bg-ghost p-3 rounded-xl border-2 border-cloud italic mt-2">
                        {app.feedback}
                      </p>
                    )}
                  </div>

                  {app.status === "pending" && (
                    <PermissionGate permission="timp:manage">
                      <div className="flex gap-2 self-start shrink-0">
                        <button
                          onClick={() => onReview(app, "approved")}
                          className="bg-teal border-[3px] border-navy px-4 py-2 rounded-xl text-snow text-xs font-bold press-2 press-navy transition-all"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onReview(app, "rejected")}
                          className="bg-coral border-[3px] border-navy px-4 py-2 rounded-xl text-snow text-xs font-bold press-2 press-navy transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    </PermissionGate>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={Math.ceil(totalApps / PAGE_SIZE)} onPage={setPage} className="mt-4" />
    </>
  );
}

/* ═══════════════════════════════════════════════════
   ASSIGNMENT TAB COMPONENT (Two-Column)
   ═══════════════════════════════════════════════════ */

function AssignmentTab({
  loading,
  mentors,
  mentees,
  mentorSearch,
  setMentorSearch,
  menteeSearch,
  setMenteeSearch,
  menteeFilter,
  setMenteeFilter,
  selectedMentor,
  setSelectedMentor,
  selectedMentee,
  setSelectedMentee,
  onCreatePair,
  creatingPair,
  onViewDetail,
  autoDraft,
  autoAssigning,
  applyingAuto,
  onGenerateAutoDraft,
  onUpdateAutoDraftMentor,
  onRemoveAutoDraftRow,
  onApplyAutoDraft,
}: {
  loading: boolean;
  mentors: EnrichedMentor[];
  mentees: MenteeCandidate[];
  mentorSearch: string;
  setMentorSearch: (s: string) => void;
  menteeSearch: string;
  setMenteeSearch: (s: string) => void;
  menteeFilter: "all" | "available" | "paired";
  setMenteeFilter: (f: "all" | "available" | "paired") => void;
  selectedMentor: EnrichedMentor | null;
  setSelectedMentor: (m: EnrichedMentor | null) => void;
  selectedMentee: MenteeCandidate | null;
  setSelectedMentee: (m: MenteeCandidate | null) => void;
  onCreatePair: () => void;
  creatingPair: boolean;
  onViewDetail: (userId: string) => void;
  autoDraft: AutoPairDraft[];
  autoAssigning: boolean;
  applyingAuto: boolean;
  onGenerateAutoDraft: () => void;
  onUpdateAutoDraftMentor: (menteeId: string, mentorId: string) => void;
  onRemoveAutoDraftRow: (menteeId: string) => void;
  onApplyAutoDraft: () => void;
}) {
  if (loading) return <Spinner />;

  const canCreate = selectedMentor && selectedMentee && !creatingPair;

  return (
    <div className="space-y-4">
      {/* ─── Selection banner ─── */}
      <div className="bg-navy border-[3px] border-lime rounded-2xl p-4 shadow-[4px_4px_0_0_#C8F31D]">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Mentor slot */}
          <div className="flex-1 w-full">
            {selectedMentor ? (
              <div className="flex items-center gap-2 bg-navy-light rounded-xl px-3 py-2">
                <Avatar name={selectedMentor.userName} url={selectedMentor.profilePictureUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-snow truncate">{selectedMentor.userName}</p>
                  <p className="text-[10px] text-lime">{selectedMentor.activePairs}/{selectedMentor.maxMentees} mentees</p>
                </div>
                <button
                  onClick={() => setSelectedMentor(null)}
                  className="p-1 rounded-lg hover:bg-navy text-snow/60 hover:text-snow transition-all shrink-0"
                  aria-label="Deselect mentor"
                >
                  <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-lime/30 rounded-xl px-3 py-3 text-center">
                <p className="text-xs text-lime/50 font-medium">Select a mentor</p>
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="shrink-0">
            <svg className="w-6 h-6 text-lime rotate-90 sm:rotate-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13.22 19.03a.75.75 0 0 1 0-1.06L18.19 13H3.75a.75.75 0 0 1 0-1.5h14.44l-4.97-4.97a.75.75 0 0 1 1.06-1.06l6.25 6.25a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 0 1-1.06 0Z" />
            </svg>
          </div>

          {/* Mentee slot */}
          <div className="flex-1 w-full">
            {selectedMentee ? (
              <div className="flex items-center gap-2 bg-navy-light rounded-xl px-3 py-2">
                <Avatar name={`${selectedMentee.firstName} ${selectedMentee.lastName}`} url={selectedMentee.profilePictureUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-snow truncate">{selectedMentee.firstName} {selectedMentee.lastName}</p>
                  <p className="text-[10px] text-lime">{selectedMentee.level} · {selectedMentee.matricNumber}</p>
                </div>
                <button
                  onClick={() => setSelectedMentee(null)}
                  className="p-1 rounded-lg hover:bg-navy text-snow/60 hover:text-snow transition-all shrink-0"
                  aria-label="Deselect mentee"
                >
                  <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-lime/30 rounded-xl px-3 py-3 text-center">
                <p className="text-xs text-lime/50 font-medium">Select a mentee</p>
              </div>
            )}
          </div>

          {/* Create button */}
          <PermissionGate permission="timp:manage">
            <div className="flex gap-2 shrink-0">
              <button
                onClick={onGenerateAutoDraft}
                disabled={autoAssigning || applyingAuto}
                className="bg-snow border-[3px] border-lime px-4 py-2.5 rounded-2xl font-display font-bold text-sm text-navy press-3 press-lime transition-all disabled:opacity-40"
              >
                {autoAssigning ? "Building…" : "Smart Auto-Assign"}
              </button>
              <button
                onClick={onCreatePair}
                disabled={!canCreate}
                className="bg-lime border-[3px] border-navy px-6 py-2.5 rounded-2xl font-display font-bold text-sm text-navy press-3 press-navy transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creatingPair ? "Creating…" : "Create Pair"}
              </button>
            </div>
          </PermissionGate>
        </div>
      </div>

      {autoDraft.length > 0 && (
        <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[4px_4px_0_0_#000] space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Smart Auto-Assign Draft</p>
              <p className="text-sm text-navy">Review and edit these assignments before making them official.</p>
            </div>
            <button
              onClick={onApplyAutoDraft}
              disabled={applyingAuto || autoDraft.length === 0}
              className="bg-teal border-[3px] border-navy px-5 py-2 rounded-xl font-bold text-snow press-3 press-navy disabled:opacity-40"
            >
              {applyingAuto ? "Applying…" : `Apply ${autoDraft.length} Assignments`}
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {autoDraft.map((row) => {
              const mentor = mentors.find((item) => item.userId === row.mentorId);
              const mentee = mentees.find((item) => item.userId === row.menteeId);
              if (!mentee) return null;

              return (
                <div key={row.menteeId} className="bg-ghost border-[2px] border-cloud rounded-xl p-3">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate">Mentee</p>
                      <p className="text-sm font-bold text-navy">{mentee.firstName} {mentee.lastName}</p>
                    </div>

                    <span className="text-slate text-center">→</span>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate block mb-1">Mentor</label>
                      <select
                        aria-label={`Select mentor for ${mentee.firstName} ${mentee.lastName}`}
                        value={row.mentorId}
                        onChange={(event) => onUpdateAutoDraftMentor(row.menteeId, event.target.value)}
                        className="w-full px-3 py-2 bg-snow border-[2px] border-navy rounded-lg text-sm text-navy"
                      >
                        {mentors
                          .filter((item) => {
                            if (item.isFull && item.userId !== row.mentorId) return false;
                            const menteeGender = inferGender(mentee.gender);
                            const mentorGender = inferGender(item.gender);
                            if (menteeGender === "female" && mentorGender === "male") {
                              return item.userId === row.mentorId;
                            }
                            return true;
                          })
                          .map((item) => (
                            <option key={item.userId} value={item.userId}>
                              {item.userName} ({item.activePairs}/{item.maxMentees})
                            </option>
                          ))}
                      </select>
                    </div>

                    <button
                      onClick={() => onRemoveAutoDraftRow(row.menteeId)}
                      className="px-3 py-2 rounded-lg border-[2px] border-coral text-coral text-xs font-bold hover:bg-coral-light"
                    >
                      Remove
                    </button>
                  </div>

                  <p className="text-xs text-slate mt-2">{row.reason}{mentor ? ` · ${mentor.userName}` : ""}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Two-column layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Mentors column ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-black text-lg text-navy">
              Approved Mentors
              <span className="ml-2 text-sm font-medium text-slate">({mentors.length})</span>
            </h2>
          </div>
          <SearchInput value={mentorSearch} onChange={setMentorSearch} placeholder="Search mentors…" />

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {mentors.length === 0 ? (
              <EmptyState message="No approved mentors found" />
            ) : (
              mentors.map((m) => {
                const isSelected = selectedMentor?.userId === m.userId;
                return (
                  <button
                    key={m.userId}
                    onClick={() => setSelectedMentor(isSelected ? null : m)}
                    className={`w-full text-left rounded-2xl p-4 border-[3px] transition-all ${
                      isSelected
                        ? "bg-teal-light border-teal shadow-[3px_3px_0_0_#000]"
                        : m.isFull
                          ? "bg-ghost border-cloud opacity-60 cursor-not-allowed"
                          : "bg-snow border-cloud hover:border-navy hover:shadow-[3px_3px_0_0_#000]"
                    }`}
                    disabled={m.isFull}
                    title={m.isFull ? "Mentor is at full capacity" : `Select ${m.userName}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={m.userName} url={m.profilePictureUrl} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-display font-bold text-navy truncate">{m.userName}</p>
                          {m.isFull && (
                            <span className="px-2 py-0.5 rounded-md bg-coral-light text-coral text-[10px] font-bold shrink-0">
                              Full
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate truncate">{m.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {m.level && (
                            <span className="text-[10px] font-bold text-navy-muted">{m.level}</span>
                          )}
                          {m.gender && (
                            <span className="text-[10px] font-bold text-coral capitalize">{m.gender}</span>
                          )}
                          <span className="text-[10px] text-slate">{m.matricNumber}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-teal" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" />
                          </svg>
                          <span className={`text-sm font-bold ${m.isFull ? "text-coral" : "text-navy"}`}>
                            {m.activePairs}/{m.maxMentees}
                          </span>
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); onViewDetail(m.userId); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onViewDetail(m.userId); } }}
                          className="text-[10px] text-teal font-bold hover:underline mt-1 cursor-pointer"
                        >
                          View profile
                        </span>
                      </div>
                    </div>
                    {/* Skills preview */}
                    <p className="text-xs text-slate mt-2 line-clamp-1">{m.skills}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Mentees column ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-black text-lg text-navy">
              100L Freshmen
              <span className="ml-2 text-sm font-medium text-slate">({mentees.length})</span>
            </h2>
          </div>
          <div className="flex gap-2 flex-col sm:flex-row">
            <div className="flex-1">
              <SearchInput value={menteeSearch} onChange={setMenteeSearch} placeholder="Search freshmen…" />
            </div>
            <div className="flex gap-1 shrink-0">
              {(["available", "all", "paired"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setMenteeFilter(f)}
                  className={`px-3 py-2 rounded-lg text-[10px] font-bold capitalize transition-all ${
                    menteeFilter === f
                      ? "bg-navy text-snow"
                      : "bg-cloud text-navy hover:bg-navy/10"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {mentees.length === 0 ? (
              <EmptyState message="No freshmen found" />
            ) : (
              mentees.map((m) => {
                const name = `${m.firstName} ${m.lastName}`;
                const isSelected = selectedMentee?.userId === m.userId;
                return (
                  <button
                    key={m.userId}
                    onClick={() => setSelectedMentee(isSelected ? null : m)}
                    disabled={m.alreadyPaired}
                    className={`w-full text-left rounded-2xl p-4 border-[3px] transition-all ${
                      isSelected
                        ? "bg-lavender-light border-lavender shadow-[3px_3px_0_0_#000]"
                        : m.alreadyPaired
                          ? "bg-ghost border-cloud opacity-60 cursor-not-allowed"
                          : "bg-snow border-cloud hover:border-navy hover:shadow-[3px_3px_0_0_#000]"
                    }`}
                    title={m.alreadyPaired ? "Already paired" : `Select ${name}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={name} url={m.profilePictureUrl} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-display font-bold text-navy truncate">{name}</p>
                          {m.alreadyPaired && (
                            <span className="px-2 py-0.5 rounded-md bg-teal-light text-teal text-[10px] font-bold shrink-0">
                              Paired
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate truncate">{m.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-navy-muted">{m.level}</span>
                          {m.gender && (
                            <span className="text-[10px] font-bold text-coral capitalize">{m.gender}</span>
                          )}
                          <span className="text-[10px] text-slate">{m.matricNumber}</span>
                        </div>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onViewDetail(m.userId); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onViewDetail(m.userId); } }}
                        className="text-[10px] text-lavender font-bold hover:underline shrink-0 cursor-pointer"
                      >
                        View profile
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAIRS TAB COMPONENT
   ═══════════════════════════════════════════════════ */

function PairsTab({
  pairs,
  totalPairs,
  loading,
  subTab,
  setSubTab,
  page,
  setPage,
  feedbackPairId,
  feedbackHistory,
  onLoadFeedback,
  onUpdateStatus,
  onViewDetail,
  messagesPairId,
  pairMessages,
  loadingMessages,
  onLoadMessages,
}: {
  pairs: MentorshipPair[];
  totalPairs: number;
  loading: boolean;
  subTab: string;
  setSubTab: (s: string) => void;
  page: number;
  setPage: (p: number) => void;
  feedbackPairId: string | null;
  feedbackHistory: TimpFeedback[];
  onLoadFeedback: (pairId: string) => void;
  onUpdateStatus: (pairId: string, status: PairStatus) => void;
  onViewDetail: (userId: string) => void;
  messagesPairId: string | null;
  pairMessages: TimpMessage[];
  loadingMessages: boolean;
  onLoadMessages: (pairId: string) => void;
}) {
  return (
    <>
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {PAIR_TABS.map((st) => (
          <button
            key={st}
            onClick={() => setSubTab(st)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
              subTab === st
                ? "bg-navy text-snow"
                : "bg-cloud text-navy hover:bg-navy/10"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : pairs.length === 0 ? (
        <EmptyState message={`No ${subTab} pairs`} />
      ) : (
        <div className="space-y-4">
          {pairs.map((pair) => {
            const style = PAIR_STATUS_STYLES[pair.status];
            return (
              <div key={pair.id} className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                      <span className="text-xs text-slate">{pair.feedbackCount} feedback</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate uppercase">Mentor</p>
                        <button
                          onClick={() => onViewDetail(pair.mentorId)}
                          className="font-display font-bold text-navy hover:text-teal transition-colors"
                        >
                          {pair.mentorName}
                        </button>
                      </div>
                      <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M13.22 19.03a.75.75 0 0 1 0-1.06L18.19 13H3.75a.75.75 0 0 1 0-1.5h14.44l-4.97-4.97a.75.75 0 0 1 1.06-1.06l6.25 6.25a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 0 1-1.06 0Z" />
                      </svg>
                      <div>
                        <p className="text-[10px] font-bold text-slate uppercase">Mentee</p>
                        <button
                          onClick={() => onViewDetail(pair.menteeId)}
                          className="font-display font-bold text-navy hover:text-lavender transition-colors"
                        >
                          {pair.menteeName}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate mt-1">Paired since {formatDate(pair.createdAt)}</p>
                  </div>

                  <div className="flex gap-2 flex-wrap shrink-0">
                    <button
                      onClick={() => onLoadFeedback(pair.id)}
                      className="bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 text-xs font-bold text-navy press-2 press-navy transition-all"
                    >
                      {feedbackPairId === pair.id ? "Hide" : "View"} Feedback
                    </button>
                    <button
                      onClick={() => onLoadMessages(pair.id)}
                      className="bg-lavender-light border-[3px] border-navy rounded-xl px-4 py-2 text-xs font-bold text-navy press-2 press-navy transition-all"
                    >
                      {messagesPairId === pair.id ? "Hide" : "View"} Messages
                    </button>
                    {pair.status === "active" && (
                      <PermissionGate permission="timp:manage">
                        <button
                          onClick={() => onUpdateStatus(pair.id, "paused")}
                          className="bg-sunny-light border-[3px] border-navy rounded-xl px-4 py-2 text-xs font-bold text-navy press-2 press-navy transition-all"
                        >
                          Pause
                        </button>
                        <button
                          onClick={() => onUpdateStatus(pair.id, "completed")}
                          className="bg-lavender-light border-[3px] border-navy rounded-xl px-4 py-2 text-xs font-bold text-navy press-2 press-navy transition-all"
                        >
                          Complete
                        </button>
                      </PermissionGate>
                    )}
                    {pair.status === "paused" && (
                      <PermissionGate permission="timp:manage">
                      <button
                        onClick={() => onUpdateStatus(pair.id, "active")}
                        className="bg-teal-light border-[3px] border-navy rounded-xl px-4 py-2 text-xs font-bold text-navy press-2 press-navy transition-all"
                      >
                        Resume
                      </button>
                      </PermissionGate>
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
                          <p className="text-sm text-navy-muted">{fb.notes}</p>
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

                {/* Messages history (admin view) */}
                {messagesPairId === pair.id && (
                  <div className="mt-4 pt-4 border-t-[3px] border-cloud">
                    <p className="text-xs font-bold text-navy uppercase mb-3">Pair Messages</p>
                    {loadingMessages ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-6 h-6 border-[3px] border-teal border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : pairMessages.length === 0 ? (
                      <p className="text-sm text-slate">No messages exchanged yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {pairMessages.map((msg) => (
                          <div
                            key={msg._id}
                            className={`rounded-2xl p-3 border-2 ${
                              msg.senderRole === "mentor"
                                ? "bg-teal-light border-teal/20"
                                : "bg-lavender-light border-lavender/20"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                msg.senderRole === "mentor"
                                  ? "bg-teal/10 text-teal"
                                  : "bg-lavender/10 text-lavender"
                              }`}>
                                {msg.senderName} ({msg.senderRole})
                              </span>
                              <span className="text-[10px] text-slate">
                                {new Date(msg.createdAt).toLocaleString("en-NG", {
                                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-navy whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={Math.ceil(totalPairs / PAGE_SIZE)} onPage={setPage} className="mt-4" />
    </>
  );
}

export default withAuth(AdminTimpPage, {
  anyPermission: ["timp:manage"],
});
