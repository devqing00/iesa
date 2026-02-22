"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { useState, useEffect } from "react";

/* ─── Types ─────────────────────────────────────────────────────── */

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

interface GoalData {
  id: string;
  completedAt?: string;
  milestones?: { completed: boolean }[];
}

interface HabitData {
  id: string;
  completions: string[];
  archived: boolean;
}

interface DeckData {
  id: string;
  cards: { nextReview: string }[];
}

interface JournalEntry {
  weekKey: string;
  mood: number;
}

interface CourseData {
  id: string;
  topics: { completed: boolean }[];
}

/* ─── Tool definitions ──────────────────────────────────────────── */

const TOOLS = [
  {
    id: "cgpa",
    title: "CGPA Calculator",
    desc: "Track your academic journey with precision. Calculate, visualize, and improve your GPA.",
    href: "cgpa",
    color: { bg: "bg-lavender-light", icon: "bg-lavender", iconText: "text-navy" },
  },
  {
    id: "planner",
    title: "Personal Planner",
    desc: "Organize tasks, deadlines, and study sessions. Stay productive and achieve more.",
    href: "planner",
    color: { bg: "bg-coral-light", icon: "bg-coral", iconText: "text-snow" },
  },
  {
    id: "timer",
    title: "Study Timer",
    desc: "Pomodoro-style focus sessions. Build productive habits and track your study streaks.",
    href: "timer",
    color: { bg: "bg-sunny-light", icon: "bg-sunny", iconText: "text-navy" },
  },
  {
    id: "goals",
    title: "Goal Tracker",
    desc: "Set ambitious goals, break them into milestones, and celebrate your achievements.",
    href: "goals",
    color: { bg: "bg-teal-light", icon: "bg-teal", iconText: "text-navy" },
  },
  {
    id: "habits",
    title: "Habit Tracker",
    desc: "Build daily routines that stick. Track streaks, heatmaps, and weekly completion.",
    href: "habits",
    color: { bg: "bg-lime-light", icon: "bg-lime", iconText: "text-navy" },
  },
  {
    id: "flashcards",
    title: "Flashcards",
    desc: "SM-2 spaced repetition for effortless recall. Create decks, rate difficulty, master concepts.",
    href: "flashcards",
    color: { bg: "bg-lavender-light", icon: "bg-lavender", iconText: "text-snow" },
  },
  {
    id: "journal",
    title: "Weekly Journal",
    desc: "Reflect on wins, identify growth areas, and plan your week with structured prompts.",
    href: "journal",
    color: { bg: "bg-coral-light", icon: "bg-coral", iconText: "text-snow" },
  },
  {
    id: "courses",
    title: "Course Progress",
    desc: "Track syllabus completion topic by topic. See exactly how far you've come in every course.",
    href: "courses",
    color: { bg: "bg-teal-light", icon: "bg-teal", iconText: "text-navy" },
  },
  {
    id: "study-groups",
    title: "Study Group Finder",
    desc: "Find study partners, create groups by course, and schedule meetups. Better together.",
    href: "study-groups",
    color: { bg: "bg-sunny-light", icon: "bg-sunny", iconText: "text-navy" },
  },
];

const toolIcons: Record<string, React.ReactNode> = {
  cgpa: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0122.83 8.72a.75.75 0 01-.231 1.337 49.949 49.949 0 00-9.902 3.912l-.003.002-.34.18a.75.75 0 01-.707 0A50.009 50.009 0 007.5 12.174v-.224c0-.131.067-.248.172-.311a54.614 54.614 0 014.653-2.52.75.75 0 00-.65-1.352 56.129 56.129 0 00-4.78 2.589 1.858 1.858 0 00-.859 1.228 49.803 49.803 0 00-4.634-1.527.75.75 0 01-.231-1.337A60.653 60.653 0 0111.7 2.805z" />
      <path d="M13.06 15.473a48.45 48.45 0 017.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 01-.46.71 47.878 47.878 0 00-8.105 4.342.75.75 0 01-.832 0 47.877 47.877 0 00-8.104-4.342.75.75 0 01-.461-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 016 13.18v1.27a1.5 1.5 0 00-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.661a6.729 6.729 0 00.551-1.607 1.5 1.5 0 00.14-2.67v-.645a48.549 48.549 0 013.44 1.667 2.25 2.25 0 002.12 0z" />
      <path d="M4.462 19.462c.42-.419.753-.89 1-1.395.453.214.902.435 1.347.662a6.742 6.742 0 01-1.286 1.794.75.75 0 01-1.06-1.06z" />
    </svg>
  ),
  planner: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94A48.972 48.972 0 0012 3c-2.227 0-4.406.141-6.336.405A3.005 3.005 0 003 6.108v8.142a3 3 0 003 3h1.5V9.375A3.375 3.375 0 0110.875 6h-3.373z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M10.875 6A2.625 2.625 0 008.25 8.625v10.5A2.625 2.625 0 0010.875 21.75h6.75A2.625 2.625 0 0020.25 19.125V8.625A2.625 2.625 0 0017.625 6h-6.75zm-1.5 3.75a.75.75 0 01.75-.75h5.25a.75.75 0 010 1.5h-5.25a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h5.25a.75.75 0 000-1.5h-5.25zm0 3a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
    </svg>
  ),
  timer: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
    </svg>
  ),
  goals: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.77l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z" clipRule="evenodd" />
    </svg>
  ),
  habits: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3z" clipRule="evenodd" />
    </svg>
  ),
  flashcards: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
    </svg>
  ),
  journal: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 003 3h15a.75.75 0 000-1.5H5.25a1.5 1.5 0 01-1.5-1.5h15.75a.75.75 0 00.75-.75V4.875C20.25 3.839 19.41 3 18.375 3H4.125zM12 9.75a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5H12zm-3-1.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zm.75 4.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" clipRule="evenodd" />
    </svg>
  ),
  courses: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M1.5 5.625c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 18.375V5.625zM21 9.375A.375.375 0 0020.625 9h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5A.375.375 0 0021 10.875v-1.5zm0 3.75a.375.375 0 00-.375-.375h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 00.375-.375v-1.5zm0 3.75a.375.375 0 00-.375-.375h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 00.375-.375v-1.5zM10.875 18.75a.375.375 0 00.375-.375v-1.5a.375.375 0 00-.375-.375h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5zM3.375 15h7.5a.375.375 0 00.375-.375v-1.5a.375.375 0 00-.375-.375h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375zm0-3.75h7.5a.375.375 0 00.375-.375v-1.5A.375.375 0 0010.875 9h-7.5A.375.375 0 003 9.375v1.5c0 .207.168.375.375.375z" clipRule="evenodd" />
    </svg>
  ),
  "study-groups": (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 016.709 7.498.75.75 0 01-.372.568A12.696 12.696 0 0112 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 01-.372-.568 6.787 6.787 0 011.019-4.38z" />
      <path d="M5.082 14.254a8.287 8.287 0 00-1.308 5.135 9.687 9.687 0 01-1.764-.44l-.115-.04a.563.563 0 01-.373-.487l-.01-.121a3.75 3.75 0 013.57-4.047zM20.226 19.389a8.287 8.287 0 00-1.308-5.135 3.75 3.75 0 013.57 4.047l-.01.121a.563.563 0 01-.373.486l-.115.04c-.567.2-1.156.349-1.764.441z" />
    </svg>
  ),
};

/* ─── Component ─────────────────────────────────────────────────── */

export default function GrowthPage() {
  const [stats, setStats] = useState({
    latestGpa: 0,
    totalRecords: 0,
    tasksCompleted: 0,
    tasksPending: 0,
    goalsActive: 0,
    goalsCompleted: 0,
    focusMinutes: 0,
    focusSessions: 0,
    habitsActive: 0,
    habitsStreak: 0,
    flashcardDecks: 0,
    flashcardsDue: 0,
    journalEntries: 0,
    coursesTracked: 0,
    coursesProgress: 0,
  });

  useEffect(() => {
    try {
      const cgpaHistory = localStorage.getItem("iesa-cgpa-history");
      const cgpaRecords: SemesterRecord[] = cgpaHistory ? JSON.parse(cgpaHistory) : [];

      const plannerTasks = localStorage.getItem("iesa-planner-tasks");
      const tasks: PlannerTask[] = plannerTasks ? JSON.parse(plannerTasks) : [];
      const completed = tasks.filter((t) => t.completed).length;
      const pending = tasks.filter((t) => !t.completed).length;

      const timerHistory = localStorage.getItem("iesa-timer-history");
      const timerRecords: TimerRecord[] = timerHistory ? JSON.parse(timerHistory) : [];
      const today = new Date().toDateString();
      const todayFocus = timerRecords.filter((r) => r.date === today && r.mode === "focus");
      const focusMinutes = todayFocus.reduce((acc, r) => acc + r.duration, 0);

      const goalsData = localStorage.getItem("iesa-goals");
      const goals: GoalData[] = goalsData ? JSON.parse(goalsData) : [];
      const goalsCompleted = goals.filter((g) => g.completedAt).length;
      const goalsActive = goals.length - goalsCompleted;

      // New tools
      const habitsRaw = localStorage.getItem("iesa-habits-data");
      const habits: HabitData[] = habitsRaw ? JSON.parse(habitsRaw) : [];
      const activeHabits = habits.filter((h) => !h.archived);
      let maxStreak = 0;
      activeHabits.forEach((h) => {
        const todayStr = new Date().toISOString().slice(0, 10);
        let streak = 0;
        const sorted = [...h.completions].sort().reverse();
        for (const d of sorted) {
          const expected = new Date();
          expected.setDate(expected.getDate() - streak);
          if (d === expected.toISOString().slice(0, 10) || d === todayStr) { streak++; } else break;
        }
        if (streak > maxStreak) maxStreak = streak;
      });

      const decksRaw = localStorage.getItem("iesa-flashcards-data");
      const decks: DeckData[] = decksRaw ? JSON.parse(decksRaw) : [];
      const now = new Date().toISOString();
      const dueCards = decks.reduce((acc, d) => acc + d.cards.filter((c) => c.nextReview <= now).length, 0);

      const journalRaw = localStorage.getItem("iesa-journal-entries");
      const journalEntries: JournalEntry[] = journalRaw ? JSON.parse(journalRaw) : [];

      const coursesRaw = localStorage.getItem("iesa-courses-progress");
      const courses: CourseData[] = coursesRaw ? JSON.parse(coursesRaw) : [];
      const totalTopics = courses.reduce((a, c) => a + c.topics.length, 0);
      const completedTopics = courses.reduce((a, c) => a + c.topics.filter((t) => t.completed).length, 0);
      const coursesPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      setStats({
        latestGpa: cgpaRecords.length > 0 ? cgpaRecords[0].gpa : 0,
        totalRecords: cgpaRecords.length,
        tasksCompleted: completed,
        tasksPending: pending,
        goalsActive,
        goalsCompleted,
        focusMinutes,
        focusSessions: todayFocus.length,
        habitsActive: activeHabits.length,
        habitsStreak: maxStreak,
        flashcardDecks: decks.length,
        flashcardsDue: dueCards,
        journalEntries: journalEntries.length,
        coursesTracked: courses.length,
        coursesProgress: coursesPct,
      });
    } catch {
      console.error("Failed to load growth stats");
    }
  }, []);

  const getToolStats = (id: string) => {
    switch (id) {
      case "cgpa":
        return `${stats.totalRecords} records saved`;
      case "planner":
        return `${stats.tasksCompleted} done · ${stats.tasksPending} pending`;
      case "timer":
        return `${stats.focusMinutes} min today · ${stats.focusSessions} sessions`;
      case "goals":
        return stats.goalsActive + stats.goalsCompleted > 0
          ? `${stats.goalsCompleted} done · ${stats.goalsActive} active`
          : "Set and track your goals";
      case "habits":
        return stats.habitsActive > 0
          ? `${stats.habitsActive} habits · ${stats.habitsStreak} day streak`
          : "Build daily routines";
      case "flashcards":
        return stats.flashcardDecks > 0
          ? `${stats.flashcardDecks} decks · ${stats.flashcardsDue} due`
          : "Create your first deck";
      case "journal":
        return stats.journalEntries > 0
          ? `${stats.journalEntries} entries written`
          : "Start reflecting weekly";
      case "courses":
        return stats.coursesTracked > 0
          ? `${stats.coursesTracked} courses · ${stats.coursesProgress}% done`
          : "Track your syllabus";
      case "study-groups":
        return "Find study partners";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Growth Hub" />

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">

        {/* ═══ BENTO HERO ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">
          {/* Title card */}
          <div className="lg:col-span-7 bg-lime border-[5px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[200px] flex flex-col justify-between">
            <div className="absolute -bottom-14 -right-14 w-40 h-40 rounded-full bg-navy/8 pointer-events-none" />
            <svg className="absolute top-8 right-12 w-5 h-5 text-navy/12 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <svg className="absolute bottom-20 right-32 w-3 h-3 text-navy/8 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>

            <div>
              <p className="text-[10px] font-bold text-navy/40 uppercase tracking-[0.15em] mb-2">Personal Development</p>
              <h1 className="font-display font-black text-3xl md:text-4xl text-navy leading-[0.95]">
                Growth Hub
              </h1>
              <p className="text-sm text-navy/50 mt-3 max-w-md">
                Track progress, build habits, and unlock your potential with purpose-built tools.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 mt-5">
              {stats.latestGpa > 0 && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-navy/60 uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-navy" /> GPA: {stats.latestGpa.toFixed(2)}
                </span>
              )}
              {stats.tasksCompleted > 0 && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-navy/60 uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal" /> {stats.tasksCompleted} Tasks Done
                </span>
              )}
              {stats.focusMinutes > 0 && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-navy/60 uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-coral" /> {stats.focusMinutes} min Focus
                </span>
              )}
            </div>
          </div>

          {/* Quick stats cards */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-lavender-light flex items-center justify-center mb-3">
                <svg className="w-4.5 h-4.5 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">GPA</p>
              <p className="font-display font-black text-3xl text-navy">{stats.latestGpa > 0 ? stats.latestGpa.toFixed(2) : "--"}</p>
            </div>

            <div className="bg-teal-light border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-teal/20 flex items-center justify-center mb-3">
                <svg className="w-4.5 h-4.5 text-teal" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Tasks Done</p>
              <p className="font-display font-black text-3xl text-navy">{stats.tasksCompleted}</p>
            </div>

            <div className="bg-coral-light border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-coral/20 flex items-center justify-center mb-3">
                <svg className="w-4.5 h-4.5 text-coral" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152-.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Focus Today</p>
              <p className="font-display font-black text-3xl text-navy">{stats.focusMinutes}<span className="text-base text-slate ml-0.5">m</span></p>
            </div>

            {stats.goalsActive + stats.goalsCompleted > 0 ? (
              <div className="bg-sunny-light border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
                <div className="w-9 h-9 rounded-xl bg-sunny/20 flex items-center justify-center mb-3">
                  <svg className="w-4.5 h-4.5 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                  </svg>
                </div>
                <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Goals Done</p>
                <p className="font-display font-black text-3xl text-navy">{stats.goalsCompleted}<span className="text-base text-slate ml-0.5">/{stats.goalsActive + stats.goalsCompleted}</span></p>
              </div>
            ) : (
              <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
                <div className="w-9 h-9 rounded-xl bg-cloud flex items-center justify-center mb-3">
                  <svg className="w-4.5 h-4.5 text-slate" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                  </svg>
                </div>
                <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Pending</p>
                <p className="font-display font-black text-3xl text-navy">{stats.tasksPending}</p>
              </div>
            )}
          </div>
        </div>

        {/* ═══ GROWTH TOOLS GRID ═══ */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-3 h-8 rounded-full bg-lavender" />
            <h2 className="font-display font-black text-xl text-navy">Growth Tools</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {TOOLS.map((tool, i) => {
              const rotation = i % 3 === 1 ? "rotate-[0.5deg] hover:rotate-0" : i % 3 === 2 ? "rotate-[-0.5deg] hover:rotate-0" : "";
              return (
                <Link
                  key={tool.id}
                  href={tool.href}
                  className={`group bg-snow border-[4px] border-navy rounded-3xl press-4 press-black transition-all overflow-hidden ${rotation}`}
                >
                  <div className={`${tool.color.bg} px-6 py-4 border-b-[4px] border-navy flex items-center justify-between`}>
                    <span className="font-display font-bold text-[10px] text-navy/40 uppercase tracking-[0.15em]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <svg className="w-5 h-5 text-navy/30 group-hover:text-navy group-hover:translate-x-1 transition-all" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>

                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl ${tool.color.icon} border-[3px] border-navy flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                        <span className={tool.color.iconText}>{toolIcons[tool.id]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-black text-lg text-navy mb-1">{tool.title}</h3>
                        <p className="text-sm text-navy/50 mb-3">{tool.desc}</p>
                        <span className="text-[10px] font-bold text-slate uppercase tracking-wider">
                          {getToolStats(tool.id)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ═══ MOTIVATION CARD ═══ */}
        <div className="bg-navy border-[4px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-lime/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-lime" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M15.22 6.268a.75.75 0 01.968-.432l5.942 2.28a.75.75 0 01.431.97l-2.28 5.941a.75.75 0 11-1.4-.537l1.63-4.251-1.086.483a11.2 11.2 0 00-5.45 5.174.75.75 0 01-1.199.19L9 12.31l-6.22 6.22a.75.75 0 11-1.06-1.06l6.75-6.75a.75.75 0 011.06 0l3.606 3.605a12.694 12.694 0 015.68-4.973l1.086-.484-4.251-1.631a.75.75 0 01-.432-.97z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-display font-black text-base text-snow mb-1">Keep Growing!</h3>
              <p className="text-sm text-ghost/50">
                Small consistent steps lead to massive results. Your future self will thank you.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="mt-6 text-center flex items-center justify-center gap-1.5">
          <svg className="w-3 h-3 text-slate" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider">All data stored locally on your device</span>
        </div>
      </div>
    </div>
  );
}
