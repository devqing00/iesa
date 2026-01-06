"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { useState, useEffect } from "react";

interface SemesterRecord {
  id: string;
  gpa: number;
  credits: number;
  timestamp: string;
}

interface PlannerTask {
  id: string;
  completed: boolean;
  dueDate?: string;
}

interface TimerRecord {
  mode: string;
  duration: number;
  date: string;
}

const TOOLS = [
  {
    id: "cgpa",
    title: "CGPA Calculator",
    desc: "Track your academic journey with precision. Calculate, visualize, and improve your GPA.",
    href: "./growth/cgpa",
  },
  {
    id: "planner",
    title: "Personal Planner",
    desc: "Organize tasks, deadlines, and study sessions. Stay productive and achieve more.",
    href: "./growth/planner",
  },
  {
    id: "timer",
    title: "Study Timer",
    desc: "Pomodoro-style focus sessions. Build productive habits and track your study streaks.",
    href: "./growth/timer",
  },
  {
    id: "goals",
    title: "Goal Tracker",
    desc: "Set ambitious goals, break them into milestones, and celebrate your achievements.",
    href: "./growth/goals",
  },
];

export default function GrowthPage() {
  const [stats, setStats] = useState({
    latestGpa: 0,
    totalRecords: 0,
    tasksCompleted: 0,
    tasksPending: 0,
    streak: 0,
    focusMinutes: 0,
    focusSessions: 0,
  });

  useEffect(() => {
    try {
      const cgpaHistory = localStorage.getItem("iesa-cgpa-history");
      const cgpaRecords: SemesterRecord[] = cgpaHistory
        ? JSON.parse(cgpaHistory)
        : [];

      const plannerTasks = localStorage.getItem("planner-tasks");
      const tasks: PlannerTask[] = plannerTasks ? JSON.parse(plannerTasks) : [];

      const completed = tasks.filter((t) => t.completed).length;
      const pending = tasks.filter((t) => !t.completed).length;

      const timerHistory = localStorage.getItem("iesa-timer-history");
      const timerRecords: TimerRecord[] = timerHistory
        ? JSON.parse(timerHistory)
        : [];
      const today = new Date().toDateString();
      const todayFocus = timerRecords.filter(
        (r) => r.date === today && r.mode === "focus"
      );
      const focusMinutes = todayFocus.reduce((acc, r) => acc + r.duration, 0);

      setStats({
        latestGpa: cgpaRecords.length > 0 ? cgpaRecords[0].gpa : 0,
        totalRecords: cgpaRecords.length,
        tasksCompleted: completed,
        tasksPending: pending,
        streak: Math.min(cgpaRecords.length, 7),
        focusMinutes,
        focusSessions: todayFocus.length,
      });
    } catch {
      console.error("Failed to load growth stats");
    }
  }, []);

  const getToolIcon = (id: string) => {
    switch (id) {
      case "cgpa":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z"
            />
          </svg>
        );
      case "planner":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
            />
          </svg>
        );
      case "timer":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "goals":
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const getToolStats = (id: string) => {
    switch (id) {
      case "cgpa":
        return `${stats.totalRecords} records saved`;
      case "planner":
        return `${stats.tasksCompleted} completed · ${stats.tasksPending} pending`;
      case "timer":
        return `${stats.focusMinutes} min today · ${stats.focusSessions} sessions`;
      case "goals":
        return "Set and track your goals";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Growth Hub" />

      <div className="px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="border-t border-border pt-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-charcoal dark:bg-cream flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-cream dark:text-charcoal"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                  />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl text-text-primary">
                  Your Growth Journey
                </h2>
                <p className="text-label-sm text-text-muted">
                  Track progress, build habits, and unlock your potential
                </p>
              </div>
            </div>
            <span className="page-number hidden md:block">Page 01</span>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-3 md:gap-4">
            <div className="flex items-center gap-2 px-4 py-2 border border-border">
              <svg
                className="w-4 h-4 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
              <span className="text-label-sm text-text-secondary">
                GPA:{" "}
                <span className="text-text-primary font-display">
                  {stats.latestGpa > 0 ? stats.latestGpa.toFixed(2) : "--"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 border border-border">
              <svg
                className="w-4 h-4 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-label-sm text-text-secondary">
                Tasks:{" "}
                <span className="text-text-primary font-display">
                  {stats.tasksCompleted}
                </span>{" "}
                done
              </span>
            </div>
            {stats.streak > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20">
                <svg
                  className="w-4 h-4 text-orange-600 dark:text-orange-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
                  />
                </svg>
                <span className="text-label-sm text-text-secondary">
                  <span className="text-orange-600 dark:text-orange-400 font-display">
                    {stats.streak}
                  </span>{" "}
                  record streak
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Tools Grid */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-label-sm text-text-muted">✦</span>
            <h2 className="text-label-sm text-text-muted">Growth Tools</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {TOOLS.map((tool, index) => (
              <Link
                key={tool.id}
                href={tool.href}
                className="group border border-border hover:border-border-dark transition-colors"
              >
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <span className="text-label-sm text-text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <svg
                    className="w-5 h-5 text-text-muted group-hover:text-text-primary group-hover:translate-x-1 transition-all"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"
                    />
                  </svg>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-charcoal dark:bg-cream flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <span className="text-cream dark:text-charcoal">
                        {getToolIcon(tool.id)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg text-text-primary mb-1 group-hover:text-text-secondary transition-colors">
                        {tool.title}
                      </h3>
                      <p className="text-body text-sm text-text-secondary mb-3">
                        {tool.desc}
                      </p>
                      <span className="text-label-sm text-text-muted">
                        {getToolStats(tool.id)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Motivation Card */}
        <section className="bg-charcoal dark:bg-cream p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 border border-cream/30 dark:border-charcoal/30 flex items-center justify-center shrink-0">
              <svg
                className="w-6 h-6 text-cream dark:text-charcoal"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-base text-cream dark:text-charcoal mb-1">
                Keep Growing!
              </h3>
              <p className="text-body text-sm text-cream/70 dark:text-charcoal/70">
                Small consistent steps lead to massive results. Your future self
                will thank you.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy Note */}
        <div className="mt-6 text-center text-label-sm text-text-muted flex items-center justify-center gap-1.5">
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          All data stored locally on your device
        </div>
      </div>
    </div>
  );
}
