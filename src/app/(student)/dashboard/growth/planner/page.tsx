"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";

/* ─── Types ─── */
interface Task {
  id: string;
  title: string;
  description?: string;
  category: "study" | "assignment" | "project" | "exam" | "meeting" | "personal";
  priority: "high" | "medium" | "low";
  dueDate?: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

/* ─── Constants ─── */
const CATEGORY_CONFIG = {
  study: { label: "Study", bg: "bg-lavender-light", text: "text-lavender", dot: "bg-lavender", border: "border-lavender" },
  assignment: { label: "Assignment", bg: "bg-lavender-light", text: "text-lavender", dot: "bg-lavender", border: "border-lavender" },
  project: { label: "Project", bg: "bg-teal-light", text: "text-teal", dot: "bg-teal", border: "border-teal" },
  exam: { label: "Exam", bg: "bg-coral-light", text: "text-coral", dot: "bg-coral", border: "border-coral" },
  meeting: { label: "Meeting", bg: "bg-sunny-light", text: "text-sunny", dot: "bg-sunny", border: "border-sunny" },
  personal: { label: "Personal", bg: "bg-coral-light", text: "text-coral", dot: "bg-coral", border: "border-coral" },
} as const;

const PRIORITY_CONFIG = {
  high: { label: "High", bg: "bg-coral-light", text: "text-coral", dot: "bg-coral" },
  medium: { label: "Medium", bg: "bg-sunny-light", text: "text-sunny", dot: "bg-sunny" },
  low: { label: "Low", bg: "bg-teal-light", text: "text-teal", dot: "bg-teal" },
} as const;

const ACCENT_CYCLE = ["border-l-teal", "border-l-coral", "border-l-lavender", "border-l-sunny"] as const;
const STORAGE_KEY = "iesa-planner-tasks";

export default function PlannerPage() {
  /* ─── State ─── */
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "priority" | "created">("date");
  const [now, setNow] = useState(() => Date.now());

  /* ─── Effects ─── */
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tasks.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  /* ─── Computed ─── */
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const active = total - completed;
    const today = new Date().toDateString();
    const dueToday = tasks.filter(
      (t) => !t.completed && t.dueDate && new Date(t.dueDate).toDateString() === today
    ).length;
    const overdue = tasks.filter(
      (t) => !t.completed && t.dueDate && new Date(t.dueDate).getTime() < now && new Date(t.dueDate).toDateString() !== today
    ).length;
    return { total, completed, active, dueToday, overdue };
  }, [tasks, now]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (filter === "active") return !t.completed;
        if (filter === "completed") return t.completed;
        return true;
      })
      .filter((t) => categoryFilter === "all" || t.category === categoryFilter)
      .sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        if (sortBy === "date") {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (sortBy === "priority") {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.priority] - order[b.priority];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [tasks, filter, categoryFilter, sortBy]);

  /* ─── Handlers ─── */
  const toggleComplete = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
          : t
      )
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const saveTask = (taskData: Partial<Task>) => {
    if (editingTask) {
      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? { ...t, ...taskData } : t)));
    } else {
      const newTask: Task = {
        id: Date.now().toString(),
        title: taskData.title || "",
        description: taskData.description,
        category: taskData.category || "personal",
        priority: taskData.priority || "medium",
        dueDate: taskData.dueDate,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [...prev, newTask]);
    }
    setShowAddModal(false);
    setEditingTask(null);
  };

  const isDueToday = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate).toDateString() === new Date().toDateString();
  };

  const isOverdue = (dueDate?: string, completed?: boolean) => {
    if (!dueDate || completed) return false;
    const due = new Date(dueDate);
    return due.getTime() < now && due.toDateString() !== new Date().toDateString();
  };

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Personal Planner" />

      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8 max-w-6xl mx-auto relative">
        {/* Diamond Sparkle Decorators */}
        <svg className="fixed top-20 left-[8%] w-5 h-5 text-coral/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-40 right-[6%] w-7 h-7 text-teal/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-[55%] left-[4%] w-4 h-4 text-sunny/18 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed bottom-32 right-[10%] w-6 h-6 text-lavender/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-[30%] right-[18%] w-4 h-4 text-lime/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed bottom-48 left-[15%] w-5 h-5 text-coral/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

        {/* Back Link */}
        <Link
          href="/dashboard/growth"
          className="inline-flex items-center gap-2 font-display font-bold text-xs text-slate uppercase tracking-wider hover:text-navy transition-colors mb-6 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd" />
          </svg>
          Back to Growth Hub
        </Link>

        {/* ═══ BENTO HERO ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          {/* Title Card — coral theme */}
          <div className="md:col-span-7 bg-coral border-[6px] border-navy rounded-[2rem] p-8 shadow-[10px_10px_0_0_#000] rotate-[-0.4deg] hover:rotate-0 transition-transform relative overflow-hidden">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/70 flex items-center gap-2 mb-3">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
              Plan & Execute
            </span>
            <h1 className="font-display font-black text-3xl md:text-4xl text-navy mb-2">
              <span className="brush-highlight brush-coral">Personal</span> Planner
            </h1>
            <p className="font-display font-normal text-sm text-navy/70 mb-6 max-w-md">
              Organize your tasks, smash deadlines, and stay on top of your academic schedule.
            </p>
            <button
              onClick={() => { setEditingTask(null); setShowAddModal(true); }}
              className="inline-flex items-center gap-2 bg-navy text-lime border-[4px] border-lime rounded-2xl px-6 py-3 font-display font-bold text-sm shadow-[5px_5px_0_0_#000] hover:shadow-[8px_8px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" /></svg>
              Add New Task
            </button>
          </div>

          {/* Stats Grid — 2×2 */}
          <div className="md:col-span-5 grid grid-cols-2 gap-3">
            {/* Active */}
            <div className="bg-teal-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[0.3deg] hover:rotate-0 transition-transform">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Active</span>
              <p className="font-display font-black text-3xl text-navy mt-1">{stats.active}</p>
              <div className="w-6 h-1.5 rounded-full bg-teal mt-2" />
            </div>
            {/* Due Today */}
            <div className="bg-sunny-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Due Today</span>
              <p className="font-display font-black text-3xl text-navy mt-1">{stats.dueToday}</p>
              <div className="w-6 h-1.5 rounded-full bg-sunny mt-2" />
            </div>
            {/* Overdue */}
            <div className="bg-coral-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Overdue</span>
              <p className={`font-display font-black text-3xl mt-1 ${stats.overdue > 0 ? "text-coral" : "text-navy"}`}>{stats.overdue}</p>
              <div className="w-6 h-1.5 rounded-full bg-coral mt-2" />
            </div>
            {/* Completed */}
            <div className="bg-lavender-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[-0.3deg] hover:rotate-0 transition-transform">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Completed</span>
              <p className="font-display font-black text-3xl text-navy mt-1">{stats.completed}</p>
              <div className="w-6 h-1.5 rounded-full bg-lavender mt-2" />
            </div>
          </div>
        </div>

        {/* ═══ FILTER BAR ═══ */}
        <div className="bg-snow border-[4px] border-navy rounded-[1.5rem] shadow-[6px_6px_0_0_#000] p-4 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "active", "completed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-xl font-display font-bold text-xs uppercase tracking-wider border-[3px] transition-all ${
                    filter === f
                      ? "bg-navy text-lime border-navy shadow-[3px_3px_0_0_#000]"
                      : "bg-ghost text-navy/50 border-transparent hover:border-navy/20 hover:text-navy"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Category & Sort */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className="px-3 py-2 rounded-xl font-display font-bold text-xs uppercase tracking-wider bg-ghost border-[3px] border-navy text-navy focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                aria-label="Sort tasks"
                className="px-3 py-2 rounded-xl font-display font-bold text-xs uppercase tracking-wider bg-ghost border-[3px] border-navy text-navy focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
              >
                <option value="date">By Due Date</option>
                <option value="priority">By Priority</option>
                <option value="created">By Created</option>
              </select>
            </div>
          </div>
        </div>

        {/* ═══ TASKS LIST ═══ */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            /* Empty State */
            <div className="bg-navy border-[4px] border-lime rounded-[2rem] shadow-[8px_8px_0_0_#000] p-12 text-center">
              <div className="w-14 h-14 bg-lime/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-lime" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94A48.972 48.972 0 0012 3c-2.227 0-4.406.148-6.532.418A2.943 2.943 0 003 6.108V8.25a3 3 0 003-3h1.502zM13.5 8.25a.75.75 0 00-1.5 0v5.25H6.75a.75.75 0 000 1.5H12v5.25a.75.75 0 001.5 0v-5.25h5.25a.75.75 0 000-1.5H13.5V8.25z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="font-display font-black text-xl text-lime mb-2">
                {filter === "completed" ? "No completed tasks yet" : "Your planner is empty"}
              </p>
              <p className="font-display font-normal text-sm text-lime/60 mb-6">
                {filter === "completed" ? "Complete some tasks to see them here." : "Create your first task and start crushing it."}
              </p>
              {filter !== "completed" && (
                <button
                  onClick={() => { setEditingTask(null); setShowAddModal(true); }}
                  className="inline-flex items-center gap-2 bg-lime text-navy border-[4px] border-navy rounded-2xl px-6 py-3 font-display font-bold text-sm shadow-[5px_5px_0_0_#0F0F2D] hover:shadow-[8px_8px_0_0_#0F0F2D] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" /></svg>
                  Create First Task
                </button>
              )}
            </div>
          ) : (
            filteredTasks.map((task, i) => {
              const catCfg = CATEGORY_CONFIG[task.category];
              const priCfg = PRIORITY_CONFIG[task.priority];
              const dueToday = isDueToday(task.dueDate);
              const overdue = isOverdue(task.dueDate, task.completed);
              const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];

              return (
                <div
                  key={task.id}
                  className={`bg-snow border-[4px] border-navy ${accent} border-l-[6px] rounded-[1.5rem] shadow-[6px_6px_0_0_#000] p-5 transition-all hover:shadow-[4px_4px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] ${
                    task.completed ? "opacity-50" : ""
                  } ${overdue ? "border-coral border-l-coral" : ""}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleComplete(task.id)}
                      className={`mt-1 shrink-0 transition-colors ${task.completed ? "text-teal" : "text-slate hover:text-navy"}`}
                      aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
                    >
                      {task.completed ? (
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${catCfg.bg} ${catCfg.text} font-display font-bold text-[10px] uppercase tracking-[0.08em]`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${catCfg.dot}`} />
                          {catCfg.label}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${priCfg.bg} ${priCfg.text} font-display font-bold text-[10px] uppercase tracking-[0.08em]`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${priCfg.dot}`} />
                          {priCfg.label}
                        </span>
                        {task.completed && (
                          <span className="px-2.5 py-1 rounded-lg bg-teal-light text-teal font-display font-bold text-[10px] uppercase tracking-[0.08em]">Done</span>
                        )}
                        {overdue && (
                          <span className="px-2.5 py-1 rounded-lg bg-coral-light text-coral font-display font-bold text-[10px] uppercase tracking-[0.08em] flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>
                            Overdue
                          </span>
                        )}
                        {dueToday && !task.completed && (
                          <span className="px-2.5 py-1 rounded-lg bg-sunny-light text-sunny font-display font-bold text-[10px] uppercase tracking-[0.08em]">Due Today</span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <h3 className={`font-display font-black text-base md:text-lg ${task.completed ? "line-through text-slate" : "text-navy"}`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="font-display font-normal text-sm text-navy/50 mt-1 line-clamp-1">{task.description}</p>
                      )}

                      {/* Due Date */}
                      {task.dueDate && (
                        <p className={`mt-2.5 font-display font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${overdue ? "text-coral" : dueToday ? "text-sunny" : "text-slate"}`}>
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
                          </svg>
                          {formatDueDate(task.dueDate)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingTask(task); setShowAddModal(true); }}
                        className="w-9 h-9 rounded-xl bg-ghost border-[2px] border-navy/20 flex items-center justify-center text-slate hover:text-navy hover:border-navy transition-all"
                        aria-label="Edit task"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="w-9 h-9 rounded-xl bg-ghost border-[2px] border-navy/20 flex items-center justify-center text-slate hover:text-coral hover:border-coral transition-all"
                        aria-label="Delete task"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Task Count Footer */}
        {filteredTasks.length > 0 && (
          <div className="mt-6 text-center">
            <p className="font-display font-bold text-xs text-slate uppercase tracking-wider">
              Showing {filteredTasks.length} of {stats.total} tasks
            </p>
          </div>
        )}

        {/* Privacy Note */}
        <p className="mt-6 text-center font-display font-bold text-xs text-slate uppercase tracking-wider flex items-center justify-center gap-1.5">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
          </svg>
          All data stored locally on your device
        </p>

        {/* ═══ TASK MODAL ═══ */}
        {showAddModal && (
          <TaskModal
            task={editingTask}
            onSave={saveTask}
            onClose={() => { setShowAddModal(false); setEditingTask(null); }}
          />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/*              TASK MODAL                      */
/* ═══════════════════════════════════════════ */
function TaskModal({ task, onSave, onClose }: { task: Task | null; onSave: (data: Partial<Task>) => void; onClose: () => void }) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [category, setCategory] = useState<Task["category"]>(task?.category || "personal");
  const [priority, setPriority] = useState<Task["priority"]>(task?.priority || "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate || "");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSave({ title, description: description || undefined, category, priority, dueDate: dueDate || undefined });
  };

  return (
    <div className="fixed inset-0 bg-navy/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-ghost border-[4px] border-navy rounded-[2rem] shadow-[10px_10px_0_0_#000] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b-[3px] border-navy flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 flex items-center gap-2 mb-1">
              <svg className="w-3 h-3 text-coral" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
              {task ? "Edit" : "New"} Task
            </span>
            <h2 className="font-display font-black text-xl text-navy">{task ? "Edit Task" : "Create Task"}</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-snow border-[3px] border-navy flex items-center justify-center text-slate hover:text-navy transition-colors" aria-label="Close modal">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label htmlFor="task-title" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-2">Title</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-xl text-navy font-display font-normal focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="task-description" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-2">Description (optional)</label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={3}
              className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-xl text-navy font-display font-normal focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all resize-none"
            />
          </div>

          {/* Category — Button Selectors */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-3">Category</label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(CATEGORY_CONFIG) as [Task["category"], typeof CATEGORY_CONFIG[Task["category"]]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-display font-bold text-xs uppercase tracking-wider border-[3px] transition-all ${
                    category === key
                      ? `${cfg.bg} ${cfg.text} ${cfg.border} shadow-[3px_3px_0_0_#000]`
                      : "bg-snow text-navy/40 border-navy/15 hover:border-navy/30"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority — Button Selectors */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-3">Priority</label>
            <div className="flex gap-2">
              {(Object.entries(PRIORITY_CONFIG) as [Task["priority"], typeof PRIORITY_CONFIG[Task["priority"]]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPriority(key)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider border-[3px] transition-all ${
                    priority === key
                      ? `${cfg.bg} ${cfg.text} border-navy shadow-[3px_3px_0_0_#000]`
                      : "bg-snow text-navy/40 border-navy/15 hover:border-navy/30"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="task-due-date" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-2">Due Date (optional)</label>
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-xl text-navy font-display font-normal focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-[3px] border-navy flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border-[3px] border-navy font-display font-bold text-xs text-navy uppercase tracking-wider hover:bg-cloud transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 px-4 py-3 rounded-2xl bg-lime text-navy border-[4px] border-navy shadow-[4px_4px_0_0_#0F0F2D] font-display font-bold text-xs uppercase tracking-wider hover:shadow-[6px_6px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            {task ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
