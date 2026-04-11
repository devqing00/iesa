"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import {
  getMyIepodProfile,
  registerForIepod,
  resubmitIepodRegistration,
  listSocieties,
  commitToSociety,
  getLeaderboard,
  getQuizSystemLeaderboard,
  getHiddenTreasureForStudent,
  claimHiddenTreasure,
  PHASE_LABELS,
  PHASE_STYLES,
} from "@/lib/api";
import type {
  MyIepodProfile,
  Society,
  LeaderboardEntry,
  QuizSystemLeaderboardEntry,
  IepodPhase,
  HiddenTreasureStudentState,
} from "@/lib/api";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ─── Phase timeline component ─────────────────────────────────── */

const PHASES: IepodPhase[] = ["stimulate", "carve", "pitch"];

function PhaseTimeline({ current, completed }: { current: IepodPhase; completed: IepodPhase[] }) {
  return (
    <div className="flex items-center gap-0">
      {PHASES.map((p, i) => {
        const style = PHASE_STYLES[p];
        const isDone = completed.includes(p);
        const isCurrent = current === p;
        return (
          <div key={p} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-[3px] ${
                isDone
                  ? "bg-teal border-navy"
                  : isCurrent
                  ? `${style.bg} border-navy`
                  : "bg-cloud border-cloud"
              }`}
            >
              <span className={`font-display font-black text-xs ${isDone ? "text-snow" : isCurrent ? "text-navy" : "text-slate"}`}>
                {isDone ? "✓" : `0${i + 1}`}
              </span>
              <span className={`font-bold text-xs ${isDone ? "text-snow" : isCurrent ? "text-navy" : "text-slate"}`}>
                {PHASE_LABELS[p]}
              </span>
            </div>
            {i < 2 && (
              <div className={`w-6 h-[3px] ${isDone ? "bg-teal" : "bg-cloud"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function hasSocietyName(entry: LeaderboardEntry | QuizSystemLeaderboardEntry): entry is LeaderboardEntry {
  return "societyName" in entry;
}

function HiddenTreasureSpot({
  isVisible,
  isClaimed,
  isClaiming,
  onClaim,
}: {
  isVisible: boolean;
  isClaimed: boolean;
  isClaiming: boolean;
  onClaim: () => void;
}) {
  if (!isVisible || isClaimed) return null;
  return (
    <button
      onClick={onClaim}
      disabled={isClaiming}
      title="Hidden treasure"
      className="group absolute z-20 w-8 h-8 rounded-full border-[2px] border-navy bg-sunny text-navy press-2 press-black flex items-center justify-center"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <span className="absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-navy text-snow text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
        {isClaiming ? "Claiming..." : "Claim"}
      </span>
    </button>
  );
}

/* ─── Registration form ────────────────────────────────────────── */

function RegistrationForm({
  societies,
  onSubmit,
  submitLabel,
}: {
  societies: Society[];
  onSubmit: (data: {
    interests: string[];
    whyJoin: string;
    priorExperience?: string;
    preferredSocietyId?: string;
  }) => Promise<void>;
  submitLabel?: string;
}) {
  const [interests, setInterests] = useState<string[]>([]);
  const [whyJoin, setWhyJoin] = useState("");
  const [priorExperience, setPriorExperience] = useState("");
  const [preferredSociety, setPreferredSociety] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const INTEREST_OPTIONS = [
    // Core IPE
    "Manufacturing Systems",
    "Operations Research",
    "Supply Chain",
    "Quality Engineering",
    "Ergonomics & Human Factors",
    "Project Management",
    // Technology & Engineering
    "Renewable Energy & Sustainability",
    "Robotics",
    "Electronics & Electrical Systems",
    "AI & Automation",
    "Data Science",
    "Agricultural Engineering",
    // Business & Policy
    "Entrepreneurship & Innovation",
    "Finance & Investment",
    "Intellectual Property & Tech Law",
    "International Relations & Policy",
    // Professional
    "Engineering Diversity & Inclusion",
    "Startup Culture",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (interests.length === 0) {
      toast.error("Select at least one interest area");
      return;
    }
    if (whyJoin.length < 10) {
      toast.error("Please write at least 10 characters about why you want to join");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        interests,
        whyJoin,
        priorExperience: priorExperience || undefined,
        preferredSocietyId: preferredSociety || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Interests */}
      <div>
        <label className="text-label text-navy mb-2 block">Interest Areas (select up to 5)</label>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((opt) => {
            const selected = interests.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (selected) setInterests(interests.filter((i) => i !== opt));
                  else if (interests.length < 5) setInterests([...interests, opt]);
                }}
                className={`px-3 py-1.5 rounded-xl border-[2px] text-xs font-bold transition-all ${
                  selected
                    ? "bg-lime border-navy text-navy"
                    : "bg-snow border-cloud text-slate hover:border-navy"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Why join */}
      <div>
        <label className="text-label text-navy mb-2 block">Why do you want to join IEPOD?</label>
        <textarea
          value={whyJoin}
          onChange={(e) => setWhyJoin(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Share your motivation and what you hope to gain..."
          className="w-full border-[3px] border-navy rounded-xl px-4 py-3 font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none"
        />
      </div>

      {/* Prior experience */}
      <div>
        <label className="text-label text-navy mb-2 block">Prior Experience (optional)</label>
        <textarea
          value={priorExperience}
          onChange={(e) => setPriorExperience(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Any relevant projects, competitions, or skills..."
          className="w-full border-[3px] border-navy rounded-xl px-4 py-3 font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none"
        />
      </div>

      {/* Preferred society */}
      <div>
        <label htmlFor="preferred-society" className="text-label text-navy mb-2 block">Preferred Society (optional)</label>
        <select
          id="preferred-society"
          aria-label="Preferred Society"
          value={preferredSociety}
          onChange={(e) => setPreferredSociety(e.target.value)}
          className="w-full border-[3px] border-navy rounded-xl px-4 py-3 font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime"
        >
          <option value="">No preference yet</option>
          {societies.map((s) => (
            <option key={s._id} value={s._id}>{s.name} ({s.shortName})</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-lime border-[4px] border-navy press-5 press-navy px-8 py-4 rounded-2xl font-display font-black text-lg text-navy transition-all disabled:opacity-50"
      >
        {submitting ? "Submitting..." : submitLabel || "Apply for IEPOD"}
      </button>
    </form>
  );
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default function IepodStudentPage() {
  const { user } = useAuth();
  const { hasAnyPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const { showHelp, openHelp, closeHelp } = useToolHelp("iepod");
  const [profile, setProfile] = useState<MyIepodProfile | null>(null);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [quizLeaderboard, setQuizLeaderboard] = useState<QuizSystemLeaderboardEntry[]>([]);
  const [leaderboardView, setLeaderboardView] = useState<"general" | "quiz">("general");
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsHistoryView, setPointsHistoryView] = useState<"all" | "general" | "quiz">("all");
  const [treasureState, setTreasureState] = useState<HiddenTreasureStudentState | null>(null);
  const [claimingTreasure, setClaimingTreasure] = useState(false);
  const [loading, setLoading] = useState(true);
  const [committingSociety, setCommittingSociety] = useState<string | null>(null);
  const [showAlreadySubmittedBadge, setShowAlreadySubmittedBadge] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [profileData, societyData, lbData, quizLbData, treasureData] = await Promise.allSettled([
        getMyIepodProfile(),
        listSocieties(),
        getLeaderboard(50),
        getQuizSystemLeaderboard(50),
        getHiddenTreasureForStudent(),
      ]);

      if (profileData.status === "fulfilled") setProfile(profileData.value);
      if (societyData.status === "fulfilled") setSocieties(societyData.value);
      if (lbData.status === "fulfilled") setLeaderboard(lbData.value);
      if (quizLbData.status === "fulfilled") setQuizLeaderboard(quizLbData.value);
      if (treasureData.status === "fulfilled") setTreasureState(treasureData.value);
    } catch {
      toast.error("Failed to load IEPOD data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  useEffect(() => {
    if (permissionsLoading) return;
    if (hasAnyPermission(["iepod:manage", "iepod:view"])) {
      router.replace("/dashboard/iepod/manage");
    }
  }, [hasAnyPermission, permissionsLoading, router]);

  const handleRegister = async (data: {
    interests: string[];
    whyJoin: string;
    priorExperience?: string;
    preferredSocietyId?: string;
  }) => {
    try {
      const result = await registerForIepod(data);
      if (result?.alreadyRegistered || result?.reason === "already_registered") {
        toast.info("You are already registered for IEPOD this session.");
        setShowAlreadySubmittedBadge(true);
      } else {
        toast.success("Application submitted! You'll be notified once approved.");
        setShowAlreadySubmittedBadge(false);
      }
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      toast.error(msg);
    }
  };

  const handleResubmit = async (data: {
    interests: string[];
    whyJoin: string;
    priorExperience?: string;
    preferredSocietyId?: string;
  }) => {
    try {
      await resubmitIepodRegistration(data);
      toast.success("Application resubmitted! Your application is now pending review.");
      setShowAlreadySubmittedBadge(false);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Resubmission failed";
      toast.error(msg);
    }
  };

  const handleCommitSociety = async (societyId: string) => {
    setCommittingSociety(societyId);
    try {
      const res = await commitToSociety(societyId);
      toast.success(res.message);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to commit";
      toast.error(msg);
    } finally {
      setCommittingSociety(null);
    }
  };

  const handleClaimTreasure = async () => {
    if (!treasureState?.active || !treasureState.locationKey || claimingTreasure) return;
    setClaimingTreasure(true);
    try {
      const res = await claimHiddenTreasure(treasureState.locationKey);
      const rankHint = typeof res.rank === "number" ? ` (Rank #${res.rank})` : "";
      toast.success(`${res.message}${rankHint}`);
      setTreasureState((prev) => prev ? { ...prev, claimed: true, claimedAt: new Date().toISOString() } : prev);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not claim treasure";
      toast.error(msg);
    } finally {
      setClaimingTreasure(false);
    }
  };

  if (permissionsLoading || loading) {
    return (
      <div className="min-h-screen">
        <DashboardHeader title="IEPOD Hub" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-snow border-[3px] border-cloud rounded-2xl p-6 animate-pulse">
                <div className="h-4 bg-cloud rounded w-1/3 mb-4" />
                <div className="h-8 bg-cloud rounded w-2/3 mb-2" />
                <div className="h-4 bg-cloud rounded w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const reg = profile?.registration;
  const isRegistered = profile?.registered;
  const currentPhase = reg?.phase;
  const canAccessNicheAudit = currentPhase === "carve" || currentPhase === "pitch";
  const canAccessTeamEcosystem = currentPhase === "pitch";
  const preferredSociety = !profile?.society && reg?.preferredSocietyId
    ? societies.find((s) => s._id === reg.preferredSocietyId)
    : null;
  const activeLeaderboard = leaderboardView === "general" ? leaderboard : quizLeaderboard;
  const myLeaderboardEntry = activeLeaderboard.find((entry) => entry.userId === user?.id);
  const showMyPosition = Boolean(myLeaderboardEntry && myLeaderboardEntry.rank > 5);
  const generalPointsHistory = profile?.pointsHistory ?? [];
  const quizPointsHistory = profile?.quizPointsHistory ?? [];
  const allPointsHistory = [
    ...generalPointsHistory.map((entry) => ({
      id: entry._id,
      board: "general" as const,
      label: entry.action,
      description: entry.description,
      points: entry.points,
      awardedAt: entry.awardedAt,
    })),
    ...quizPointsHistory.map((entry) => ({
      id: entry._id,
      board: "quiz" as const,
      label: entry.source,
      description: entry.description,
      points: entry.points,
      awardedAt: entry.awardedAt,
    })),
  ].sort((a, b) => new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime());
  const filteredPointsHistory =
    pointsHistoryView === "all"
      ? allPointsHistory
      : allPointsHistory.filter((entry) => entry.board === pointsHistoryView);
  const activeTreasureLocation = treasureState?.active ? (treasureState.locationKey || "") : "";
  const treasureClaimed = Boolean(treasureState?.claimed);

  return (
    <div className="min-h-screen">
      <DashboardHeader title="IEPOD Hub" />
      <ToolHelpModal toolId="iepod" isOpen={showHelp} onClose={closeHelp} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-end mb-3"><HelpButton onClick={openHelp} /></div>
        {/* ── Not Registered ──────────────────────────────────── */}
        {!isRegistered && (
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-navy border-[4px] border-lime rounded-3xl p-8 shadow-[8px_8px_0_0_#C8F31D]">
                <h2 className="font-display font-black text-2xl text-lime mb-4">
                  Process Drivers
                </h2>
                <p className="text-lime/70 font-medium text-sm leading-relaxed mb-6">
                  Your Process, Our Progress. Join the IEPOD program to transform how you think,
                  build, and present engineering solutions.
                </p>
                <div className="space-y-3">
                  {(["stimulate", "carve", "pitch"] as IepodPhase[]).map((p, i) => {
                    const style = PHASE_STYLES[p];
                    return (
                      <div key={p} className="flex items-center gap-3">
                        <span className={`${style.bg} border-[2px] border-navy/20 text-navy font-display font-black text-xs w-8 h-8 rounded-lg flex items-center justify-center`}>
                          0{i + 1}
                        </span>
                        <span className="text-lime/80 font-bold text-sm">{PHASE_LABELS[p]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Link
                href="/iepod"
                className="block text-center bg-transparent border-[3px] border-navy px-6 py-3 rounded-xl font-display font-bold text-navy hover:bg-navy hover:text-lime transition-all"
              >
                Learn more about IEPOD &rarr;
              </Link>
            </div>

            {/* Right: registration form */}
            <div className="lg:col-span-3">
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000]">
                <h3 className="font-display font-black text-xl text-navy mb-6">Apply for IEPOD</h3>
                <RegistrationForm societies={societies} onSubmit={handleRegister} />
              </div>
            </div>
          </div>
        )}

        {/* ── Registered — pending approval ───────────────────── */}
        {isRegistered && reg?.status === "pending" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-sunny border-[4px] border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] text-center space-y-4">
              {showAlreadySubmittedBadge && (
                <div className="inline-flex items-center gap-2 bg-lime border-[2px] border-navy rounded-xl px-3 py-1.5">
                  <span className="text-label-sm text-navy font-bold">Already submitted</span>
                </div>
              )}
              <div className="w-16 h-16 bg-navy rounded-2xl flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-sunny" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="font-display font-black text-2xl text-navy">Application Pending</h2>
              <p className="text-slate font-medium">
                Your IEPOD application has been submitted. You&apos;ll be notified once an admin reviews it.
              </p>
              {reg.adminNote && (
                <div className="bg-snow/50 rounded-xl p-4 text-left">
                  <p className="text-label text-navy mb-1">Admin Note</p>
                  <p className="text-navy-muted text-sm">{reg.adminNote}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Registered — rejected ───────────────────────────── */}
        {isRegistered && reg?.status === "rejected" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-coral-light border-[4px] border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] space-y-5">
              <h2 className="font-display font-black text-2xl text-navy">Application Not Approved</h2>
              <p className="text-slate font-medium text-sm">
                Your last submission was not approved. Review the feedback below, update your details, and re-submit for another review.
              </p>
              {reg.adminNote && (
                <div className="bg-snow/50 rounded-xl p-4 text-left">
                  <p className="text-label text-navy mb-1">Reason</p>
                  <p className="text-navy-muted text-sm">{reg.adminNote}</p>
                </div>
              )}
              <div className="bg-snow border-[3px] border-navy rounded-2xl p-5">
                <h3 className="font-display font-black text-lg text-navy mb-4">Re-submit Application</h3>
                <RegistrationForm
                  societies={societies}
                  onSubmit={handleResubmit}
                  submitLabel="Re-submit IEPOD Application"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Registered — approved (main dashboard) ──────────── */}
        {isRegistered && reg?.status === "approved" && (
          <div className="space-y-8">
            <div className="bg-teal-light border-[4px] border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="font-display font-black text-sm text-navy">Participants WhatsApp Group</h4>
                <p className="text-navy-muted text-xs mt-1">
                  Your IEPOD registration is approved. Join the official participants group for updates and coordination.
                </p>
              </div>
              <a
                href="https://chat.whatsapp.com/Cbx4hDBzlCKKg9FDW8bmiz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-lime border-[3px] border-navy rounded-xl px-4 py-2 font-display font-black text-xs text-navy press-2 press-navy whitespace-nowrap"
              >
                Join WhatsApp Group
              </a>
            </div>

            {treasureState?.active && (
              <div className="bg-sunny-light border-[4px] border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-display font-black text-sm text-navy">{treasureState.title || "Hidden Treasure"}</h4>
                    <p className="text-navy-muted text-xs mt-1">{treasureState.clue || "A hidden spark is waiting somewhere in this page."}</p>
                    <p className="text-[11px] font-bold text-navy mt-2">Reward: +{treasureState.points || 0} points</p>
                    {treasureState.finderMode === "first_bonus" && (treasureState.firstFinderBonusPoints || 0) > 0 && (
                      <p className="text-[11px] font-bold text-navy mt-1">First finder bonus: +{treasureState.firstFinderBonusPoints}</p>
                    )}
                    {treasureState.finderMode === "top_n" && (
                      <p className="text-[11px] font-bold text-navy mt-1">
                        Top {treasureState.topNFinders || 0} mode
                        {typeof treasureState.remainingClaims === "number" ? ` • Remaining slots: ${treasureState.remainingClaims}` : ""}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${treasureClaimed ? "bg-teal text-snow" : "bg-coral text-snow"}`}>
                    {treasureClaimed ? "Claimed" : "Hunt Active"}
                  </span>
                </div>
              </div>
            )}

            {Boolean(treasureState && !treasureState.active && treasureState.eligible && treasureState.windowOpen === false) && (
              <div className="bg-cloud border-[4px] border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000]">
                <h4 className="font-display font-black text-sm text-navy">{treasureState?.title || "Hidden Treasure"}</h4>
                <p className="text-navy-muted text-xs mt-1">Treasure hunt window is currently closed. Check back during the active schedule.</p>
              </div>
            )}

            {Boolean(treasureState && !treasureState.active && treasureState.eligible && treasureState.roundFull) && (
              <div className="bg-cloud border-[4px] border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000]">
                <h4 className="font-display font-black text-sm text-navy">{treasureState?.title || "Hidden Treasure"}</h4>
                <p className="text-navy-muted text-xs mt-1">This round is complete. All winner slots for this treasure have been claimed.</p>
              </div>
            )}

            {reg.isExternalStudent && (
              <div className="bg-sunny-light border-[4px] border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000] flex items-start gap-4">
                <svg className="w-6 h-6 text-sunny shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="font-display font-black text-sm text-navy">Cross-Department Participant</h4>
                  <p className="text-navy-muted text-xs mt-1">
                    Welcome from <strong>{reg.department}</strong>. You have full access to IEPOD activities, including Niche Audit, team collaboration, and submissions.
                  </p>
                </div>
              </div>
            )}

            {/* Phase timeline */}
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] overflow-x-auto relative">
              <div className="absolute top-2 right-2">
                <HiddenTreasureSpot
                  isVisible={activeTreasureLocation === "phase_timeline"}
                  isClaimed={treasureClaimed}
                  isClaiming={claimingTreasure}
                  onClaim={handleClaimTreasure}
                />
              </div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-black text-lg text-navy">Your Journey</h3>
                <span className="bg-lime border-[2px] border-navy text-navy font-display font-black text-xs px-3 py-1 rounded-lg">
                  {reg.points} pts
                </span>
              </div>
              <PhaseTimeline current={reg.phase} completed={reg.completedPhases} />
            </div>

            {/* Bento grid */}
            <div className="grid md:grid-cols-3 gap-5">
              {/* Society commitment card */}
              <div className={`${profile?.society ? "bg-teal" : "bg-lavender"} border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform relative`}>
                <div className="absolute top-2 right-2">
                  <HiddenTreasureSpot
                    isVisible={activeTreasureLocation === "society_card"}
                    isClaimed={treasureClaimed}
                    isClaiming={claimingTreasure}
                    onClaim={handleClaimTreasure}
                  />
                </div>
                <h4 className="font-display font-black text-sm text-navy mb-3">
                  {profile?.society ? "Your Society" : preferredSociety ? "Preferred Society" : "Choose Your Society"}
                </h4>
                {profile?.society || preferredSociety ? (
                  <div>
                    <p className="font-display font-black text-xl text-navy">{(profile?.society || preferredSociety)?.shortName}</p>
                    <p className="text-navy-muted text-sm font-medium mt-1">{(profile?.society || preferredSociety)?.name}</p>
                    <p className="text-navy-muted text-xs font-medium mt-1">{(profile?.society || preferredSociety)?.focusArea}</p>
                    {!profile?.society && preferredSociety && (
                      <div className="mt-3 space-y-2">
                        <p className="text-[11px] text-navy-muted font-medium">
                          This was your application preference. Confirming now finalizes your commitment.
                        </p>
                        <button
                          onClick={() => handleCommitSociety(preferredSociety._id)}
                          disabled={committingSociety !== null}
                          className="bg-snow border-[2px] border-navy rounded-xl px-3 py-1.5 text-xs font-bold text-navy press-2 press-navy disabled:opacity-60"
                        >
                          {committingSociety === preferredSociety._id ? "Confirming..." : "Confirm Society"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {societies.slice(0, 4).map((s) => (
                      <button
                        key={s._id}
                        onClick={() => handleCommitSociety(s._id)}
                        disabled={committingSociety !== null}
                        className="w-full text-left flex items-center justify-between bg-snow/30 hover:bg-snow/50 rounded-xl px-3 py-2 transition-colors"
                      >
                        <span className="font-bold text-xs text-navy">{s.shortName}</span>
                        {committingSociety === s._id ? (
                          <span className="text-[10px] text-slate">Joining...</span>
                        ) : (
                          <span className="text-[10px] text-slate">Commit &rarr;</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Niche Audit card */}
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] relative">
                <div className="absolute top-2 right-2">
                  <HiddenTreasureSpot
                    isVisible={activeTreasureLocation === "niche_audit_card"}
                    isClaimed={treasureClaimed}
                    isClaiming={claimingTreasure}
                    onClaim={handleClaimTreasure}
                  />
                </div>
                <h4 className="font-display font-black text-sm text-navy mb-3">Niche Audit</h4>
                {!canAccessNicheAudit ? (
                  <div>
                    <div className="bg-sunny-light rounded-xl px-3 py-1 inline-block mb-2 border border-navy/20">
                      <span className="text-navy font-bold text-xs">Locked Until Carve Phase</span>
                    </div>
                    <p className="text-slate text-xs">
                      Niche Audit unlocks in Phase 2 (Carve Your Niche). Current phase: {PHASE_LABELS[currentPhase || "stimulate"]}.
                    </p>
                  </div>
                ) : profile?.nicheAudit ? (
                  <div>
                    <div className="bg-teal-light rounded-xl px-3 py-1 inline-block mb-2">
                      <span className="text-teal font-bold text-xs">Completed</span>
                    </div>
                    <p className="text-navy-muted text-sm font-medium line-clamp-3">
                      {profile.nicheAudit.focusProblem}
                    </p>
                    <Link
                      href="/dashboard/iepod/niche-audit"
                      className="text-lavender font-bold text-xs mt-2 inline-block hover:underline"
                    >
                      Edit audit &rarr;
                    </Link>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate text-sm mb-3">
                      Define your focus, constraints, and target problem.
                    </p>
                    <Link
                      href="/dashboard/iepod/niche-audit"
                      className="bg-lavender border-[2px] border-navy text-snow font-bold text-xs px-4 py-2 rounded-xl press-2 press-navy inline-block"
                    >
                      Start Audit
                    </Link>
                  </div>
                )}
              </div>

              {/* Hackathon team card */}
              <div className="bg-coral border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform relative">
                <div className="absolute top-2 right-2">
                  <HiddenTreasureSpot
                    isVisible={activeTreasureLocation === "team_card"}
                    isClaimed={treasureClaimed}
                    isClaiming={claimingTreasure}
                    onClaim={handleClaimTreasure}
                  />
                </div>
                <h4 className="font-display font-black text-sm text-snow mb-3">Hackathon Team</h4>
                {!canAccessTeamEcosystem ? (
                  <div>
                    <div className="bg-sunny-light rounded-xl px-3 py-1 inline-block mb-2 border border-navy/20">
                      <span className="text-navy font-bold text-xs">Opens in Pitch Phase</span>
                    </div>
                    <p className="text-snow text-sm">
                      Team formation unlocks in Phase 3 (Pitch Your Process). Current phase: {PHASE_LABELS[currentPhase || "stimulate"]}.
                    </p>
                  </div>
                ) : profile?.team ? (
                  <div>
                    <p className="font-display font-black text-lg text-navy">{profile.team.name}</p>
                    <p className="text-slate text-xs font-medium mt-1">
                      {profile.team.members.length}/{profile.team.maxMembers} members
                    </p>
                    <p className="text-slate text-xs mt-1">
                      {profile.team.submissionCount} submission{profile.team.submissionCount !== 1 ? "s" : ""}
                    </p>
                    <Link
                      href="/dashboard/iepod/team"
                      className="text-navy font-bold text-xs mt-2 inline-block hover:underline"
                    >
                      Manage team &rarr;
                    </Link>
                  </div>
                ) : (
                  <div>
                    <p className="text-snow text-sm mb-3">Form or join a team for the hackathon finale.</p>
                    <Link
                      href="/dashboard/iepod/team"
                      className="bg-navy border-[2px] border-lime text-lime font-bold text-xs px-4 py-2 rounded-xl press-2 press-lime inline-block"
                    >
                      Find a Team
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Second row: quizzes + leaderboard */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* Quizzes & Challenges */}
              <div className="bg-[linear-gradient(145deg,#2C1A7A_0%,#4A28A8_55%,#6A35CC_100%)] border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] relative overflow-hidden">
                <div className="absolute top-2 right-2">
                  <HiddenTreasureSpot
                    isVisible={activeTreasureLocation === "quizzes_card"}
                    isClaimed={treasureClaimed}
                    isClaiming={claimingTreasure}
                    onClaim={handleClaimTreasure}
                  />
                </div>
                {/* <div className="absolute inset-x-3 -bottom-3 h-full rounded-3xl bg-lavender-light/35 border border-snow/20" /> */}
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-black text-base text-snow">Quizzes & Challenges</h4>
                    <Link
                      href="/dashboard/iepod/quizzes"
                      className="text-snow/80 font-bold text-xs hover:underline"
                    >
                      View all &rarr;
                    </Link>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="bg-snow border border-navy/20 rounded-2xl p-4 space-y-2">
                      <p className="text-label-sm text-navy">Live Arena</p>
                      <p className="text-xs text-navy-muted">Join host-led quiz rounds with real-time standings and timed reveals.</p>
                      <Link
                        href="/dashboard/iepod/quizzes"
                        className="inline-flex items-center justify-center w-full bg-coral border-[2px] border-navy rounded-xl px-3 py-2 font-display font-black text-xs text-snow press-2 press-black"
                      >
                        Join Live Arena
                      </Link>
                    </div>
                    <div className="bg-snow border border-navy/20 rounded-2xl p-4 space-y-2">
                      <p className="text-label-sm text-navy">Practice Decks</p>
                      <p className="text-xs text-navy-muted">Play regular quiz sets, track your pace, and improve your score history.</p>
                      <Link
                        href="/dashboard/iepod/quizzes"
                        className="inline-flex items-center justify-center w-full bg-lime border-[2px] border-navy rounded-xl px-3 py-2 font-display font-black text-xs text-navy press-2 press-navy"
                      >
                        Open Practice
                      </Link>
                    </div>
                  </div>

                  {profile?.quizResults && profile.quizResults.length > 0 ? (
                    <div className="space-y-2">
                      {profile.quizResults.slice(0, 2).map((qr) => (
                        <div key={qr._id} className="flex items-center justify-between bg-snow rounded-xl px-4 py-3 border border-navy/20">
                          <div>
                            <p className="font-bold text-sm text-navy">Recent Result</p>
                            <p className="text-slate text-xs">{new Date(qr.submittedAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-display font-black text-lg text-navy">{qr.score}/{qr.maxScore}</span>
                            <p className="text-xs text-slate">{qr.percentage}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-snow/90 border border-snow/40 rounded-xl p-3 text-center">
                      <p className="text-navy text-xs font-bold">No practice quiz result yet. Live arena rounds are tracked separately on the quiz leaderboard.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Leaderboard */}
              <div className="bg-navy border-[4px] border-lime rounded-3xl p-6 shadow-[6px_6px_0_0_#C8F31D] relative">
                <div className="absolute top-2 right-2">
                  <HiddenTreasureSpot
                    isVisible={activeTreasureLocation === "leaderboard_card"}
                    isClaimed={treasureClaimed}
                    isClaiming={claimingTreasure}
                    onClaim={handleClaimTreasure}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h4 className="font-display font-black text-base text-lime">Leaderboard</h4>
                  <div className="inline-flex rounded-xl border border-lime/30 p-1 bg-navy-light">
                    <button
                      onClick={() => setLeaderboardView("general")}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                        leaderboardView === "general" ? "bg-lime text-navy" : "text-lime/70"
                      }`}
                    >
                      General
                    </button>
                    <button
                      onClick={() => setLeaderboardView("quiz")}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                        leaderboardView === "quiz" ? "bg-lime text-navy" : "text-lime/70"
                      }`}
                    >
                      Quiz
                    </button>
                  </div>
                </div>
                {activeLeaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {activeLeaderboard.slice(0, 5).map((entry) => {
                      const isMe = entry.userId === user?.id;
                      return (
                        <div
                          key={entry.userId}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
                            isMe ? "bg-lime/20" : "bg-navy-light"
                          }`}
                        >
                          <span className={`font-display font-black text-sm w-6 text-center ${
                            entry.rank <= 3 ? "text-sunny" : "text-lime/50"
                          }`}>
                            #{entry.rank}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-sm truncate ${isMe ? "text-lime" : "text-lime/80"}`}>
                              {entry.userName} {isMe && "(You)"}
                            </p>
                            {hasSocietyName(entry) && entry.societyName && (
                              <p className="text-lime/40 text-[10px]">{entry.societyName}</p>
                            )}
                          </div>
                          <span className="font-display font-black text-sm text-lime">
                            {entry.totalPoints}
                          </span>
                        </div>
                      );
                    })}
                    {showMyPosition && myLeaderboardEntry && (
                      <div className="mt-3 rounded-xl border border-lime/30 bg-lime/10 px-3 py-2">
                        <p className="text-[11px] font-bold text-lime">
                          Your position: #{myLeaderboardEntry.rank} with {myLeaderboardEntry.totalPoints} points
                        </p>
                      </div>
                    )}
                    {!myLeaderboardEntry && (
                      <div className="mt-3 rounded-xl border border-lime/20 bg-navy-light px-3 py-2">
                        <p className="text-[11px] font-bold text-lime/80">
                          You are not ranked on this board yet. Complete activities to enter the standings.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-lime/50 text-sm text-center py-6">No leaderboard data yet</p>
                )}
              </div>
            </div>

            {/* Points history */}
            {allPointsHistory.length > 0 && (
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] relative">
                <div className="absolute top-2 right-2">
                  <HiddenTreasureSpot
                    isVisible={activeTreasureLocation === "points_history_card"}
                    isClaimed={treasureClaimed}
                    isClaiming={claimingTreasure}
                    onClaim={handleClaimTreasure}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h4 className="font-display font-black text-base text-navy">Recent Points</h4>
                  <button
                    onClick={() => setShowPointsModal(true)}
                    className="bg-lime border-2 border-navy rounded-xl px-3 py-1.5 text-xs font-bold text-navy press-2 press-navy"
                  >
                    View Full History
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {allPointsHistory.slice(0, 6).map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-ghost rounded-xl px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-navy truncate">{p.description}</p>
                        <p className="text-[10px] font-bold text-navy-muted uppercase tracking-wide">
                          {p.board === "general" ? "General" : "Quiz"} • {p.label.replace(/_/g, " ")}
                        </p>
                        <p className="text-slate text-[10px]">
                          {new Date(p.awardedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="bg-lime border-[2px] border-navy text-navy font-display font-black text-xs px-2 py-1 rounded-lg shrink-0 ml-2">
                        {p.points > 0 ? "+" : ""}{p.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Modal
              isOpen={showPointsModal}
              onClose={() => setShowPointsModal(false)}
              title="IEPOD Points History"
              size="lg"
            >
              <div className="space-y-4">
                <div className="inline-flex rounded-xl border border-navy/30 p-1 bg-ghost">
                  <button
                    onClick={() => setPointsHistoryView("all")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg ${pointsHistoryView === "all" ? "bg-lime text-navy" : "text-navy-muted"}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPointsHistoryView("general")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg ${pointsHistoryView === "general" ? "bg-lime text-navy" : "text-navy-muted"}`}
                  >
                    General
                  </button>
                  <button
                    onClick={() => setPointsHistoryView("quiz")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg ${pointsHistoryView === "quiz" ? "bg-lime text-navy" : "text-navy-muted"}`}
                  >
                    Quiz
                  </button>
                </div>

                <div className="rounded-2xl border-2 border-cloud max-h-[60vh] overflow-y-auto divide-y divide-cloud">
                  {filteredPointsHistory.length > 0 ? (
                    filteredPointsHistory.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0 pr-3">
                          <p className="font-bold text-sm text-navy truncate">{entry.description}</p>
                          <p className="text-xs text-navy-muted mt-0.5 uppercase tracking-wide">
                            {entry.board === "general" ? "General" : "Quiz"} • {entry.label.replace(/_/g, " ")}
                          </p>
                          <p className="text-[11px] text-slate mt-0.5">
                            {new Date(entry.awardedAt).toLocaleString()}
                          </p>
                        </div>
                        <span className="bg-lime border-2 border-navy text-navy font-display font-black text-xs px-2.5 py-1 rounded-lg shrink-0">
                          {entry.points > 0 ? "+" : ""}{entry.points}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-slate">
                      No points history found for this view yet.
                    </div>
                  )}
                </div>
              </div>
            </Modal>
          </div>
        )}
      </div>
    </div>
  );
}
