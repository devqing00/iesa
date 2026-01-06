"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";

interface Task {
  id: string;
  title: string;
  description?: string;
  category:
    | "study"
    | "assignment"
    | "project"
    | "exam"
    | "meeting"
    | "personal";
  priority: "high" | "medium" | "low";
  dueDate?: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

const CATEGORY_CONFIG = {
  study: { label: "Study", icon: "📖", color: "text-blue-600" },
  assignment: { label: "Assignment", icon: "📝", color: "text-purple-600" },
  project: { label: "Project", icon: "🔧", color: "text-emerald-600" },
  exam: { label: "Exam", icon: "📋", color: "text-red-600" },
  meeting: { label: "Meeting", icon: "👥", color: "text-amber-600" },
  personal: { label: "Personal", icon: "⭐", color: "text-pink-600" },
};

const PRIORITY_CONFIG = {
  high: { label: "High", color: "text-red-600" },
  medium: { label: "Medium", color: "text-amber-600" },
  low: { label: "Low", color: "text-green-600" },
};

const STORAGE_KEY = "iesa-planner-tasks";

export default function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">(
    "active"
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "priority" | "created">("date");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setTasks(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (tasks.length > 0)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const active = total - completed;
    const today = new Date().toDateString();
    const dueToday = tasks.filter(
      (t) =>
        !t.completed &&
        t.dueDate &&
        new Date(t.dueDate).toDateString() === today
    ).length;
    const overdue = tasks.filter(
      (t) =>
        !t.completed &&
        t.dueDate &&
        new Date(t.dueDate).getTime() < now &&
        new Date(t.dueDate).toDateString() !== today
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
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
  }, [tasks, filter, categoryFilter, sortBy]);

  const toggleComplete = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: !t.completed,
              completedAt: !t.completed ? new Date().toISOString() : undefined,
            }
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
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? { ...t, ...taskData } : t))
      );
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
    return (
      due.getTime() < now && due.toDateString() !== new Date().toDateString()
    );
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

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Personal Planner" />

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
            <span>✦</span> Plan & Execute
          </span>
          <h1 className="font-display text-display-sm mb-2">
            Personal Planner
          </h1>
          <p className="text-text-secondary text-body text-sm">
            Organize your tasks and stay on top of your schedule.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="page-frame p-4">
            <span className="text-label-sm text-text-muted">Active</span>
            <p className="font-display text-2xl">{stats.active}</p>
          </div>
          <div className="page-frame p-4">
            <span className="text-label-sm text-text-muted">Due Today</span>
            <p className="font-display text-2xl">{stats.dueToday}</p>
          </div>
          <div className="page-frame p-4">
            <span className="text-label-sm text-text-muted">Overdue</span>
            <p
              className={`font-display text-2xl ${
                stats.overdue > 0 ? "text-red-600" : ""
              }`}
            >
              {stats.overdue}
            </p>
          </div>
          <div className="page-frame p-4">
            <span className="text-label-sm text-text-muted">Completed</span>
            <p className="font-display text-2xl">{stats.completed}</p>
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
              {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 text-label-sm bg-bg-card border border-border text-text-primary focus:outline-none"
            >
              <option value="date">Sort by Date</option>
              <option value="priority">Sort by Priority</option>
              <option value="created">Sort by Created</option>
            </select>
          </div>

          <button
            onClick={() => {
              setEditingTask(null);
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
            Add Task
          </button>
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="page-frame p-12 text-center">
              <p className="font-display text-lg mb-2">
                {filter === "completed"
                  ? "No completed tasks"
                  : "No tasks to show"}
              </p>
              <p className="text-text-muted text-label-sm mb-4">
                {filter === "completed"
                  ? "Complete some tasks to see them here."
                  : "Create your first task to get started."}
              </p>
              {filter !== "completed" && (
                <button
                  onClick={() => {
                    setEditingTask(null);
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
                  Create First Task
                </button>
              )}
            </div>
          ) : (
            filteredTasks.map((task) => {
              const categoryConfig = CATEGORY_CONFIG[task.category];
              const priorityConfig = PRIORITY_CONFIG[task.priority];
              const dueToday = isDueToday(task.dueDate);
              const overdue = isOverdue(task.dueDate, task.completed);

              return (
                <div
                  key={task.id}
                  className={`page-frame p-4 transition-all ${
                    task.completed ? "opacity-60" : ""
                  } ${overdue ? "border-red-600" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleComplete(task.id)}
                      className={`mt-0.5 transition-colors ${
                        task.completed
                          ? "text-emerald-600"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {task.completed ? (
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
                        {task.completed && (
                          <span className="px-2 py-0.5 text-label-sm text-emerald-600 bg-bg-secondary">
                            Done
                          </span>
                        )}
                        {overdue && (
                          <span className="px-2 py-0.5 text-label-sm text-red-600 bg-bg-secondary">
                            Overdue
                          </span>
                        )}
                        {dueToday && !task.completed && (
                          <span className="px-2 py-0.5 text-label-sm text-amber-600 bg-bg-secondary">
                            Due Today
                          </span>
                        )}
                      </div>

                      <h3
                        className={`font-display text-base ${
                          task.completed ? "line-through text-text-muted" : ""
                        }`}
                      >
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-text-secondary text-body text-sm mt-1 line-clamp-1">
                          {task.description}
                        </p>
                      )}

                      {task.dueDate && (
                        <p
                          className={`mt-2 text-label-sm flex items-center gap-1 ${
                            overdue
                              ? "text-red-600"
                              : dueToday
                              ? "text-amber-600"
                              : "text-text-muted"
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
                          {formatDueDate(task.dueDate)}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingTask(task);
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
                        onClick={() => deleteTask(task.id)}
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
                </div>
              );
            })
          )}
        </div>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <TaskModal
            task={editingTask}
            onSave={saveTask}
            onClose={() => {
              setShowAddModal(false);
              setEditingTask(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function TaskModal({
  task,
  onSave,
  onClose,
}: {
  task: Task | null;
  onSave: (data: Partial<Task>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [category, setCategory] = useState<Task["category"]>(
    task?.category || "personal"
  );
  const [priority, setPriority] = useState<Task["priority"]>(
    task?.priority || "medium"
  );
  const [dueDate, setDueDate] = useState(task?.dueDate || "");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSave({
      title,
      description: description || undefined,
      category,
      priority,
      dueDate: dueDate || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-charcoal/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-primary border border-border w-full max-w-lg">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <span className="text-label-sm text-text-muted flex items-center gap-2 mb-1">
              <span>✦</span> {task ? "Edit" : "New"} Task
            </span>
            <h2 className="font-display text-xl">
              {task ? "Edit Task" : "Create Task"}
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
              placeholder="What needs to be done?"
              className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
            />
          </div>

          <div>
            <label className="block text-label-sm text-text-secondary mb-2">
              Description (optional)
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
                  setCategory(e.target.value as Task["category"])
                }
                className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
              >
                {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
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
                  setPriority(e.target.value as Task["priority"])
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
              Due Date (optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
            />
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
            {task ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
