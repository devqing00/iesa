"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";

/* ─── Types ───────────────────────────────────────────────── */
interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  category: "academic" | "career" | "personal" | "skill";
  priority: "high" | "medium" | "low";
  deadline?: string;
  milestones: Milestone[];
  createdAt: string;
  completedAt?: string;
}

/* ─── Constants ───────────────────────────────────────────── */
const CATEGORIES = {
  academic: { label: "Academic", dot: "bg-lavender", badge: "bg-lavender-light text-lavender", ring: "border-lavender/40" },
  career: { label: "Career", dot: "bg-teal", badge: "bg-teal-light text-teal", ring: "border-teal/40" },
  personal: { label: "Personal", dot: "bg-coral", badge: "bg-coral-light text-coral", ring: "border-coral/40" },
  skill: { label: "Skill", dot: "bg-sunny", badge: "bg-sunny-light text-sunny", ring: "border-sunny/40" },
};

const PRIORITY_CONFIG = {
  high: { label: "High", color: "text-coral", bg: "bg-coral", badge: "bg-coral-light text-coral" },
  medium: { label: "Medium", color: "text-sunny", bg: "bg-sunny", badge: "bg-sunny-light text-navy" },
  low: { label: "Low", color: "text-teal", bg: "bg-teal", badge: "bg-teal-light text-teal" },
};

const MOTIVATIONAL_QUOTES = [
  "Dream big. Start small. Act now.",
  "Progress, not perfection.",
  "Every step counts toward your future.",
  "You're closer than you were yesterday.",
];

const STORAGE_KEY = "iesa-goals";

/* ─── Component ───────────────────────────────────────────── */
export default function GoalsPage() {
  const { showHelp, openHelp, closeHelp } = useToolHelp("goals");
  const [goals, setGoals] = useState<Goal[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [now, setNow] = useState(() => Date.now());
  const [quote] = useState(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  }, [goals]);

  const stats = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter((g) => g.completedAt).length;
    const active = total - completed;
    const highPriority = goals.filter((g) => g.priority === "high" && !g.completedAt).length;
    return {
      total, completed, active, highPriority,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [goals]);

  const filteredGoals = useMemo(() => {
    return goals
      .filter((g) => {
        if (filter === "active") return !g.completedAt;
        if (filter === "completed") return !!g.completedAt;
        return true;
      })
      .filter((g) => categoryFilter === "all" || g.category === categoryFilter)
      .sort((a, b) => {
        if (a.completedAt && !b.completedAt) return 1;
        if (!a.completedAt && b.completedAt) return -1;
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }, [goals, filter, categoryFilter]);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedGoals);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedGoals(next);
  };

  const toggleMilestone = (goalId: string, milestoneId: string) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const updatedMilestones = g.milestones.map((m) =>
          m.id === milestoneId ? { ...m, completed: !m.completed } : m
        );
        const allCompleted = updatedMilestones.length > 0 && updatedMilestones.every((m) => m.completed);
        return { ...g, milestones: updatedMilestones, completedAt: allCompleted ? new Date().toISOString() : undefined };
      })
    );
  };

  const deleteGoal = (id: string) => {
    setGoals((prev) => {
      const updated = prev.filter((g) => g.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const getProgress = (goal: Goal) => {
    if (goal.milestones.length === 0) return goal.completedAt ? 100 : 0;
    const completed = goal.milestones.filter((m) => m.completed).length;
    return Math.round((completed / goal.milestones.length) * 100);
  };

  const isDeadlineNear = (deadline?: string) => {
    if (!deadline) return false;
    const diff = new Date(deadline).getTime() - now;
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  };

  const isOverdue = (deadline?: string) => {
    if (!deadline) return false;
    return new Date(deadline).getTime() < now;
  };

  const saveGoal = (goalData: Partial<Goal>) => {
    if (editingGoal) {
      setGoals((prev) => prev.map((g) => (g.id === editingGoal.id ? { ...g, ...goalData } : g)));
    } else {
      const newGoal: Goal = {
        id: Date.now().toString(),
        title: goalData.title || "",
        description: goalData.description || "",
        category: goalData.category || "personal",
        priority: goalData.priority || "medium",
        deadline: goalData.deadline,
        milestones: goalData.milestones || [],
        createdAt: new Date().toISOString(),
      };
      setGoals((prev) => [...prev, newGoal]);
    }
    setShowAddModal(false);
    setEditingGoal(null);
  };

  /* ─── Goal card accent cycling ──────────────────────────── */
  const cardAccents = [
    { border: "border-l-teal", progressBar: "bg-teal" },
    { border: "border-l-coral", progressBar: "bg-coral" },
    { border: "border-l-lavender", progressBar: "bg-lavender" },
    { border: "border-l-sunny", progressBar: "bg-sunny" },
  ];

  return (
    <div className="min-h-screen bg-ghost overflow-x-hidden">
      <DashboardHeader title="Goal Tracker" />
      <ToolHelpModal toolId="goals" isOpen={showHelp} onClose={closeHelp} />

      {/* Diamond sparkle decorators */}
      <svg className="fixed top-24 left-[6%] w-5 h-5 text-lavender/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
      <svg className="fixed top-44 right-[8%] w-4 h-4 text-coral/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
      <svg className="fixed bottom-28 left-[12%] w-6 h-6 text-teal/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
      <svg className="fixed top-72 right-[22%] w-3 h-3 text-sunny/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8 relative z-10">
        <div className="max-w-6xl mx-auto">

          {/* Back Link + Help */}
          <div className="flex items-center justify-between mb-6">
            <Link href="/dashboard/growth" className="inline-flex items-center gap-2 font-display font-bold text-xs text-slate uppercase tracking-wider hover:text-navy transition-colors group">
              <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd"/></svg>
              Back to Growth Hub
            </Link>
            <HelpButton onClick={openHelp} />
          </div>

          {/* ═══════════════════════════════════════════════════
              BENTO HERO — lavender theme
              ═══════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
            {/* Title card */}
            <div className="md:col-span-7 bg-lavender border-[5px] border-navy rounded-[2rem] shadow-[8px_8px_0_0_#000] p-7 md:p-9 rotate-[-0.4deg] hover:rotate-0 transition-transform">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40 mb-3">Set &amp; Achieve</div>
              <h1 className="font-display font-black text-2xl md:text-3xl lg:text-4xl text-navy mb-3 leading-tight overflow-hidden">
                Your <span className="brush-highlight brush-coral">Goals</span>
              </h1>
              <p className="font-display font-normal text-sm md:text-base text-navy/60 max-w-md italic">&ldquo;{quote}&rdquo;</p>
            </div>

            {/* Stats mini-grid */}
            <div className="md:col-span-5 grid grid-cols-2 gap-3">
              <div className="bg-teal-light border-[4px] border-navy rounded-[1.5rem] shadow-[5px_5px_0_0_#000] p-4 flex flex-col justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40">Active</div>
                <div className="font-display font-black text-3xl text-navy">{stats.active}</div>
              </div>
              <div className="bg-coral-light border-[4px] border-navy rounded-[1.5rem] shadow-[5px_5px_0_0_#000] p-4 flex flex-col justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40">Done</div>
                <div className="font-display font-black text-3xl text-navy">{stats.completed}</div>
              </div>
              <div className="bg-sunny-light border-[4px] border-navy rounded-[1.5rem] shadow-[5px_5px_0_0_#000] p-4 flex flex-col justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40">Success</div>
                <div className="font-display font-black text-3xl text-navy">{stats.completionRate}%</div>
              </div>
              <div className="bg-navy border-[4px] border-navy rounded-[1.5rem] shadow-[5px_5px_0_0_#000] p-4 flex flex-col justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ghost/40">Urgent</div>
                <div className="font-display font-black text-3xl text-coral">{stats.highPriority}</div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              FILTERS & ADD
              ═══════════════════════════════════════════════════ */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              {/* Status filter tabs */}
              <div className="flex bg-snow border-[3px] border-navy rounded-2xl overflow-hidden shadow-[3px_3px_0_0_#000]">
                {(["all", "active", "completed"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2.5 font-display font-bold text-xs uppercase tracking-wider transition-all ${
                      filter === f
                        ? "bg-navy text-ghost"
                        : "text-navy/40 hover:text-navy hover:bg-ghost"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {/* Category filter */}
              <div className="flex items-center gap-2">
                {(["all", ...Object.keys(CATEGORIES)] as const).map((cat) => {
                  const isAll = cat === "all";
                  const catConfig = !isAll ? CATEGORIES[cat as keyof typeof CATEGORIES] : null;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all border-[2px] ${
                        categoryFilter === cat
                          ? "border-navy bg-snow shadow-[2px_2px_0_0_#000]"
                          : "border-transparent text-navy/40 hover:text-navy"
                      }`}
                    >
                      {catConfig && <div className={`w-2 h-2 rounded-full ${catConfig.dot}`}></div>}
                      {isAll ? "All" : catConfig?.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add Goal CTA */}
            <button
              onClick={() => { setEditingGoal(null); setShowAddModal(true); }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-lime text-navy border-[4px] border-navy shadow-[4px_4px_0_0_#0F0F2D] font-display font-bold text-xs uppercase tracking-wider hover:shadow-[6px_6px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd"/></svg>
              Add Goal
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════
              GOALS LIST
              ═══════════════════════════════════════════════════ */}
          <div className="space-y-4">
            {filteredGoals.length === 0 ? (
              <div className="bg-snow border-[4px] border-navy rounded-[2rem] shadow-[8px_8px_0_0_#000] p-12 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-lavender-light border-[3px] border-navy flex items-center justify-center">
                  <svg className="w-7 h-7 text-lavender" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd"/></svg>
                </div>
                <p className="font-display font-black text-xl text-navy mb-2">
                  {filter === "completed" ? "No completed goals yet" : "No goals to show"}
                </p>
                <p className="font-display font-normal text-sm text-navy/50 mb-5 max-w-xs mx-auto">
                  {filter === "completed" ? "Keep working toward your active goals!" : "Set your first goal to start your journey."}
                </p>
                {filter !== "completed" && (
                  <button
                    onClick={() => { setEditingGoal(null); setShowAddModal(true); }}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-lime text-navy border-[3px] border-navy shadow-[4px_4px_0_0_#0F0F2D] font-display font-bold text-xs uppercase tracking-wider"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd"/></svg>
                    Create Your First Goal
                  </button>
                )}
              </div>
            ) : (
              filteredGoals.map((goal, idx) => {
                const progress = getProgress(goal);
                const isExpanded = expandedGoals.has(goal.id);
                const categoryConfig = CATEGORIES[goal.category];
                const priorityConfig = PRIORITY_CONFIG[goal.priority];
                const deadlineNear = isDeadlineNear(goal.deadline);
                const overdue = isOverdue(goal.deadline) && !goal.completedAt;
                const accent = cardAccents[idx % cardAccents.length];

                return (
                  <div
                    key={goal.id}
                    className={`bg-snow border-[4px] border-navy border-l-[6px] ${accent.border} rounded-[1.5rem] shadow-[6px_6px_0_0_#000] transition-all ${
                      goal.completedAt ? "opacity-50" : ""
                    } ${overdue ? "border-coral" : ""}`}
                  >
                    <div className="p-5 md:p-6">
                      <div className="flex items-start gap-3">
                        {/* Expand toggle */}
                        <button
                          onClick={() => toggleExpand(goal.id)}
                          className="mt-1 text-slate hover:text-navy transition-colors"
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          <svg className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd"/></svg>
                        </button>

                        <div className="flex-1 min-w-0">
                          {/* Badges row */}
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-display font-bold text-[10px] uppercase tracking-wider ${categoryConfig.badge} border-[2px] ${categoryConfig.ring}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${categoryConfig.dot}`}></div>
                              {categoryConfig.label}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full font-display font-bold text-[10px] uppercase tracking-wider ${priorityConfig.badge} border-[2px] border-navy/10`}>
                              {priorityConfig.label}
                            </span>
                            {goal.completedAt && (
                              <span className="px-2.5 py-1 rounded-full font-display font-bold text-[10px] uppercase tracking-wider bg-teal-light text-teal border-[2px] border-teal/30">
                                Completed
                              </span>
                            )}
                            {overdue && (
                              <span className="px-2.5 py-1 rounded-full font-display font-bold text-[10px] uppercase tracking-wider bg-coral-light text-coral border-[2px] border-coral/30 animate-pulse">
                                Overdue
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h3 className={`font-display font-black text-lg leading-snug ${goal.completedAt ? "line-through text-slate" : "text-navy"}`}>
                            {goal.title}
                          </h3>
                          {goal.description && (
                            <p className="font-display font-normal text-sm text-navy/50 mt-1 line-clamp-2">{goal.description}</p>
                          )}

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-4 mt-3">
                            {goal.deadline && (
                              <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] ${overdue ? "text-coral" : deadlineNear ? "text-sunny" : "text-navy/40"}`}>
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd"/></svg>
                                {new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy/30">
                              {goal.milestones.length} milestones
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40 mb-1">
                              <span>Progress</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-2 bg-cloud border-[1px] border-navy/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${goal.completedAt ? "bg-teal" : accent.progressBar}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => { setEditingGoal(goal); setShowAddModal(true); }}
                            className="p-2 rounded-lg text-slate hover:text-navy hover:bg-ghost transition-all"
                            aria-label="Edit goal"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z"/><path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V14.25a.75.75 0 00-1.5 0v4.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h4.5a.75.75 0 000-1.5h-4.5z"/></svg>
                          </button>
                          <button
                            onClick={() => deleteGoal(goal.id)}
                            className="p-2 rounded-lg text-slate hover:text-coral hover:bg-coral-light transition-all"
                            aria-label="Delete goal"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd"/></svg>
                          </button>
                        </div>
                      </div>

                      {/* Expanded milestones */}
                      {isExpanded && goal.milestones.length > 0 && (
                        <div className="mt-5 pt-4 border-t-[3px] border-navy/10 space-y-2 ml-8">
                          {goal.milestones.map((milestone) => (
                            <div key={milestone.id} className="flex items-center gap-3 p-3 bg-ghost rounded-xl hover:bg-cloud transition-colors">
                              <button
                                onClick={() => toggleMilestone(goal.id, milestone.id)}
                                className={`transition-colors ${milestone.completed ? "text-teal" : "text-slate hover:text-navy"}`}
                                aria-label={milestone.completed ? "Mark incomplete" : "Mark complete"}
                              >
                                {milestone.completed ? (
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd"/></svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9"/></svg>
                                )}
                              </button>
                              <span className={`font-display font-normal text-sm ${milestone.completed ? "line-through text-slate" : "text-navy"}`}>
                                {milestone.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ═══════════════════════════════════════════════════
              ADD / EDIT MODAL
              ═══════════════════════════════════════════════════ */}
          {showAddModal && (
            <GoalModal
              goal={editingGoal}
              onSave={saveGoal}
              onClose={() => { setShowAddModal(false); setEditingGoal(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Goal Modal ──────────────────────────────────────────── */
function GoalModal({
  goal,
  onSave,
  onClose,
}: {
  goal: Goal | null;
  onSave: (data: Partial<Goal>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(goal?.title || "");
  const [description, setDescription] = useState(goal?.description || "");
  const [category, setCategory] = useState<Goal["category"]>(goal?.category || "personal");
  const [priority, setPriority] = useState<Goal["priority"]>(goal?.priority || "medium");
  const [deadline, setDeadline] = useState(goal?.deadline || "");
  const [milestones, setMilestones] = useState<Milestone[]>(goal?.milestones || []);
  const [newMilestone, setNewMilestone] = useState("");

  const addMilestone = () => {
    if (newMilestone.trim()) {
      setMilestones([...milestones, { id: Date.now().toString(), title: newMilestone.trim(), completed: false }]);
      setNewMilestone("");
    }
  };

  const removeMilestone = (id: string) => setMilestones(milestones.filter((m) => m.id !== id));

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSave({ title, description, category, priority, deadline: deadline || undefined, milestones });
  };

  return (
    <div className="fixed inset-0 bg-navy/80 backdrop-blur-sm flex items-center justify-center z-50 px-4 pt-4 pb-20 md:p-6">
      <div className="bg-ghost border-[4px] border-navy rounded-[2rem] shadow-[10px_10px_0_0_#000] w-full max-w-lg max-h-[80vh] md:max-h-[85vh] overflow-y-auto">
        {/* Modal header */}
        <div className="p-6 border-b-[3px] border-navy/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40 mb-1">{goal ? "Edit" : "New"} Goal</div>
            <h2 className="font-display font-black text-xl text-navy">{goal ? "Edit Goal" : "Create Goal"}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-cloud flex items-center justify-center text-slate hover:text-navy transition-colors" aria-label="Close">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
          </button>
        </div>

        {/* Modal body */}
        <div className="p-6 space-y-5">
          <div>
            <label htmlFor="goal-title" className="block text-[10px] font-bold uppercase tracking-[0.1em] text-navy/50 mb-2">Title</label>
            <input id="goal-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What do you want to achieve?" className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-xl text-navy font-display font-normal focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"/>
          </div>

          <div>
            <label htmlFor="goal-desc" className="block text-[10px] font-bold uppercase tracking-[0.1em] text-navy/50 mb-2">Description</label>
            <textarea id="goal-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add more details..." rows={3} className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-xl text-navy font-display font-normal focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all resize-none"/>
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-navy/50 mb-2">Category</label>
              <div className="space-y-1.5">
                {(Object.entries(CATEGORIES) as [Goal["category"], typeof CATEGORIES.academic][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left font-display font-bold text-xs transition-all border-[2px] ${
                      category === key
                        ? `${val.badge} border-navy shadow-[2px_2px_0_0_#000]`
                        : "border-navy/10 text-navy/50 hover:border-navy/30"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${val.dot}`}></div>
                    {val.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-navy/50 mb-2">Priority</label>
              <div className="space-y-1.5">
                {(Object.entries(PRIORITY_CONFIG) as [Goal["priority"], typeof PRIORITY_CONFIG.high][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setPriority(key)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left font-display font-bold text-xs transition-all border-[2px] ${
                      priority === key
                        ? `${val.badge} border-navy shadow-[2px_2px_0_0_#000]`
                        : "border-navy/10 text-navy/50 hover:border-navy/30"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${val.bg}`}></div>
                    {val.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="goal-deadline" className="block text-[10px] font-bold uppercase tracking-[0.1em] text-navy/50 mb-2">Deadline (optional)</label>
            <input id="goal-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-xl text-navy font-display font-normal focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"/>
          </div>

          {/* Milestones */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-navy/50 mb-2">Milestones</label>
            {milestones.length > 0 && (
              <div className="space-y-2 mb-3">
                {milestones.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-cloud border-[2px] border-navy/10 rounded-xl">
                    <span className="font-display font-normal text-sm text-navy">{m.title}</span>
                    <button onClick={() => removeMilestone(m.id)} className="text-slate hover:text-coral transition-colors" aria-label="Remove">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addMilestone()}
                placeholder="Add a milestone..."
                className="flex-1 px-4 py-2.5 bg-snow border-[3px] border-navy rounded-xl text-navy font-display font-normal text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
              />
              <button onClick={addMilestone} className="px-4 py-2.5 rounded-xl bg-teal-light text-teal hover:bg-teal hover:text-snow border-[2px] border-navy/20 font-display font-bold text-xs uppercase tracking-wider transition-all">
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div className="p-6 border-t-[3px] border-navy/10 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border-[3px] border-navy text-navy/50 font-display font-bold text-xs uppercase tracking-wider hover:bg-cloud transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!title.trim()} className="flex-1 px-4 py-3 rounded-2xl bg-lime text-navy border-[3px] border-navy shadow-[3px_3px_0_0_#0F0F2D] font-display font-bold text-xs uppercase tracking-wider hover:shadow-[5px_5px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-40">
            {goal ? "Save Changes" : "Create Goal"}
          </button>
        </div>
      </div>
    </div>
  );
}
