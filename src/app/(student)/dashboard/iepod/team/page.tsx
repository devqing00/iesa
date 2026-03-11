"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { toast } from "sonner";
import {
  listTeams,
  getTeam,
  createTeam,
  joinTeam,
  leaveTeam,
  createSubmission,
  listTeamSubmissions,
  submitIteration,
  getMyIepodProfile,
  TEAM_STATUS_STYLES,
  SUBMISSION_STATUS_STYLES,
} from "@/lib/api";
import type {
  IepodTeam,
  IepodSubmission,
  MyIepodProfile,
  IepodTeamStatus,
  IepodSubmissionStatus,
} from "@/lib/api";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

type Tab = "browse" | "my-team" | "submissions";

export default function TeamPage() {
  const { user } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("iepod-team");
  const [tab, setTab] = useState<Tab>("browse");
  const [profile, setProfile] = useState<MyIepodProfile | null>(null);
  const [teams, setTeams] = useState<IepodTeam[]>([]);
  const [myTeam, setMyTeam] = useState<IepodTeam | null>(null);
  const [submissions, setSubmissions] = useState<IepodSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create team form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [maxMembers, setMaxMembers] = useState(5);
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Submission form
  const [showSubForm, setShowSubForm] = useState(false);
  const [subTitle, setSubTitle] = useState("");
  const [subDescription, setSubDescription] = useState("");
  const [subProcessLog, setSubProcessLog] = useState("");
  const [submittingSub, setSubmittingSub] = useState(false);

  const [joiningTeamId, setJoiningTeamId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, teamsRes] = await Promise.allSettled([
        getMyIepodProfile(),
        listTeams({ status: statusFilter || undefined, search: debouncedSearch || undefined }),
      ]);

      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value);
        if (profileRes.value.team) {
          setMyTeam(profileRes.value.team);
          setTab("my-team");
          // Fetch submissions for the team
          try {
            const subs = await listTeamSubmissions(profileRes.value.team._id);
            setSubmissions(subs);
          } catch { /* no submissions yet */ }
        }
      }
      if (teamsRes.status === "fulfilled") {
        setTeams(teamsRes.value.teams);
      }
    } catch {
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  // Debounce search input (400ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim() || !problemStatement.trim()) {
      toast.error("Team name and problem statement are required.");
      return;
    }
    setCreatingTeam(true);
    try {
      const team = await createTeam({ name: teamName, problemStatement, maxMembers });
      setMyTeam(team);
      setShowCreateForm(false);
      setTeamName("");
      setProblemStatement("");
      setMaxMembers(5);
      toast.success("Team created! +15 points");
      setTab("my-team");
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreatingTeam(false);
    }
  }

  async function handleJoinTeam(teamId: string) {
    setJoiningTeamId(teamId);
    try {
      const res = await joinTeam(teamId);
      toast.success(res.message);
      const team = await getTeam(teamId);
      setMyTeam(team);
      setTab("my-team");
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to join team");
    } finally {
      setJoiningTeamId(null);
    }
  }

  async function handleLeaveTeam() {
    if (!myTeam) return;
    const confirmed = window.confirm("Are you sure you want to leave this team? This action cannot be undone.");
    if (!confirmed) return;
    try {
      const res = await leaveTeam(myTeam._id);
      toast.success(res.message);
      setMyTeam(null);
      setTab("browse");
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to leave team");
    }
  }

  async function handleCreateSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!myTeam || !subTitle.trim() || !subDescription.trim() || !subProcessLog.trim()) {
      toast.error("All fields are required.");
      return;
    }
    setSubmittingSub(true);
    try {
      const sub = await createSubmission(myTeam._id, {
        title: subTitle,
        description: subDescription,
        processLog: subProcessLog,
        iterationNumber: submissions.length + 1,
      });
      setSubmissions([sub, ...submissions]);
      setShowSubForm(false);
      setSubTitle("");
      setSubDescription("");
      setSubProcessLog("");
      toast.success("Submission draft created!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create submission");
    } finally {
      setSubmittingSub(false);
    }
  }

  async function handleSubmitIteration(subId: string) {
    try {
      const res = await submitIteration(subId);
      toast.success(res.message);
      // Refresh submissions
      if (myTeam) {
        const subs = await listTeamSubmissions(myTeam._id);
        setSubmissions(subs);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    }
  }

  const hasTeam = !!myTeam;
  const isLeader = myTeam?.leaderId === user?.id;
  const isExternal = profile?.registration?.isExternalStudent || false;

  if (loading) {
    return (
      <div className="min-h-screen">
        <DashboardHeader title="Teams & Hackathon" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-snow border-[3px] border-cloud rounded-2xl p-6 animate-pulse">
                <div className="h-4 bg-cloud rounded w-1/3 mb-4" />
                <div className="h-6 bg-cloud rounded w-2/3 mb-2" />
                <div className="h-4 bg-cloud rounded w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <DashboardHeader title="Teams & Hackathon" />
      <ToolHelpModal toolId="iepod-team" isOpen={showHelp} onClose={closeHelp} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/dashboard/iepod" className="text-lavender font-bold text-sm hover:underline inline-block">
            &larr; Back to IEPOD
          </Link>
          <HelpButton onClick={openHelp} />
        </div>

        {/* Tab nav */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(["browse", "my-team", "submissions"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              disabled={!hasTeam && t !== "browse"}
              className={`px-4 py-2 rounded-xl border-[3px] font-display font-black text-xs whitespace-nowrap transition-all ${
                tab === t
                  ? "bg-navy border-lime text-lime"
                  : !hasTeam && t !== "browse"
                  ? "bg-cloud border-cloud text-slate cursor-not-allowed"
                  : "bg-snow border-navy text-navy hover:bg-ghost"
              }`}
            >
              {t === "browse" ? "Browse Teams" : t === "my-team" ? "My Team" : "Submissions"}
            </button>
          ))}
        </div>

        {/* ── Browse tab ─────────────────────────────────────── */}
        {tab === "browse" && (
          <div className="space-y-5">
            {/* Search + filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search teams..."
                className="flex-1 border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime"
              >
                <option value="">All Status</option>
                {(Object.keys(TEAM_STATUS_STYLES) as IepodTeamStatus[]).map((s) => (
                  <option key={s} value={s}>{TEAM_STATUS_STYLES[s].label}</option>
                ))}
              </select>
              {!hasTeam && !isExternal && (
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="bg-lime border-[3px] border-navy press-4 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all whitespace-nowrap"
                >
                  {showCreateForm ? "Cancel" : "Create Team"}
                </button>
              )}
            </div>

            {/* Create team form */}
            {showCreateForm && (
              <form onSubmit={handleCreateTeam} className="bg-lime-light border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
                <h3 className="font-display font-black text-lg text-navy">Create a New Team</h3>
                <div>
                  <label className="text-label text-navy text-xs mb-1 block">Team Name</label>
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    maxLength={100}
                    placeholder="e.g., Circuit Breakers"
                    className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime"
                  />
                </div>
                <div>
                  <label className="text-label text-navy text-xs mb-1 block">Problem Statement</label>
                  <textarea
                    value={problemStatement}
                    onChange={(e) => setProblemStatement(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="What problem will your team address?"
                    className="w-full border-[3px] border-navy rounded-xl px-4 py-3 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none"
                  />
                </div>
                <div>
                  <label className="text-label text-navy text-xs mb-1 block">Max Members (2-8)</label>
                  <input
                    type="number"
                    min={2}
                    max={8}
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(Number(e.target.value))}
                    className="w-32 border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingTeam}
                  className="bg-lime border-[4px] border-navy press-5 press-navy px-6 py-3 rounded-xl font-display font-black text-sm text-navy transition-all disabled:opacity-50"
                >
                  {creatingTeam ? "Creating..." : "Create Team"}
                </button>
              </form>
            )}

            {/* Teams grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {teams.map((t) => {
                const style = TEAM_STATUS_STYLES[t.status];
                const isFull = t.members.length >= t.maxMembers;
                return (
                  <div key={t._id} className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-display font-black text-base text-navy">{t.name}</h4>
                      <span className={`${style.bg} ${style.text} font-bold text-[10px] px-2 py-0.5 rounded-lg`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-slate text-sm mb-3 line-clamp-2">{t.problemStatement}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate text-xs font-medium">
                          {t.members.length}/{t.maxMembers} members
                        </span>
                        {t.mentorName && (
                          <span className="bg-lavender-light text-lavender font-bold text-[10px] px-2 py-0.5 rounded-lg">
                            Mentored
                          </span>
                        )}
                      </div>
                      {!hasTeam && t.status === "forming" && !isFull && (
                        <button
                          onClick={() => handleJoinTeam(t._id)}
                          disabled={joiningTeamId !== null}
                          className="bg-teal border-[2px] border-navy text-navy font-bold text-xs px-4 py-1.5 rounded-xl press-2 press-navy disabled:opacity-50"
                        >
                          {joiningTeamId === t._id ? "Joining..." : "Join"}
                        </button>
                      )}
                      {isFull && !hasTeam && (
                        <span className="text-slate text-xs">Full</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {teams.length === 0 && (
                <div className="md:col-span-2 text-center py-12 bg-ghost rounded-3xl border-[3px] border-cloud">
                  <p className="text-slate font-medium">No teams found. Be the first to create one!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── My Team tab ────────────────────────────────────── */}
        {tab === "my-team" && myTeam && (
          <div className="space-y-5">
            <div className="bg-coral border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] rotate-[-0.5deg]">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display font-black text-xl text-navy">{myTeam.name}</h3>
                  <span className={`${TEAM_STATUS_STYLES[myTeam.status].bg} ${TEAM_STATUS_STYLES[myTeam.status].text} font-bold text-xs px-2 py-0.5 rounded-lg inline-block mt-1`}>
                    {TEAM_STATUS_STYLES[myTeam.status].label}
                  </span>
                </div>
                {!isLeader && (
                  <button
                    onClick={handleLeaveTeam}
                    className="bg-snow border-[2px] border-coral text-coral font-bold text-xs px-3 py-1 rounded-xl press-2 press-black hover:bg-coral-light transition-colors"
                  >
                    Leave Team
                  </button>
                )}
              </div>
              <p className="text-navy-muted text-sm">{myTeam.problemStatement}</p>
            </div>

            {/* Members */}
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
              <h4 className="font-display font-black text-base text-navy mb-4">
                Members ({myTeam.members.length}/{myTeam.maxMembers})
              </h4>
              <div className="space-y-2">
                {myTeam.members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between bg-ghost rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-xs ${
                        m.role === "leader" ? "bg-lime text-navy" : "bg-lavender-light text-navy"
                      }`}>
                        {m.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-navy">{m.userName}</p>
                        <p className="text-slate text-[10px] capitalize">{m.role}</p>
                      </div>
                    </div>
                    {m.userId === user?.id && (
                      <span className="text-lavender font-bold text-[10px]">You</span>
                    )}
                  </div>
                ))}
              </div>

              {myTeam.mentorName && (
                <div className="mt-4 bg-lavender-light border-[2px] border-lavender/30 rounded-xl px-4 py-3">
                  <p className="text-label text-lavender text-xs mb-1">Assigned Mentor</p>
                  <p className="font-bold text-sm text-navy">{myTeam.mentorName}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Submissions tab ────────────────────────────────── */}
        {tab === "submissions" && myTeam && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black text-lg text-navy">Submissions</h3>
              {!isExternal && (
                <button
                  onClick={() => setShowSubForm(!showSubForm)}
                  className="bg-lime border-[3px] border-navy press-4 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all"
                >
                  {showSubForm ? "Cancel" : "New Submission"}
                </button>
              )}
            </div>

            {/* New submission form */}
            {showSubForm && (
              <form onSubmit={handleCreateSubmission} className="bg-teal-light border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
                <h4 className="font-display font-black text-base text-navy">New Iteration</h4>
                <div>
                  <label className="text-label text-navy text-xs mb-1 block">Title</label>
                  <input
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                    maxLength={200}
                    placeholder="e.g., Iteration 1: Research & Feasibility"
                    className="w-full border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime"
                  />
                </div>
                <div>
                  <label className="text-label text-navy text-xs mb-1 block">Description</label>
                  <textarea
                    value={subDescription}
                    onChange={(e) => setSubDescription(e.target.value)}
                    rows={3}
                    maxLength={3000}
                    placeholder="Describe what this iteration covers..."
                    className="w-full border-[3px] border-navy rounded-xl px-4 py-3 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none"
                  />
                </div>
                <div>
                  <label className="text-label text-navy text-xs mb-1 block">Process Log</label>
                  <textarea
                    value={subProcessLog}
                    onChange={(e) => setSubProcessLog(e.target.value)}
                    rows={4}
                    maxLength={5000}
                    placeholder="Document your team's process: decisions made, experiments tried, pivots, lessons learned..."
                    className="w-full border-[3px] border-navy rounded-xl px-4 py-3 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingSub}
                  className="bg-lime border-[4px] border-navy press-5 press-navy px-6 py-3 rounded-xl font-display font-black text-sm text-navy transition-all disabled:opacity-50"
                >
                  {submittingSub ? "Saving..." : "Save Draft"}
                </button>
              </form>
            )}

            {/* Submission list */}
            <div className="space-y-4">
              {submissions.map((sub) => {
                const style = SUBMISSION_STATUS_STYLES[sub.status];
                return (
                  <div key={sub._id} className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-display font-black text-base text-navy">{sub.title}</h4>
                        <p className="text-slate text-xs mt-1">
                          Iteration #{sub.iterationNumber} &bull; {new Date(sub.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`${style.bg} ${style.text} font-bold text-[10px] px-2 py-0.5 rounded-lg`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-slate text-sm mb-3 line-clamp-2">{sub.description}</p>

                    <details className="mb-3">
                      <summary className="text-lavender font-bold text-xs cursor-pointer hover:underline">
                        View Process Log
                      </summary>
                      <p className="text-slate text-sm mt-2 whitespace-pre-wrap">{sub.processLog}</p>
                    </details>

                    {sub.feedback && (
                      <div className="bg-teal-light rounded-xl px-4 py-3 mb-3">
                        <p className="text-label text-teal text-xs mb-1">Reviewer Feedback</p>
                        <p className="text-navy-muted text-sm">{sub.feedback}</p>
                        {sub.score !== null && sub.score !== undefined && (
                          <p className="text-teal font-display font-black text-sm mt-1">
                            Score: {sub.score}/100
                          </p>
                        )}
                      </div>
                    )}

                    {sub.status === "draft" && (
                      <button
                        onClick={() => handleSubmitIteration(sub._id)}
                        className="bg-navy border-[2px] border-lime text-lime font-bold text-xs px-4 py-2 rounded-xl press-2 press-lime"
                      >
                        Submit for Review
                      </button>
                    )}
                  </div>
                );
              })}
              {submissions.length === 0 && (
                <div className="text-center py-12 bg-ghost rounded-3xl border-[3px] border-cloud">
                  <p className="text-slate font-medium mb-2">No submissions yet</p>
                  <p className="text-slate text-sm">Create your first iteration to document your process.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No team message for non-browse tabs */}
        {!hasTeam && tab !== "browse" && (
          <div className="text-center py-12 bg-ghost rounded-3xl border-[3px] border-cloud">
            <p className="text-slate font-medium">Join or create a team first to access this section.</p>
            <button
              onClick={() => setTab("browse")}
              className="mt-3 text-lavender font-bold text-sm hover:underline"
            >
              Browse Teams &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
