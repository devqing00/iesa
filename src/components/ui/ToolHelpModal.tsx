"use client";

import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* ─── Step icon SVGs (stroke-based, 24×24 viewBox) ──── */
const STEP_ICONS: Record<string, ReactNode> = {
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 1v3m0 16v3m11-11h-3M4 12H1m17.36-7.36l-2.12 2.12M6.76 17.24l-2.12 2.12m0-14.72l2.12 2.12m10.48 10.48l2.12 2.12" /></>,
  pencil: <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />,
  chart: <path d="M3 20h18M5 20V10m4 10V4m4 16v-8m4 8V8" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  save: <path d="M19 14v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4m7-8v12m0-12L8 10m4-4l4 4" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  play: <path d="M6.5 4.5v15l12-7.5z" />,
  pause: <path d="M10 5v14M14 5v14" />,
  trending: <path d="M3 17l6-6 4 4 8-8m0 0h-6m6 0v6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 13l4 4L19 7" />,
  fire: <path d="M17.66 11.2C17.43 10.9 14 7 12 5c-2 2-5.43 5.9-5.66 6.2C5.14 12.7 4 14.4 4 16.5 4 20.08 7.58 23 12 23s8-2.92 8-6.5c0-2.1-1.14-3.8-2.34-5.3z" />,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></>,
  users: <path d="M17 20c0-2.76-2.24-4-5-4s-5 1.24-5 4m5-7a3 3 0 100-6 3 3 0 000 6zm7.5 7c0-1.38-1.12-2.5-2.5-2.5m0-4a2 2 0 100-4M2 20c0-1.38 1.12-2.5 2.5-2.5m0-4a2 2 0 110-4" />,
  pin: <><path d="M12 21c-4-4-7-7.5-7-11a7 7 0 0114 0c0 3.5-3 7-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  book: <path d="M12 6.5a8.5 8.5 0 00-6-2.5C4.5 4 3 4.5 3 4.5v14s1.5-.5 3-.5a8.5 8.5 0 016 2.5m0-14.5a8.5 8.5 0 016-2.5c1.5 0 3 .5 3 .5v14s-1.5-.5-3-.5a8.5 8.5 0 00-6 2.5m0-14.5v14.5" />,
  sparkle: <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />,
  heart: <path d="M12 21s-9-5.5-9-12a5.5 5.5 0 0110-3 5.5 5.5 0 0110 3c0 6.5-9 12-9 12z" />,
  filter: <path d="M3 4h18l-7 8v5l-4 2V12z" />,
  cube: <path d="M21 16V8l-9-5-9 5v8l9 5zm-9-3l8.7-5M3.3 8L12 13m0 0v9.5" />,
  bulb: <><path d="M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z" /><path d="M9 21h6" /></>,
  star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />,
};

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
      { icon: "gear", title: "Choose Grading System", desc: "Select 5-point (Nigerian) or 4-point (US) scale" },
      { icon: "pencil", title: "Add Your Courses", desc: "Enter course names, credit units, and select your grade for each" },
      { icon: "chart", title: "Previous Record (Optional)", desc: "Enter your previous CGPA and total credits to calculate cumulative" },
      { icon: "target", title: "Set a Target", desc: "Set a target CGPA to track your progress toward your goal" },
      { icon: "save", title: "Save to History", desc: "Save your semester result to track your progress over time" },
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
      { icon: "clock", title: "Set Durations", desc: "Customize focus, short break, and long break lengths" },
      { icon: "play", title: "Start Focusing", desc: "Hit play to start a focus session — stay off distractions!" },
      { icon: "pause", title: "Take Breaks", desc: "Short breaks after each session, long break after every 4" },
      { icon: "trending", title: "Track Sessions", desc: "Your completed focus sessions are logged automatically" },
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
      { icon: "plus", title: "Create a Habit", desc: "Name it, pick a color and icon, and set how often (daily, weekdays, custom)" },
      { icon: "check", title: "Check Off Daily", desc: "Tap a habit to mark it complete for today" },
      { icon: "fire", title: "Build Streaks", desc: "Consecutive days form streaks — don't break the chain!" },
      { icon: "calendar", title: "Review Progress", desc: "See your completion history and consistency over time" },
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
      { icon: "search", title: "Browse Groups", desc: "See existing study groups for your courses" },
      { icon: "plus", title: "Create a Group", desc: "Start a new group with a course code, description, and schedule" },
      { icon: "users", title: "Join Groups", desc: "Join groups to connect with other students in your course" },
      { icon: "pin", title: "Set Meetings", desc: "Add meeting times and locations so everyone stays in sync" },
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
      { icon: "target", title: "Create a Goal", desc: "Set a clear title, category (academic, career, personal, skill), and priority" },
      { icon: "list", title: "Add Milestones", desc: "Break your goal into smaller, checkable milestones" },
      { icon: "calendar", title: "Set Deadlines", desc: "Add an optional deadline to stay accountable" },
      { icon: "check", title: "Track Progress", desc: "Check off milestones as you complete them" },
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
      { icon: "book", title: "Start a New Entry", desc: "Create a journal entry for the current week" },
      { icon: "sparkle", title: "What Went Well", desc: "Note your wins and positive moments" },
      { icon: "trending", title: "Areas to Improve", desc: "Identify what you can do better next week" },
      { icon: "target", title: "Next Week's Focus", desc: "Set intentions for the upcoming week" },
      { icon: "heart", title: "Gratitude", desc: "Write something you're grateful for" },
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
      { icon: "plus", title: "Create a Task", desc: "Add a title, category (study, assignment, exam, etc.), and priority" },
      { icon: "calendar", title: "Set Due Dates", desc: "Add deadlines to keep track of when things are due" },
      { icon: "check", title: "Mark Complete", desc: "Check off tasks as you finish them" },
      { icon: "filter", title: "Filter & Organize", desc: "Filter by category, priority, or status" },
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
      { icon: "book", title: "Add a Course", desc: "Enter the course code, name, and credit units" },
      { icon: "list", title: "List Topics", desc: "Add all topics or chapters covered in the course" },
      { icon: "check", title: "Check Topics Off", desc: "Mark topics as done when you've studied them" },
      { icon: "chart", title: "See Progress", desc: "View your completion percentage for each course" },
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
      { icon: "cube", title: "Create a Deck", desc: "Organize flashcards by subject or topic" },
      { icon: "plus", title: "Add Cards", desc: "Write a question on the front and answer on the back" },
      { icon: "bulb", title: "Study Mode", desc: "Cards appear based on the SM-2 spaced repetition schedule" },
      { icon: "star", title: "Rate Recall", desc: "After each card, rate how well you remembered (0-5)" },
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
        className="relative w-full max-w-lg bg-snow border-[3px] border-navy rounded-3xl shadow-[3px_3px_0_0_#000] max-h-[80vh] md:max-h-[85vh] overflow-hidden flex flex-col animate-scale-in"
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
              <div className="w-8 h-8 rounded-xl bg-snow border-[2px] border-navy/15 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-navy/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {STEP_ICONS[step.icon] ?? <circle cx="12" cy="12" r="4" />}
                </svg>
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
