"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

/* ─── Help content definitions per tool ──────────────── */
export interface ToolHelpContent {
  toolId: string;
  title: string;
  subtitle: string;
  accentColor: string; // bg color class
  steps: { icon: string; title: string; desc: string }[];
  tips?: string[];
}

export const TOOL_HELP: Record<string, ToolHelpContent> = {
  cgpa: {
    toolId: "cgpa",
    title: "CGPA Calculator",
    subtitle: "Calculate your cumulative GPA semester by semester",
    accentColor: "bg-teal",
    steps: [
      { icon: "⚙", title: "Choose Grading System", desc: "Select 5-point (Nigerian) or 4-point (US) scale" },
      { icon: "📝", title: "Add Your Courses", desc: "Enter course names, credit units, and select your grade for each" },
      { icon: "📊", title: "Previous Record (Optional)", desc: "Enter your previous CGPA and total credits to calculate cumulative" },
      { icon: "🎯", title: "Set a Target", desc: "Set a target CGPA to track your progress toward your goal" },
      { icon: "💾", title: "Save to History", desc: "Save your semester result to track your progress over time" },
    ],
    tips: [
      "All data is stored locally on your device — private and secure",
      "Your history is limited to 20 records. Oldest records are removed first",
      "Switch grading systems anytime — grades will reset to 'A' as a starting point",
    ],
  },
  timer: {
    toolId: "timer",
    title: "Pomodoro Timer",
    subtitle: "Focus with timed study sessions and structured breaks",
    accentColor: "bg-coral",
    steps: [
      { icon: "⏰", title: "Set Durations", desc: "Customize focus, short break, and long break lengths" },
      { icon: "▶", title: "Start Focusing", desc: "Hit play to start a focus session — stay off distractions!" },
      { icon: "☕", title: "Take Breaks", desc: "Short breaks after each session, long break after every 4" },
      { icon: "📈", title: "Track Sessions", desc: "Your completed focus sessions are logged automatically" },
    ],
    tips: [
      "A standard Pomodoro is 25 min focus + 5 min break",
      "Toggle sound to get notified when a session ends",
      "Sessions save to your history so you can review your study patterns",
    ],
  },
  habits: {
    toolId: "habits",
    title: "Habit Tracker",
    subtitle: "Build positive routines with daily habit tracking",
    accentColor: "bg-lavender",
    steps: [
      { icon: "➕", title: "Create a Habit", desc: "Name it, pick a color and icon, and set how often (daily, weekdays, custom)" },
      { icon: "✓", title: "Check Off Daily", desc: "Tap a habit to mark it complete for today" },
      { icon: "🔥", title: "Build Streaks", desc: "Consecutive days form streaks — don't break the chain!" },
      { icon: "📅", title: "Review Progress", desc: "See your completion history and consistency over time" },
    ],
    tips: [
      "Start small — 2-3 habits is easier to maintain than 10",
      "Use custom frequency for habits that happen on specific days",
    ],
  },
  "study-groups": {
    toolId: "study-groups",
    title: "Study Groups",
    subtitle: "Find and organize study sessions with classmates",
    accentColor: "bg-teal",
    steps: [
      { icon: "🔍", title: "Browse Groups", desc: "See existing study groups for your courses" },
      { icon: "➕", title: "Create a Group", desc: "Start a new group with a course code, description, and schedule" },
      { icon: "🤝", title: "Join Groups", desc: "Join groups to connect with other students in your course" },
      { icon: "📍", title: "Set Meetings", desc: "Add meeting times and locations so everyone stays in sync" },
    ],
    tips: [
      "This tool syncs with the server — your groups are visible to others",
      "Add clear meeting schedules so members know when and where to show up",
    ],
  },
  goals: {
    toolId: "goals",
    title: "Goal Tracker",
    subtitle: "Set academic and personal goals with milestones",
    accentColor: "bg-sunny",
    steps: [
      { icon: "🎯", title: "Create a Goal", desc: "Set a clear title, category (academic, career, personal, skill), and priority" },
      { icon: "🪜", title: "Add Milestones", desc: "Break your goal into smaller, checkable milestones" },
      { icon: "📅", title: "Set Deadlines", desc: "Add an optional deadline to stay accountable" },
      { icon: "✓", title: "Track Progress", desc: "Check off milestones as you complete them" },
    ],
    tips: [
      "Use milestones to break large goals into actionable steps",
      "Review and update goals regularly — priorities change!",
    ],
  },
  journal: {
    toolId: "journal",
    title: "Weekly Journal",
    subtitle: "Reflect on your week with structured prompts",
    accentColor: "bg-lavender",
    steps: [
      { icon: "📖", title: "Start a New Entry", desc: "Create a journal entry for the current week" },
      { icon: "✨", title: "What Went Well", desc: "Note your wins and positive moments" },
      { icon: "📈", title: "Areas to Improve", desc: "Identify what you can do better next week" },
      { icon: "🎯", title: "Next Week's Focus", desc: "Set intentions for the upcoming week" },
      { icon: "🙏", title: "Gratitude", desc: "Write something you're grateful for" },
    ],
    tips: [
      "Journal at the end of each week for the best reflection",
      "Be honest — this is private and stored only on your device",
      "Rate your mood each week to spot patterns over time",
    ],
  },
  planner: {
    toolId: "planner",
    title: "Task Planner",
    subtitle: "Organize your assignments, projects, and to-dos",
    accentColor: "bg-lime",
    steps: [
      { icon: "➕", title: "Create a Task", desc: "Add a title, category (study, assignment, exam, etc.), and priority" },
      { icon: "📅", title: "Set Due Dates", desc: "Add deadlines to keep track of when things are due" },
      { icon: "✓", title: "Mark Complete", desc: "Check off tasks as you finish them" },
      { icon: "🗂", title: "Filter & Organize", desc: "Filter by category, priority, or status" },
    ],
    tips: [
      "Use categories to separate coursework from personal tasks",
      "Tackle high-priority tasks first thing in the day",
    ],
  },
  courses: {
    toolId: "courses",
    title: "Course Progress",
    subtitle: "Track topic-by-topic progress through your courses",
    accentColor: "bg-teal",
    steps: [
      { icon: "📚", title: "Add a Course", desc: "Enter the course code, name, and credit units" },
      { icon: "📋", title: "List Topics", desc: "Add all topics or chapters covered in the course" },
      { icon: "✓", title: "Check Topics Off", desc: "Mark topics as done when you've studied them" },
      { icon: "📊", title: "See Progress", desc: "View your completion percentage for each course" },
    ],
    tips: [
      "Add topics from your course outline at the start of the semester",
      "Different colors help you visually distinguish courses at a glance",
    ],
  },
  flashcards: {
    toolId: "flashcards",
    title: "Flashcards (SM-2)",
    subtitle: "Study with spaced repetition for long-term retention",
    accentColor: "bg-sunny",
    steps: [
      { icon: "📦", title: "Create a Deck", desc: "Organize flashcards by subject or topic" },
      { icon: "➕", title: "Add Cards", desc: "Write a question on the front and answer on the back" },
      { icon: "🧠", title: "Study Mode", desc: "Cards appear based on the SM-2 spaced repetition schedule" },
      { icon: "⭐", title: "Rate Recall", desc: "After each card, rate how well you remembered (0-5)" },
    ],
    tips: [
      "SM-2 spaces out reviews — cards you know well appear less often",
      "Study a little every day rather than cramming before exams",
      "Keep cards simple — one concept per card works best",
    ],
  },
};

/* ─── Help trigger button ─────────────────────────────── */
export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-xl bg-snow border-[3px] border-navy/20 flex items-center justify-center text-slate hover:text-navy hover:border-navy hover:bg-ghost transition-all"
      aria-label="How to use this tool"
      title="How to use"
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 01-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 01-.837.552c-.676.37-1.028.768-1.028 1.152a.75.75 0 01-1.5 0c0-1.064.852-1.808 1.41-2.113.248-.135.51-.318.674-.49.486-.425.486-1.39 0-1.814zM12 17.25a.75.75 0 100 1.5.75.75 0 000-1.5z" clipRule="evenodd" />
      </svg>
    </button>
  );
}

/* ─── Help modal component ────────────────────────────── */
interface ToolHelpModalProps {
  toolId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ToolHelpModal({ toolId, isOpen, onClose }: ToolHelpModalProps) {
  const content = TOOL_HELP[toolId];
  if (!content || !isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-4 pb-20 md:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm animate-fade-in" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg bg-snow border-[4px] border-navy rounded-3xl shadow-[3px_3px_0_0_#000] max-h-[80vh] md:max-h-[85vh] overflow-hidden flex flex-col animate-scale-in"
      >
        {/* Header */}
        <div className={`${content.accentColor} p-6 pb-5 border-b-[3px] border-navy`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40 mb-1">
                How to Use
              </div>
              <h2 className="font-display font-black text-xl text-navy">{content.title}</h2>
              <p className="font-display font-normal text-sm text-navy/60 mt-1">{content.subtitle}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-snow/60 flex items-center justify-center text-navy/50 hover:text-navy hover:bg-snow transition-all shrink-0 mt-0.5"
              aria-label="Close help"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {content.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-ghost border-[2px] border-navy/10 rounded-2xl">
              <div className="w-8 h-8 rounded-xl bg-snow border-[2px] border-navy/15 flex items-center justify-center text-base shrink-0">
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy/30">Step {i + 1}</span>
                </div>
                <h4 className="font-display font-bold text-sm text-navy">{step.title}</h4>
                <p className="text-xs text-navy/50 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}

          {/* Tips */}
          {content.tips && content.tips.length > 0 && (
            <div className="mt-4 pt-4 border-t-[2px] border-navy/10">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40 mb-3 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 .75a8.25 8.25 0 00-4.135 15.39c.686.398 1.115 1.008 1.134 1.623a.75.75 0 00.577.706c.352.083.71.148 1.074.195.323.041.6-.218.6-.544v-4.661a6.714 6.714 0 01-.937-.171.75.75 0 11.374-1.453 5.261 5.261 0 002.626 0 .75.75 0 11.374 1.452 6.712 6.712 0 01-.937.172v4.66c0 .327.277.586.6.545.364-.047.722-.112 1.074-.195a.75.75 0 00.577-.706c.02-.615.448-1.225 1.134-1.623A8.25 8.25 0 0012 .75z" />
                  <path fillRule="evenodd" d="M9.013 19.9a.75.75 0 01.877-.597 11.319 11.319 0 004.22 0 .75.75 0 11.28 1.473 12.819 12.819 0 01-4.78 0 .75.75 0 01-.597-.876zM9.754 22.344a.75.75 0 01.824-.668 13.682 13.682 0 002.844 0 .75.75 0 11.156 1.492 15.156 15.156 0 01-3.156 0 .75.75 0 01-.668-.824z" clipRule="evenodd" />
                </svg>
                Tips
              </div>
              <div className="space-y-2">
                {content.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-navy/60">
                    <svg className="w-3 h-3 text-teal mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                    </svg>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t-[3px] border-navy/10">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-lime text-navy border-[3px] border-navy press-3 press-navy font-display font-bold text-sm transition-all"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof window !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return null;
}

/* ─── Hook for first-time help ────────────────────────── */
export function useToolHelp(toolId: string) {
  const [showHelp, setShowHelp] = useState(false);
  const storageKey = `iesa-help-seen-${toolId}`;

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        // Show help after a short delay for first-time visitors
        const timeout = setTimeout(() => setShowHelp(true), 600);
        return () => clearTimeout(timeout);
      }
    } catch {
      // localStorage not available
    }
  }, [storageKey]);

  const openHelp = () => setShowHelp(true);

  const closeHelp = () => {
    setShowHelp(false);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // localStorage not available
    }
  };

  return { showHelp, openHelp, closeHelp };
}
