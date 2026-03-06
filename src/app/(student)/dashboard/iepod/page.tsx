"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { toast } from "sonner";
import {
  getMyIepodProfile,
  registerForIepod,
  listSocieties,
  commitToSociety,
  getLeaderboard,
  PHASE_LABELS,
  PHASE_STYLES,
  REG_STATUS_STYLES,
} from "@/lib/api";
import type {
  MyIepodProfile,
  Society,
  LeaderboardEntry,
  IepodPhase,
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

/* ─── Registration form ────────────────────────────────────────── */

function RegistrationForm({
  societies,
  onSubmit,
}: {
  societies: Society[];
  onSubmit: (data: {
    interests: string[];
    whyJoin: string;
    priorExperience?: string;
    preferredSocietyId?: string;
  }) => Promise<void>;
}) {
  const [interests, setInterests] = useState<string[]>([]);
  const [whyJoin, setWhyJoin] = useState("");
  const [priorExperience, setPriorExperience] = useState("");
  const [preferredSociety, setPreferredSociety] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const INTEREST_OPTIONS = [
    "Renewable Energy",
    "Manufacturing Systems",
    "Operations Research",
    "Supply Chain",
    "Quality Engineering",
    "Data Science",
    "Ergonomics & Human Factors",
    "Project Management",
    "AI & Automation",
    "Entrepreneurship",
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
        <label className="text-label text-navy mb-2 block">Preferred Society (optional)</label>
        <select
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
        {submitting ? "Submitting..." : "Apply for IEPOD"}
      </button>
    </form>
  );
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default function IepodStudentPage() {
  const { user } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("iepod");
  const [profile, setProfile] = useState<MyIepodProfile | null>(null);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [committingSociety, setCommittingSociety] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [profileData, societyData, lbData] = await Promise.allSettled([
        getMyIepodProfile(),
        listSocieties(),
        getLeaderboard(20),
      ]);

      if (profileData.status === "fulfilled") setProfile(profileData.value);
      if (societyData.status === "fulfilled") setSocieties(societyData.value);
      if (lbData.status === "fulfilled") setLeaderboard(lbData.value);
    } catch {
      toast.error("Failed to load IEPOD data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleRegister = async (data: {
    interests: string[];
    whyJoin: string;
    priorExperience?: string;
    preferredSocietyId?: string;
  }) => {
    try {
      await registerForIepod(data);
      toast.success("Application submitted! You'll be notified once approved.");
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
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

  if (loading) {
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
              <div className="w-16 h-16 bg-navy rounded-2xl flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="font-display font-black text-2xl text-navy">Application Pending</h2>
              <p className="text-navy/70 font-medium">
                Your IEPOD application has been submitted. You&apos;ll be notified once an admin reviews it.
              </p>
              {reg.adminNote && (
                <div className="bg-snow/50 rounded-xl p-4 text-left">
                  <p className="text-label text-navy mb-1">Admin Note</p>
                  <p className="text-navy/80 text-sm">{reg.adminNote}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Registered — rejected ───────────────────────────── */}
        {isRegistered && reg?.status === "rejected" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-coral-light border-[4px] border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] text-center space-y-4">
              <h2 className="font-display font-black text-2xl text-navy">Application Not Approved</h2>
              <p className="text-navy/70 font-medium">
                Unfortunately your application was not approved this session.
              </p>
              {reg.adminNote && (
                <div className="bg-snow/50 rounded-xl p-4 text-left">
                  <p className="text-label text-navy mb-1">Reason</p>
                  <p className="text-navy/80 text-sm">{reg.adminNote}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Registered — approved (main dashboard) ──────────── */}
        {isRegistered && reg?.status === "approved" && (
          <div className="space-y-8">
            {/* External student banner */}
            {reg.isExternalStudent && (
              <div className="bg-sunny-light border-[4px] border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000] flex items-start gap-4">
                <svg className="w-6 h-6 text-sunny shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="font-display font-black text-sm text-navy">External Participant</h4>
                  <p className="text-navy-muted text-xs mt-1">
                    Welcome from <strong>{reg.department}</strong>! As a cross-department participant, you can attend sessions, join teams, and earn points.
                    Niche Audit, team creation, and submissions are exclusive to IPE students.
                  </p>
                </div>
              </div>
            )}

            {/* Phase timeline */}
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] overflow-x-auto">
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
              <div className={`${profile?.society ? "bg-teal" : "bg-lavender"} border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform`}>
                <h4 className="font-display font-black text-sm text-navy mb-3">
                  {profile?.society ? "Your Society" : "Choose Your Society"}
                </h4>
                {profile?.society ? (
                  <div>
                    <p className="font-display font-black text-xl text-navy">{profile.society.shortName}</p>
                    <p className="text-navy/80 text-sm font-medium mt-1">{profile.society.name}</p>
                    <p className="text-navy/60 text-xs font-medium mt-1">{profile.society.focusArea}</p>
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
                          <span className="text-[10px] text-navy/60">Joining...</span>
                        ) : (
                          <span className="text-[10px] text-navy/60">Commit &rarr;</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Niche Audit card */}
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                <h4 className="font-display font-black text-sm text-navy mb-3">Niche Audit</h4>
                {reg.isExternalStudent ? (
                  <div>
                    <div className="bg-cloud rounded-xl px-3 py-1 inline-block mb-2">
                      <span className="text-slate font-bold text-xs">IPE Only</span>
                    </div>
                    <p className="text-slate text-xs">
                      The Niche Audit is exclusive to Industrial &amp; Production Engineering students.
                    </p>
                  </div>
                ) : profile?.nicheAudit ? (
                  <div>
                    <div className="bg-teal-light rounded-xl px-3 py-1 inline-block mb-2">
                      <span className="text-teal font-bold text-xs">Completed</span>
                    </div>
                    <p className="text-navy/80 text-sm font-medium line-clamp-3">
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
                    <p className="text-navy/60 text-sm mb-3">
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
              <div className="bg-coral border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
                <h4 className="font-display font-black text-sm text-navy mb-3">Hackathon Team</h4>
                {profile?.team ? (
                  <div>
                    <p className="font-display font-black text-lg text-navy">{profile.team.name}</p>
                    <p className="text-navy/70 text-xs font-medium mt-1">
                      {profile.team.members.length}/{profile.team.maxMembers} members
                    </p>
                    <p className="text-navy/60 text-xs mt-1">
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
                    <p className="text-navy/70 text-sm mb-3">
                      {reg.isExternalStudent
                        ? "Browse and join an existing team for the hackathon."
                        : "Form or join a team for the hackathon finale."}
                    </p>
                    <Link
                      href="/dashboard/iepod/team"
                      className="bg-navy border-[2px] border-navy text-coral font-bold text-xs px-4 py-2 rounded-xl press-2 press-navy inline-block"
                    >
                      {reg.isExternalStudent ? "Join a Team" : "Find a Team"}
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Second row: quizzes + leaderboard */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* Quizzes & Challenges */}
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-display font-black text-base text-navy">Quizzes & Challenges</h4>
                  <Link
                    href="/dashboard/iepod/quizzes"
                    className="text-lavender font-bold text-xs hover:underline"
                  >
                    View all &rarr;
                  </Link>
                </div>
                {profile?.quizResults && profile.quizResults.length > 0 ? (
                  <div className="space-y-3">
                    {profile.quizResults.slice(0, 3).map((qr) => (
                      <div key={qr._id} className="flex items-center justify-between bg-ghost rounded-xl px-4 py-3">
                        <div>
                          <p className="font-bold text-sm text-navy">Quiz Result</p>
                          <p className="text-slate text-xs">{new Date(qr.submittedAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-display font-black text-lg text-navy">
                            {qr.score}/{qr.maxScore}
                          </span>
                          <p className="text-xs text-slate">{qr.percentage}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate text-sm mb-3">No quizzes taken yet</p>
                    <Link
                      href="/dashboard/iepod/quizzes"
                      className="bg-lime border-[2px] border-navy text-navy font-bold text-xs px-4 py-2 rounded-xl press-2 press-navy inline-block"
                    >
                      Take a Quiz
                    </Link>
                  </div>
                )}
              </div>

              {/* Leaderboard */}
              <div className="bg-navy border-[4px] border-lime rounded-3xl p-6 shadow-[6px_6px_0_0_#C8F31D]">
                <h4 className="font-display font-black text-base text-lime mb-4">Leaderboard</h4>
                {leaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboard.slice(0, 5).map((entry) => {
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
                            {entry.societyName && (
                              <p className="text-lime/40 text-[10px]">{entry.societyName}</p>
                            )}
                          </div>
                          <span className="font-display font-black text-sm text-lime">
                            {entry.totalPoints}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-lime/50 text-sm text-center py-6">No leaderboard data yet</p>
                )}
              </div>
            </div>

            {/* Points history */}
            {profile?.pointsHistory && profile.pointsHistory.length > 0 && (
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                <h4 className="font-display font-black text-base text-navy mb-4">Recent Points</h4>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {profile.pointsHistory.slice(0, 6).map((p) => (
                    <div key={p._id} className="flex items-center justify-between bg-ghost rounded-xl px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-navy truncate">{p.description}</p>
                        <p className="text-slate text-[10px]">
                          {new Date(p.awardedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="bg-lime border-[2px] border-navy text-navy font-display font-black text-xs px-2 py-1 rounded-lg shrink-0 ml-2">
                        +{p.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
