"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState, useEffect } from "react";
import { Plus, Trash2, Check, X, Calendar, Clock, Tag, Filter } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: "low" | "medium" | "high";
  dueDate?: string;
  completed: boolean;
  createdAt: string;
}

const CATEGORIES = ["All", "Assignment", "Study", "Project", "Exam", "Personal", "Other"];
const PRIORITIES = ["low", "medium", "high"] as const;

export default function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState("All");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    category: "Assignment",
    priority: "medium" as const,
    dueDate: "",
  });

  // Load tasks from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('iesa-planner-tasks');
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved tasks:', e);
      }
    }
  }, []);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('iesa-planner-tasks', JSON.stringify(tasks));
    }
  }, [tasks]);

  const addTask = () => {
    if (!newTask.title.trim()) return;

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      category: newTask.category,
      priority: newTask.priority,
      dueDate: newTask.dueDate || undefined,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setTasks([task, ...tasks]);
    setNewTask({
      title: "",
      description: "",
      category: "Assignment",
      priority: "medium",
      dueDate: "",
    });
    setShowAddForm(false);
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const filtered = tasks.filter(t => {
    if (filter === "All") return true;
    return t.category === filter;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200";
      case "medium":
        return "text-orange-600 bg-orange-50 dark:bg-orange-950/30 border-orange-200";
      case "low":
        return "text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-950/30 border-gray-200";
    }
  };

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    pending: tasks.filter(t => !t.completed).length,
    overdue: tasks.filter(t => 
      !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
    ).length,
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <DashboardHeader title="Personal Planner" />
      <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-4">
            <p className="text-xs text-foreground/60 uppercase tracking-wider mb-1">Total Tasks</p>
            <p className="text-3xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-4">
            <p className="text-xs text-foreground/60 uppercase tracking-wider mb-1">Completed</p>
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-4">
            <p className="text-xs text-foreground/60 uppercase tracking-wider mb-1">Pending</p>
            <p className="text-3xl font-bold text-blue-600">{stats.pending}</p>
          </div>
          <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-4">
            <p className="text-xs text-foreground/60 uppercase tracking-wider mb-1">Overdue</p>
            <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
          </div>
        </div>

        {/* Filters and Add Button */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === cat
                    ? "bg-primary text-white shadow-lg"
                    : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                }`}
              >
                <Filter className="w-3 h-3 inline-block mr-1" />
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-6 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 justify-center"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>

        {/* Add Task Form */}
        {showAddForm && (
          <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-6 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <h3 className="text-lg font-bold text-foreground mb-4">New Task</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground/70 block mb-2">Title *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="e.g., Complete Math Assignment"
                  className="w-full px-4 py-2 rounded-lg bg-background border border-foreground/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground/70 block mb-2">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Optional details about the task..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-foreground/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground/70 block mb-2">Category</label>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-background border border-foreground/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {CATEGORIES.filter(c => c !== "All").map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/70 block mb-2">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                    className="w-full px-4 py-2 rounded-lg bg-background border border-foreground/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/70 block mb-2">Due Date</label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-background border border-foreground/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-lg bg-foreground/5 text-foreground hover:bg-foreground/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={addTask}
                  disabled={!newTask.title.trim()}
                  className="px-6 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tasks List */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-foreground/5 flex items-center justify-center">
              <Check className="w-8 h-8 text-foreground/20" />
            </div>
            <p className="text-foreground/60">
              {filter === "All" ? "No tasks yet. Add one to get started!" : `No ${filter} tasks found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(task => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;

              return (
                <div
                  key={task.id}
                  className={`bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-4 transition-all ${
                    task.completed ? "opacity-60" : ""
                  } ${isOverdue ? "border-red-500/50" : ""}`}
                >
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        task.completed
                          ? "bg-primary border-primary text-white"
                          : "border-foreground/30 hover:border-primary"
                      }`}
                    >
                      {task.completed && <Check className="w-4 h-4" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className={`font-semibold text-foreground ${task.completed ? "line-through" : ""}`}>
                          {task.title}
                        </h4>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {task.description && (
                        <p className="text-sm text-foreground/60 mb-2">{task.description}</p>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-foreground/5 text-foreground/60 border border-foreground/10">
                          <Tag className="w-3 h-3 inline-block mr-1" />
                          {task.category}
                        </span>
                        {task.dueDate && (
                          <span className={`text-xs px-2 py-1 rounded-full border ${
                            isOverdue 
                              ? "bg-red-50 dark:bg-red-950/30 text-red-600 border-red-200"
                              : "bg-foreground/5 text-foreground/60 border-foreground/10"
                          }`}>
                            <Calendar className="w-3 h-3 inline-block mr-1" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
