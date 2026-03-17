"use client";

import { useCallback, useEffect, useState } from "react";
import { withAuth } from "@/lib/withAuth";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Tab = "overview" | "deadlines" | "polls" | "updates";

interface CohortOverview {
  level: string;
  totalCohortCount: number;
  eligibleMemberCount: number;
  activeDeadlines: number;
  activePolls: number;
  updates: number;
}

interface Deadline {
  id: string;
  title: string;
  course: string;
  description: string;
  dueDate: string | null;
  createdByName: string;
  createdAt: string;
}

interface PollOption {
  text: string;
  voteCount: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  eligibleMembers: number;
  memberVotes: number;
  turnoutPercentage: number;
  userVote: number | null;
  isActive: boolean;
  createdByName: string;
  createdAt: string;
}

interface UpdatePost {
  id: string;
  title: string;
  content: string;
  course: string;
  lecturerName: string;
  attachmentUrl?: string;
  isPinned: boolean;
  createdByName: string;
  createdAt: string;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return "";
  const now = Date.now();
  const then = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function CohortPortalPage() {
  const { getAccessToken } = useAuth();
  const { hasPermission } = usePermissions();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<CohortOverview | null>(null);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [updates, setUpdates] = useState<UpdatePost[]>([]);
  const isClassRepOrAssistant = hasPermission("class_rep:view_cohort") && !hasPermission("freshers:manage");

  useEffect(() => {
    if (!isClassRepOrAssistant) return;
    router.replace("/dashboard");
  }, [isClassRepOrAssistant, router]);

  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/class-rep/member${path}`), {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options?.headers || {}),
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `API error ${res.status}`);
      }
      return res.json();
    },
    [getAccessToken],
  );

  const loadOverview = useCallback(async () => {
    const data = await apiFetch("/overview");
    setOverview(data);
    setLevel(data.level || "");
  }, [apiFetch]);

  const loadDeadlines = useCallback(async () => {
    const data = await apiFetch("/deadlines");
    setDeadlines(data.deadlines || []);
    setLevel(data.level || "");
  }, [apiFetch]);

  const loadPolls = useCallback(async () => {
    const data = await apiFetch("/polls");
    setPolls(data.polls || []);
    setLevel(data.level || "");
  }, [apiFetch]);

  const loadUpdates = useCallback(async () => {
    const data = await apiFetch("/updates");
    setUpdates(data.updates || []);
    setLevel(data.level || "");
  }, [apiFetch]);

  useEffect(() => {
    if (isClassRepOrAssistant) return;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadOverview(), loadDeadlines(), loadPolls(), loadUpdates()]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load cohort portal");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [isClassRepOrAssistant, loadOverview, loadDeadlines, loadPolls, loadUpdates]);

  useEffect(() => {
    if (isClassRepOrAssistant || loading || tab !== "polls") return;
    const interval = window.setInterval(() => {
      loadPolls().catch(() => {});
    }, 20000);
    return () => window.clearInterval(interval);
  }, [isClassRepOrAssistant, loading, tab, loadPolls]);

  const votePoll = useCallback(async (pollId: string, optionIndex: number) => {
    if (isClassRepOrAssistant) return;
    try {
      await apiFetch(`/polls/${pollId}/vote`, {
        method: "POST",
        body: JSON.stringify({ optionIndex }),
      });
      await loadPolls();
      toast.success("Vote recorded");
    } catch {
      toast.error("Failed to cast vote");
    }
  }, [apiFetch, isClassRepOrAssistant, loadPolls]);

  if (isClassRepOrAssistant) {
    return null;
  }

  if (loading) {
    return (
      <main id="main-content" className="min-h-screen bg-ghost p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-snow border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000]">
            <p className="font-bold text-navy">Loading cohort portal...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main id="main-content" className="min-h-screen bg-ghost p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-coral-light border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000]">
            <h2 className="font-display font-black text-display-sm text-navy">Unable to load Cohort Portal</h2>
            <p className="text-slate mt-2">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-ghost p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="bg-snow border-4 border-navy rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0_0_#000]">
          <p className="text-label text-slate">COHORT PORTAL</p>
          <h1 className="font-display font-black text-display-lg text-navy mt-2">{level || "Your Cohort"}</h1>
          <p className="text-slate mt-2">Track deadlines, vote in class polls, and stay updated.</p>
        </section>

        <section className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {[
            { key: "overview", label: "Overview" },
            { key: "deadlines", label: "Deadlines" },
            { key: "polls", label: "Polls" },
            { key: "updates", label: "Updates" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as Tab)}
              className={`px-4 py-2.5 rounded-2xl border-[3px] text-sm font-bold whitespace-nowrap transition-all ${
                tab === item.key
                  ? "bg-lime border-navy text-navy shadow-[3px_3px_0_0_#000]"
                  : "bg-snow border-transparent text-slate hover:border-navy hover:text-navy"
              }`}
            >
              {item.label}
            </button>
          ))}
        </section>

        {tab === "overview" && overview && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-teal border-4 border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000]">
              <p className="text-label-sm text-navy-muted">COHORT SIZE</p>
              <p className="font-display font-black text-display-md text-navy">{overview.totalCohortCount}</p>
            </div>
            <div className="bg-lavender border-4 border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000]">
              <p className="text-label-sm text-navy-muted">MEMBERS (EXCL. REP/ASST)</p>
              <p className="font-display font-black text-display-md text-navy">{overview.eligibleMemberCount}</p>
            </div>
            <div className="bg-sunny border-4 border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000]">
              <p className="text-label-sm text-navy-muted">ACTIVE DEADLINES</p>
              <p className="font-display font-black text-display-md text-navy">{overview.activeDeadlines}</p>
            </div>
            <div className="bg-coral-light border-4 border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000]">
              <p className="text-label-sm text-navy-muted">OPEN POLLS</p>
              <p className="font-display font-black text-display-md text-navy">{overview.activePolls}</p>
            </div>
          </section>
        )}

        {tab === "deadlines" && (
          <section className="space-y-3">
            {deadlines.length === 0 ? (
              <div className="bg-snow border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] text-center">
                <p className="text-slate">No deadlines yet.</p>
              </div>
            ) : deadlines.map((deadline) => (
              <article key={deadline.id} className="bg-snow border-4 border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-black text-display-sm text-navy">{deadline.title}</h3>
                    {deadline.course && <p className="text-xs font-bold text-teal mt-1">{deadline.course}</p>}
                    {deadline.description && <p className="text-slate mt-2">{deadline.description}</p>}
                    <p className="text-xs text-slate mt-2">Posted by {deadline.createdByName} · {timeAgo(deadline.createdAt)}</p>
                  </div>
                  {deadline.dueDate && (
                    <span className="shrink-0 text-xs font-bold bg-coral-light text-coral px-3 py-1.5 rounded-xl border-2 border-navy">
                      Due: {formatDate(deadline.dueDate)}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}

        {tab === "polls" && (
          <section className="space-y-3">
            {polls.length === 0 ? (
              <div className="bg-snow border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] text-center">
                <p className="text-slate">No polls yet.</p>
              </div>
            ) : polls.map((poll) => (
              <article key={poll.id} className={`border-4 border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000] ${poll.isActive ? "bg-snow" : "bg-ghost"}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display font-black text-display-sm text-navy">{poll.question}</h3>
                  {!poll.isActive && <span className="text-xs font-bold bg-coral-light text-coral px-2 py-1 rounded-lg">Closed</span>}
                </div>

                <div className="mt-3 space-y-2">
                  {poll.options.map((option, index) => {
                    const percentage = poll.totalVotes > 0 ? Math.round((option.voteCount / poll.totalVotes) * 100) : 0;
                    const isSelected = poll.userVote === index;

                    return (
                      <button
                        key={`${poll.id}-${index}`}
                        type="button"
                        onClick={() => poll.isActive && votePoll(poll.id, index)}
                        disabled={!poll.isActive}
                        className={`w-full relative overflow-hidden rounded-2xl border-[3px] px-4 py-2.5 text-left text-sm font-bold transition-all ${
                          isSelected
                            ? "border-lime bg-lime-light text-navy"
                            : "border-navy/20 bg-snow text-navy hover:border-navy"
                        } ${poll.isActive ? "cursor-pointer" : "cursor-default"}`}
                      >
                        <span className="relative flex items-center justify-between gap-3">
                          <span>{option.text}</span>
                          <span className="text-slate">{percentage}% ({option.voteCount})</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-slate mt-2">
                  {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""} · Turnout {poll.memberVotes}/{poll.eligibleMembers} ({poll.turnoutPercentage}%) · By {poll.createdByName} · {timeAgo(poll.createdAt)}
                </p>
              </article>
            ))}
          </section>
        )}

        {tab === "updates" && (
          <section className="space-y-3">
            {updates.length === 0 ? (
              <div className="bg-snow border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] text-center">
                <p className="text-slate">No class updates yet.</p>
              </div>
            ) : updates.map((update) => (
              <article key={update.id} className={`border-4 border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000] ${update.isPinned ? "bg-sunny-light" : "bg-snow"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {update.isPinned && (
                    <span className="text-[10px] font-bold bg-sunny text-navy px-2 py-0.5 rounded-lg">PINNED</span>
                  )}
                  <h3 className="font-display font-black text-display-sm text-navy">{update.title}</h3>
                </div>
                {(update.course || update.lecturerName) && (
                  <p className="text-xs font-bold text-teal mb-1">{[update.course, update.lecturerName].filter(Boolean).join(" · ")}</p>
                )}
                <p className="text-navy whitespace-pre-wrap">{update.content}</p>
                {update.attachmentUrl && (
                  <a
                    href={update.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex mt-3 bg-lime border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-bold text-navy press-2 press-navy"
                  >
                    View attachment
                  </a>
                )}
                <p className="text-xs text-slate mt-2">By {update.createdByName} · {timeAgo(update.createdAt)}</p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

export default withAuth(CohortPortalPage);
