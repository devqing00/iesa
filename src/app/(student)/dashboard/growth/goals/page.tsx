"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";

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

const CATEGORIES = {
  academic: {
    label: "Academic",
    color: "text-blue-600",
    bgColor: "bg-blue-600",
  },
  career: {
    label: "Career",
    color: "text-emerald-600",
    bgColor: "bg-emerald-600",
  },
  personal: {
    label: "Personal",
    color: "text-purple-600",
    bgColor: "bg-purple-600",
  },
  skill: { label: "Skill", color: "text-amber-600", bgColor: "bg-amber-600" },
};

const PRIORITY_CONFIG = {
  high: { label: "High", color: "text-red-600" },
  medium: { label: "Medium", color: "text-amber-600" },
  low: { label: "Low", color: "text-green-600" },
};

const MOTIVATIONAL_QUOTES = [
  "Dream big. Start small. Act now.",
  "Progress, not perfection.",
  "Every step counts toward your future.",
  "You're closer than you were yesterday.",
];

const STORAGE_KEY = "iesa-goals";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "active" | "completed">(
    "active"
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [now, setNow] = useState(() => Date.now());
  const [quote] = useState(
    () =>
      MOTIVATIONAL_QUOTES[
        Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)
      ]
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setGoals(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (goals.length > 0)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  }, [goals]);

  const stats = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter((g) => g.completedAt).length;
    const active = total - completed;
    const highPriority = goals.filter(
      (g) => g.priority === "high" && !g.completedAt
    ).length;
    return {
      total,
      completed,
      active,
      highPriority,
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
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedGoals(newExpanded);
  };

  const toggleMilestone = (goalId: string, milestoneId: string) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const updatedMilestones = g.milestones.map((m) =>
          m.id === milestoneId ? { ...m, completed: !m.completed } : m
        );
        const allCompleted =
          updatedMilestones.length > 0 &&
          updatedMilestones.every((m) => m.completed);
        return {
          ...g,
          milestones: updatedMilestones,
          completedAt: allCompleted ? new Date().toISOString() : undefined,
        };
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
      setGoals((prev) =>
        prev.map((g) => (g.id === editingGoal.id ? { ...g, ...goalData } : g))
      );
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

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Goal Tracker" />

      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8 max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/dashboard/growth"
          className="inline-flex items-center gap-2 text-label-sm text-text-muted hover:text-text-primary transition-colors mb-6 group"
        >
          <svg
            className="w-4 h-4 group-hover:-translate-x-1 transition-transform"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to Growth Hub
        </Link>

        {/* Page Header */}
        <div className="mb-8 pb-8 border-b border-border">
          <span className="text-label-sm text-text-muted flex items-center gap-2 mb-2">
            <span>✦</span> Set & Achieve
          </span>
          <h1 className="font-display text-display-sm mb-2">Your Goals</h1>
          <p className="text-text-secondary text-body text-sm">{quote}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="page-frame p-4">
            <span className="text-label-sm text-text-muted">Active</span>
            <p className="font-display text-2xl">{stats.active}</p>
          </div>
          <div className="page-frame p-4">
            <span className="text-label-sm text-text-muted">Completed</span>
            <p className="font-display text-2xl">{stats.completed}</p>
          </div>
          <div className="page-frame p-4">
            <span className="text-label-sm text-text-muted">Success Rate</span>
            <p className="font-display text-2xl">{stats.completionRate}%</p>
          </div>
          <div className="page-frame p-4">
            <span className="text-label-sm text-text-muted">High Priority</span>
            <p className="font-display text-2xl">{stats.highPriority}</p>
          </div>
        </div>

        {/* Filters & Add Button */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex border border-border">
              {(["all", "active", "completed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 text-label-sm transition-all ${
                    filter === f
                      ? "bg-charcoal dark:bg-cream text-cream dark:text-charcoal"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-label-sm bg-bg-card border border-border text-text-primary focus:outline-none"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORIES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setEditingGoal(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-charcoal dark:bg-cream text-cream dark:text-charcoal text-label hover:opacity-90 transition-opacity"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Add Goal
          </button>
        </div>

        {/* Goals List */}
        <div className="space-y-4">
          {filteredGoals.length === 0 ? (
            <div className="page-frame p-12 text-center">
              <p className="font-display text-lg mb-2">
                {filter === "completed"
                  ? "No completed goals yet"
                  : "No goals to show"}
              </p>
              <p className="text-text-muted text-label-sm mb-4">
                {filter === "completed"
                  ? "Keep working toward your active goals!"
                  : "Set your first goal to start your journey."}
              </p>
              {filter !== "completed" && (
                <button
                  onClick={() => {
                    setEditingGoal(null);
                    setShowAddModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-charcoal dark:bg-cream text-cream dark:text-charcoal text-label-sm"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  Create Your First Goal
                </button>
              )}
            </div>
          ) : (
            filteredGoals.map((goal) => {
              const progress = getProgress(goal);
              const isExpanded = expandedGoals.has(goal.id);
              const categoryConfig = CATEGORIES[goal.category];
              const priorityConfig = PRIORITY_CONFIG[goal.priority];
              const deadlineNear = isDeadlineNear(goal.deadline);
              const overdue = isOverdue(goal.deadline) && !goal.completedAt;

              return (
                <div
                  key={goal.id}
                  className={`page-frame transition-all ${
                    goal.completedAt ? "opacity-60" : ""
                  } ${overdue ? "border-red-600" : ""}`}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleExpand(goal.id)}
                        className="mt-1 text-text-muted hover:text-text-primary"
                      >
                        <svg
                          className={`w-5 h-5 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 text-label-sm ${categoryConfig.color} bg-bg-secondary`}
                          >
                            {categoryConfig.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-label-sm ${priorityConfig.color} bg-bg-secondary`}
                          >
                            {priorityConfig.label}
                          </span>
                          {goal.completedAt && (
                            <span className="px-2 py-0.5 text-label-sm text-emerald-600 bg-bg-secondary">
                              Completed
                            </span>
                          )}
                          {overdue && (
                            <span className="px-2 py-0.5 text-label-sm text-red-600 bg-bg-secondary">
                              Overdue
                            </span>
                          )}
                        </div>

                        <h3
                          className={`font-display text-lg ${
                            goal.completedAt
                              ? "line-through text-text-muted"
                              : ""
                          }`}
                        >
                          {goal.title}
                        </h3>
                        {goal.description && (
                          <p className="text-text-secondary text-body text-sm mt-1 line-clamp-2">
                            {goal.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-label-sm text-text-muted">
                          {goal.deadline && (
                            <span
                              className={`flex items-center gap-1 ${
                                overdue
                                  ? "text-red-600"
                                  : deadlineNear
                                  ? "text-amber-600"
                                  : ""
                              }`}
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                                />
                              </svg>
                              {new Date(goal.deadline).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" }
                              )}
                            </span>
                          )}
                          <span>{goal.milestones.length} milestones</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-label-sm text-text-muted mb-1">
                            <span>Progress</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="h-1.5 bg-bg-secondary overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                goal.completedAt
                                  ? "bg-emerald-600"
                                  : "bg-charcoal dark:bg-cream"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingGoal(goal);
                            setShowAddModal(true);
                          }}
                          className="p-2 text-text-muted hover:text-text-primary transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteGoal(goal.id)}
                          className="p-2 text-text-muted hover:text-red-600 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Milestones */}
                    {isExpanded && goal.milestones.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border space-y-2">
                        {goal.milestones.map((milestone) => (
                          <div
                            key={milestone.id}
                            className="flex items-center gap-3 p-3 bg-bg-secondary"
                          >
                            <button
                              onClick={() =>
                                toggleMilestone(goal.id, milestone.id)
                              }
                              className={`transition-colors ${
                                milestone.completed
                                  ? "text-emerald-600"
                                  : "text-text-muted hover:text-text-primary"
                              }`}
                            >
                              {milestone.completed ? (
                                <svg
                                  className="w-5 h-5"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-5 h-5"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={1.5}
                                >
                                  <circle cx="12" cy="12" r="9" />
                                </svg>
                              )}
                            </button>
                            <span
                              className={`text-body ${
                                milestone.completed
                                  ? "line-through text-text-muted"
                                  : ""
                              }`}
                            >
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

        {/* Add/Edit Modal */}
        {showAddModal && (
          <GoalModal
            goal={editingGoal}
            onSave={saveGoal}
            onClose={() => {
              setShowAddModal(false);
              setEditingGoal(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

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
  const [category, setCategory] = useState<Goal["category"]>(
    goal?.category || "personal"
  );
  const [priority, setPriority] = useState<Goal["priority"]>(
    goal?.priority || "medium"
  );
  const [deadline, setDeadline] = useState(goal?.deadline || "");
  const [milestones, setMilestones] = useState<Milestone[]>(
    goal?.milestones || []
  );
  const [newMilestone, setNewMilestone] = useState("");

  const addMilestone = () => {
    if (newMilestone.trim()) {
      setMilestones([
        ...milestones,
        {
          id: Date.now().toString(),
          title: newMilestone.trim(),
          completed: false,
        },
      ]);
      setNewMilestone("");
    }
  };

  const removeMilestone = (id: string) => {
    setMilestones(milestones.filter((m) => m.id !== id));
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSave({
      title,
      description,
      category,
      priority,
      deadline: deadline || undefined,
      milestones,
    });
  };

  return (
    <div className="fixed inset-0 bg-charcoal/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-primary border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <span className="text-label-sm text-text-muted flex items-center gap-2 mb-1">
              <span>✦</span> {goal ? "Edit" : "New"} Goal
            </span>
            <h2 className="font-display text-xl">
              {goal ? "Edit Goal" : "Create Goal"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-label-sm text-text-secondary mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to achieve?"
              className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
            />
          </div>

          <div>
            <label className="block text-label-sm text-text-secondary mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={3}
              className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm text-text-secondary mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as Goal["category"])
                }
                className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
              >
                {Object.entries(CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-label-sm text-text-secondary mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as Goal["priority"])
                }
                className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
              >
                {Object.entries(PRIORITY_CONFIG).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-label-sm text-text-secondary mb-2">
              Deadline (optional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
            />
          </div>

          <div>
            <label className="block text-label-sm text-text-secondary mb-2">
              Milestones
            </label>
            <div className="space-y-2 mb-2">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 bg-bg-secondary border border-border"
                >
                  <span className="text-body text-sm">{m.title}</span>
                  <button
                    onClick={() => removeMilestone(m.id)}
                    className="text-text-muted hover:text-red-600"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addMilestone()}
                placeholder="Add a milestone..."
                className="flex-1 px-4 py-2 bg-bg-card border border-border text-text-primary text-body text-sm focus:outline-none focus:border-border-dark transition-colors"
              />
              <button
                onClick={addMilestone}
                className="px-4 py-2 bg-bg-secondary text-text-secondary hover:text-text-primary text-label-sm transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-border text-text-secondary text-label hover:bg-bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 px-4 py-3 bg-charcoal dark:bg-cream text-cream dark:text-charcoal text-label hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {goal ? "Save Changes" : "Create Goal"}
          </button>
        </div>
      </div>
    </div>
  );
}
