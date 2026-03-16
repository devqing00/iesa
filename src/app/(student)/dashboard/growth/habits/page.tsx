"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { useGrowthData } from "@/hooks/useGrowthData";
import Link from "next/link";
import { useState, useCallback, ReactNode } from "react";

/* ─── Types ─────────────────────────────────────────────────────── */

interface Habit {
  id: string;
  name: string;
  icon: string;
  color: "lime" | "coral" | "lavender" | "teal" | "sunny";
  frequency: "daily" | "weekdays" | "weekends" | "custom";
  customDays?: number[]; // 0=Sun, 1=Mon, ... 6=Sat
  createdAt: string;
  completions: string[]; // ISO date strings (YYYY-MM-DD)
  archived: boolean;
}

const STORAGE_KEY = "iesa-habits-data";

/* ─── SVG Icon System (replaces emoji) ──────────────────────────── */

const ICON_SVGS: Record<string, ReactNode> = {
  book: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z"/></svg>,
  fitness: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd"/></svg>,
  mindful: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 0 1-.189-.866c0-.298.059-.605.189-.866Zm-4.34 7.244a.75.75 0 0 1-1.061-1.06 5.236 5.236 0 0 1 3.73-1.538 5.236 5.236 0 0 1 3.695 1.538.75.75 0 1 1-1.061 1.06 3.736 3.736 0 0 0-2.634-1.098 3.736 3.736 0 0 0-2.67 1.098Z"/></svg>,
  water: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2.25c-2.429 0-4.817.178-7.152.521C2.87 3.061 1.5 4.795 1.5 6.741v6.018c0 1.946 1.37 3.68 3.348 3.97 1.094.16 2.2.284 3.316.37a4.52 4.52 0 0 0 2.142 3.341l.252.168a.75.75 0 0 0 .884 0l.252-.168a4.52 4.52 0 0 0 2.142-3.341 51.38 51.38 0 0 0 3.316-.37c1.978-.29 3.348-2.024 3.348-3.97V6.741c0-1.946-1.37-3.68-3.348-3.97A49.145 49.145 0 0 0 12 2.25ZM8.25 8.625a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Zm2.625 1.125a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clipRule="evenodd"/></svg>,
  run: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd"/></svg>,
  write: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z"/><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-10.5a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z"/></svg>,
  target: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/></svg>,
  science: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.644 1.59a.75.75 0 0 1 .712 0l9.75 5.25a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.712 0l-9.75-5.25a.75.75 0 0 1 0-1.32l9.75-5.25Z"/><path d="m3.265 10.602 7.668 4.129a2.25 2.25 0 0 0 2.134 0l7.668-4.13 1.37.739a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.71 0l-9.75-5.25a.75.75 0 0 1 0-1.32l1.37-.738Z"/><path d="m10.933 19.231-7.668-4.13-1.37.739a.75.75 0 0 0 0 1.32l9.75 5.25c.221.12.489.12.71 0l9.75-5.25a.75.75 0 0 0 0-1.32l-1.37-.738-7.668 4.13a2.25 2.25 0 0 1-2.134 0Z"/></svg>,
  notes: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd"/><path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z"/></svg>,
  lab: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M10.5 3.798v5.02a3 3 0 0 1-.879 2.121l-2.377 2.377a9.845 9.845 0 0 1 5.091 1.013 8.315 8.315 0 0 0 5.713.636l.285-.071-3.954-3.955A3 3 0 0 1 13.5 8.818v-5.02a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75ZM8.75 1.5a.75.75 0 0 0 0 1.5h.75v5.318a1.5 1.5 0 0 1-.44 1.06L6.19 12.248A10.056 10.056 0 0 0 3 12a.75.75 0 0 0 0 1.5c.027 0 .054.001.08.002 1.093.043 2.143.335 3.08.842.529.286 1.097.524 1.697.706C9.39 18.792 10.654 21 12 21c1.346 0 2.61-2.208 4.143-5.95a9.838 9.838 0 0 0 1.697-.706c.937-.507 1.987-.8 3.08-.842.027-.001.054-.002.08-.002a.75.75 0 0 0 0-1.5c-1.024 0-2.02.166-2.952.469l-.285.071a9.815 9.815 0 0 1-6.768-.753 8.344 8.344 0 0 0-3.045-.881l2.94-2.94A3 3 0 0 0 12 6.818V3h.75a.75.75 0 0 0 0-1.5h-4Z" clipRule="evenodd"/></svg>,
  clock: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd"/></svg>,
  health: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"/></svg>,
};

// Legacy emoji → new key fallback (for existing stored data)
const EMOJI_TO_KEY: Record<string, string> = {
  "📖": "book", "💪": "fitness", "🧘": "mindful", "💧": "water",
  "🏃": "run", "✍️": "write", "🎯": "target", "🔬": "science",
  "📝": "notes", "🧪": "lab", "⏰": "clock", "🍎": "health",
};

const ICON_KEYS = Object.keys(ICON_SVGS);

/** Render an icon — handles both new SVG keys and legacy emojis. */
function HabitIcon({ icon, className = "" }: { icon: string; className?: string }) {
  // Direct SVG key match
  if (ICON_SVGS[icon]) return <span className={className}>{ICON_SVGS[icon]}</span>;
  // Legacy emoji → SVG
  const mapped = EMOJI_TO_KEY[icon];
  if (mapped && ICON_SVGS[mapped]) return <span className={className}>{ICON_SVGS[mapped]}</span>;
  // Ultimate fallback: render the raw string
  return <span className={className}>{icon}</span>;
}

const COLORS: Habit["color"][] = ["lime", "coral", "lavender", "teal", "sunny"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; light: string; dot: string }> = {
  lime: { bg: "bg-lime", border: "border-ghost/20", text: "text-navy", light: "bg-lime-light", dot: "bg-lime" },
  coral: { bg: "bg-coral", border: "border-coral", text: "text-snow", light: "bg-coral-light", dot: "bg-coral" },
  lavender: { bg: "bg-lavender", border: "border-lavender", text: "text-snow", light: "bg-lavender-light", dot: "bg-lavender" },
  teal: { bg: "bg-teal", border: "border-teal", text: "text-navy", light: "bg-teal-light", dot: "bg-teal" },
  sunny: { bg: "bg-sunny", border: "border-sunny", text: "text-navy", light: "bg-sunny-light", dot: "bg-sunny" },
};

/* ─── Helpers ───────────────────────────────────────────────────── */

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getToday(): string {
  return toDateStr(new Date());
}

function getWeekDates(): string[] {
  const today = new Date();
  const day = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateStr(d);
  });
}

function shouldTrackOnDay(habit: Habit, dayOfWeek: number): boolean {
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekdays") return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (habit.frequency === "weekends") return dayOfWeek === 0 || dayOfWeek === 6;
  if (habit.frequency === "custom" && habit.customDays) return habit.customDays.includes(dayOfWeek);
  return true;
}

function getStreak(habit: Habit): number {
  let streak = 0;
  const d = new Date();
  // If today isn't completed, start from yesterday
  if (!habit.completions.includes(toDateStr(d))) {
    d.setDate(d.getDate() - 1);
  }
  while (true) {
    const ds = toDateStr(d);
    const dow = d.getDay();
    if (shouldTrackOnDay(habit, dow)) {
      if (habit.completions.includes(ds)) {
        streak++;
      } else {
        break;
      }
    }
    d.setDate(d.getDate() - 1);
    if (streak > 365) break;
  }
  return streak;
}

function getCompletionRate(habit: Habit, days: number = 30): number {
  const now = new Date();
  let tracked = 0;
  let completed = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    if (shouldTrackOnDay(habit, d.getDay())) {
      tracked++;
      if (habit.completions.includes(toDateStr(d))) completed++;
    }
  }
  return tracked === 0 ? 0 : Math.round((completed / tracked) * 100);
}

function getLast30DaysGrid(habit: Habit): { date: string; completed: boolean; tracked: boolean }[] {
  const now = new Date();
  return Array.from({ length: 35 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (34 - i));
    const ds = toDateStr(d);
    return {
      date: ds,
      completed: habit.completions.includes(ds),
      tracked: shouldTrackOnDay(habit, d.getDay()),
    };
  });
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function HabitTrackerPage() {
  const { showHelp, openHelp, closeHelp } = useToolHelp("habits");
  const [habits, setHabits] = useGrowthData<Habit[]>('habits', STORAGE_KEY, []);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("book");
  const [formColor, setFormColor] = useState<Habit["color"]>("lime");
  const [formFreq, setFormFreq] = useState<Habit["frequency"]>("daily");
  const [formCustomDays, setFormCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const persist = useCallback((data: Habit[]) => {
    setHabits(data);
  }, [setHabits]);

  const resetForm = () => {
    setFormName("");
    setFormIcon("book");
    setFormColor("lime");
    setFormFreq("daily");
    setFormCustomDays([1, 2, 3, 4, 5]);
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = () => {
    if (!formName.trim()) return;
    if (editId) {
      persist(
        habits.map((h) =>
          h.id === editId
            ? { ...h, name: formName.trim(), icon: formIcon, color: formColor, frequency: formFreq, customDays: formFreq === "custom" ? formCustomDays : undefined }
            : h
        )
      );
    } else {
      const newHabit: Habit = {
        id: Date.now().toString(36),
        name: formName.trim(),
        icon: formIcon,
        color: formColor,
        frequency: formFreq,
        customDays: formFreq === "custom" ? formCustomDays : undefined,
        createdAt: new Date().toISOString(),
        completions: [],
        archived: false,
      };
      persist([newHabit, ...habits]);
    }
    resetForm();
  };

  const startEdit = (h: Habit) => {
    setFormName(h.name);
    setFormIcon(h.icon);
    setFormColor(h.color);
    setFormFreq(h.frequency);
    setFormCustomDays(h.customDays || [1, 2, 3, 4, 5]);
    setEditId(h.id);
    setShowForm(true);
  };

  const toggleCompletion = (id: string, date: string) => {
    persist(
      habits.map((h) => {
        if (h.id !== id) return h;
        const has = h.completions.includes(date);
        return {
          ...h,
          completions: has
            ? h.completions.filter((d) => d !== date)
            : [...h.completions, date],
        };
      })
    );
  };

  const toggleArchive = (id: string) => {
    persist(habits.map((h) => (h.id === id ? { ...h, archived: !h.archived } : h)));
  };

  const deleteHabit = (id: string) => {
    if (!confirm("Delete this habit and all its history?")) return;
    persist(habits.filter((h) => h.id !== id));
  };

  const today = getToday();
  const weekDates = getWeekDates();
  const activeHabits = habits.filter((h) => !h.archived);
  const archivedHabits = habits.filter((h) => h.archived);
  const todayDow = new Date().getDay();

  // Stats
  const todayHabits = activeHabits.filter((h) => shouldTrackOnDay(h, todayDow));
  const todayDone = todayHabits.filter((h) => h.completions.includes(today)).length;
  const todayTotal = todayHabits.length;
  const bestStreak = activeHabits.reduce((max, h) => Math.max(max, getStreak(h)), 0);

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Habit Tracker" />
      <ToolHelpModal toolId="habits" isOpen={showHelp} onClose={closeHelp} />

      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8 max-w-4xl mx-auto">
        {/* Back link + Help */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dashboard/growth"
            className="group inline-flex items-center gap-2 text-sm font-bold text-slate hover:text-navy transition-colors"
          >
            <svg aria-hidden="true" className="w-4 h-4 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
            Back to Growth Hub
          </Link>
          <HelpButton onClick={openHelp} />
        </div>

        {/* ═══ BENTO HERO ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          {/* Title card */}
          <div className="md:col-span-7 bg-teal border-[3px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[180px] flex flex-col justify-between">
            <div className="absolute -bottom-14 -right-14 w-40 h-40 rounded-full bg-navy/8 pointer-events-none" />
            <svg aria-hidden="true" className="absolute top-6 right-10 w-5 h-5 text-navy/12 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <div>
              <p className="text-[10px] font-bold text-navy/40 uppercase tracking-[0.15em] mb-2">Build Consistency</p>
              <h1 className="font-display font-black text-3xl md:text-4xl text-navy leading-[0.95]">
                Habit Tracker
              </h1>
              <p className="text-sm text-navy/50 mt-3 max-w-md">
                Track daily habits, build streaks, and transform your routine into results.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="md:col-span-5 grid grid-cols-2 gap-3">
            <div className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Today</p>
              <p className="font-display font-black text-3xl text-navy mt-2">
                {todayDone}<span className="text-base text-slate">/{todayTotal}</span>
              </p>
            </div>
            <div className="bg-sunny-light border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Best Streak</p>
              <p className="font-display font-black text-3xl text-navy mt-2">
                {bestStreak}<span className="text-base text-slate ml-0.5">d</span>
              </p>
            </div>
            <div className="bg-teal-light border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] rotate-[-0.3deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Active</p>
              <p className="font-display font-black text-3xl text-navy mt-2">{activeHabits.length}</p>
            </div>
            <div className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Completion</p>
              <p className="font-display font-black text-3xl text-navy mt-2">
                {todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0}<span className="text-base text-slate">%</span>
              </p>
            </div>
          </div>
        </div>

        {/* ═══ TODAY'S CHECK-IN ═══ */}
        {todayHabits.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-display font-black text-xl text-navy">Today&apos;s Check-In</h2>
              <span className="ml-auto text-xs font-bold text-slate uppercase tracking-wider">
                {todayDone}/{todayTotal} done
              </span>
            </div>

            {/* Progress bar */}
            <div className="bg-cloud rounded-full h-3 mb-4 border-[2px] border-navy/10 overflow-hidden">
              <div
                className="h-full bg-teal rounded-full transition-all duration-500"
                style={{ width: `${todayTotal > 0 ? (todayDone / todayTotal) * 100 : 0}%` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {todayHabits.map((habit) => {
                const done = habit.completions.includes(today);
                const c = COLOR_MAP[habit.color];
                const streak = getStreak(habit);
                return (
                  <button
                    key={habit.id}
                    onClick={() => toggleCompletion(habit.id, today)}
                    className={`group flex items-center gap-4 p-4 rounded-2xl border-[3px] transition-all text-left ${
 done
 ?`${c.light} border-navy press-3 press-black`
 :"bg-snow border-navy/20 hover:border-navy"
 }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all ${
                      done ? `${c.bg} border-[3px] border-navy scale-110` : "bg-ghost border-[3px] border-navy/20"
                    }`}>
                      {done ? (
                        <svg aria-hidden="true" className="w-6 h-6 text-navy" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <HabitIcon icon={habit.icon} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-display font-bold text-sm ${done ? "text-navy line-through" : "text-navy"}`}>
                        {habit.name}
                      </p>
                      <p className="text-[10px] font-bold text-slate uppercase tracking-wider mt-0.5">
                        {streak > 0 ? `${streak} day streak` : "Start your streak!"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ WEEK VIEW ═══ */}
        {activeHabits.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-display font-black text-xl text-navy">This Week</h2>
            </div>

            <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] overflow-hidden">
              {/* Day headers */}
              <div className="grid border-b-[3px] border-navy" style={{ gridTemplateColumns: "1fr repeat(7, 48px)" }}>
                <div className="px-4 py-3" />
                {weekDates.map((date, i) => {
                  const isToday = date === today;
                  return (
                    <div key={date} className={`flex flex-col items-center justify-center py-3 ${isToday ? "bg-lime-light" : ""}`}>
                      <span className="text-[10px] font-bold text-slate uppercase">{DAY_LABELS_SHORT[i]}</span>
                      <span className={`text-xs font-display font-black mt-0.5 ${isToday ? "text-navy" : "text-navy/40"}`}>
                        {new Date(date + "T12:00:00").getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Habit rows */}
              {activeHabits.map((habit) => {
                const c = COLOR_MAP[habit.color];
                return (
                  <div key={habit.id} className="grid border-b-[2px] border-cloud last:border-b-0" style={{ gridTemplateColumns: "1fr repeat(7, 48px)" }}>
                    <div className="flex items-center gap-2 px-4 py-3">
                      <span className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
                      <span className="text-sm font-bold text-navy truncate">{habit.name}</span>
                    </div>
                    {weekDates.map((date, i) => {
                      const tracked = shouldTrackOnDay(habit, i);
                      const completed = habit.completions.includes(date);
                      const isToday = date === today;
                      const isPast = date < today;
                      return (
                        <button
                          key={date}
                          disabled={!tracked}
                          onClick={() => toggleCompletion(habit.id, date)}
                          className={`flex items-center justify-center py-3 transition-all ${isToday ? "bg-lime-light/50" : ""}`}
                        >
                          {!tracked ? (
                            <span className="w-6 h-6 rounded-lg bg-cloud/50" />
                          ) : completed ? (
                            <span className={`w-6 h-6 rounded-lg ${c.bg} border-[2px] border-navy flex items-center justify-center`}>
                              <svg aria-hidden="true" className="w-3.5 h-3.5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                              </svg>
                            </span>
                          ) : isPast ? (
                            <span className="w-6 h-6 rounded-lg border-[2px] border-coral/30 flex items-center justify-center">
                              <svg aria-hidden="true" className="w-3 h-3 text-coral/40" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                              </svg>
                            </span>
                          ) : (
                            <span className="w-6 h-6 rounded-lg border-[2px] border-navy/15 hover:border-navy/40 transition-colors" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ HABIT CARDS (with stats + heatmap) ═══ */}
        {activeHabits.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="font-display font-black text-xl text-navy">Your Habits</h2>
              </div>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="bg-lime border-[3px] border-navy press-3 press-navy px-4 py-2 rounded-xl font-display font-bold text-sm text-navy transition-all"
              >
                + New Habit
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeHabits.map((habit) => {
                const c = COLOR_MAP[habit.color];
                const streak = getStreak(habit);
                const rate = getCompletionRate(habit);
                const grid = getLast30DaysGrid(habit);
                return (
                  <div key={habit.id} className="bg-snow border-[3px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] overflow-hidden">
                    {/* Header */}
                    <div className={`${c.light} border-b-[3px] border-navy px-5 py-4 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <HabitIcon icon={habit.icon} className="text-xl" />
                        <div>
                          <h3 className="font-display font-black text-base text-navy">{habit.name}</h3>
                          <p className="text-[10px] font-bold text-navy/40 uppercase tracking-wider">{habit.frequency}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(habit)} className="w-8 h-8 rounded-lg bg-snow/60 hover:bg-snow flex items-center justify-center transition-colors">
                          <svg aria-hidden="true" className="w-3.5 h-3.5 text-navy/50" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                          </svg>
                        </button>
                        <button onClick={() => toggleArchive(habit.id)} className="w-8 h-8 rounded-lg bg-snow/60 hover:bg-snow flex items-center justify-center transition-colors">
                          <svg aria-hidden="true" className="w-3.5 h-3.5 text-navy/50" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM20.57 16.476c-.223.082-.448.161-.674.238L7.319 4.137A6.75 6.75 0 0 1 18.75 9v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206Z" />
                            <path d="M13.73 21.474a.75.75 0 1 1-1.46 0 3.75 3.75 0 0 0-3.479-3.098l2.09 2.09a3.754 3.754 0 0 0 2.849 1.008Z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="px-5 py-4">
                      <div className="flex gap-4 mb-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate uppercase tracking-wider">Streak</p>
                          <p className="font-display font-black text-2xl text-navy">{streak}<span className="text-sm text-slate ml-0.5">d</span></p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate uppercase tracking-wider">30d Rate</p>
                          <p className="font-display font-black text-2xl text-navy">{rate}<span className="text-sm text-slate">%</span></p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate uppercase tracking-wider">Total</p>
                          <p className="font-display font-black text-2xl text-navy">{habit.completions.length}</p>
                        </div>
                      </div>

                      {/* Mini heatmap */}
                      <div className="grid grid-cols-7 gap-1">
                        {grid.map((cell) => (
                          <div
                            key={cell.date}
                            title={`${cell.date}${cell.completed ? " ✓" : cell.tracked ? " ✗" : " —"}`}
                            className={`w-full aspect-square rounded-sm ${
                              !cell.tracked ? "bg-cloud/30" : cell.completed ? c.bg : "bg-cloud"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[9px] text-slate mt-1 text-right">Last 5 weeks</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ ADD / EDIT FORM ═══ */}
        {showForm && (
          <div className="fixed inset-0 bg-navy/40 z-[70] flex items-center justify-center px-4 py-4 sm:p-6" onClick={() => resetForm()}>
            <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="border-b-[3px] border-navy px-6 py-4 flex items-center justify-between bg-ghost rounded-t-[1.25rem]">
                <h3 className="font-display font-black text-lg text-navy">
                  {editId ? "Edit Habit" : "New Habit"}
                </h3>
                <button onClick={resetForm} className="text-slate hover:text-navy">
                  <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                {/* Name */}
                <div>
                  <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Habit Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Read 30 minutes"
                    className="w-full bg-snow border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy font-medium focus:border-teal focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>

                {/* Icon */}
                <div>
                  <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => setFormIcon(key)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          formIcon === key ? "bg-lime border-[3px] border-navy scale-110" : "bg-ghost border-[2px] border-navy/10 hover:border-navy/30"
                        }`}
                      >
                        <HabitIcon icon={key} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div>
                  <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Color</label>
                  <div className="flex gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormColor(color)}
                        className={`w-10 h-10 rounded-xl ${COLOR_MAP[color].bg} border-[3px] transition-all ${
                          formColor === color ? "border-navy scale-110" : "border-transparent hover:border-navy/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Frequency</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["daily", "weekdays", "weekends", "custom"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormFreq(f)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border-[3px] transition-all ${
                          formFreq === f
                            ? "bg-navy text-snow border-lime"
                            : "bg-snow text-navy border-navy/15 hover:border-navy"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom days */}
                {formFreq === "custom" && (
                  <div>
                    <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Select Days</label>
                    <div className="flex gap-1">
                      {DAY_LABELS.map((day, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setFormCustomDays((prev) =>
                              prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]
                            );
                          }}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-[3px] transition-all ${
                            formCustomDays.includes(i)
                              ? "bg-teal text-navy border-navy"
                              : "bg-snow text-slate border-navy/15 hover:border-navy"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save button */}
                <button
                  onClick={handleSave}
                  disabled={!formName.trim()}
                  className="w-full bg-lime border-[3px] border-navy press-3 press-navy px-6 py-3.5 rounded-2xl font-display font-black text-base text-navy transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {editId ? "Update Habit" : "Create Habit"}
                </button>

                {/* Delete (edit mode) */}
                {editId && (
                  <button
                    onClick={() => { deleteHabit(editId); resetForm(); }}
                    className="w-full text-coral text-sm font-bold hover:underline"
                  >
                    Delete this habit
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ EMPTY STATE ═══ */}
        {activeHabits.length === 0 && !showForm && (
          <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-light flex items-center justify-center">
              <svg aria-hidden="true" className="w-8 h-8 text-teal" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-display font-black text-xl text-navy mb-2">Start Building Habits</h3>
            <p className="text-sm text-slate mb-6 max-w-sm mx-auto">
              Create your first habit and begin tracking your consistency.
            </p>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="bg-lime border-[3px] border-navy press-3 press-navy px-8 py-3.5 rounded-2xl font-display font-black text-base text-navy transition-all"
            >
              Create Your First Habit
            </button>
          </div>
        )}

        {/* ═══ ARCHIVED ═══ */}
        {archivedHabits.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-sm font-bold text-slate hover:text-navy transition-colors mb-3"
            >
              <svg aria-hidden="true" className={`w-4 h-4 transition-transform ${showArchived ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
              </svg>
              Archived ({archivedHabits.length})
            </button>
            {showArchived && (
              <div className="space-y-2">
                {archivedHabits.map((h) => (
                  <div key={h.id} className="flex items-center justify-between bg-cloud/50 border-[2px] border-navy/10 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span>{h.icon}</span>
                      <span className="text-sm font-bold text-slate">{h.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleArchive(h.id)} className="text-[10px] font-bold text-teal hover:underline uppercase tracking-wider">
                        Restore
                      </button>
                      <button onClick={() => deleteHabit(h.id)} className="text-[10px] font-bold text-coral hover:underline uppercase tracking-wider">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Privacy */}
        <div className="mt-8 text-center flex items-center justify-center gap-1.5">
          <svg aria-hidden="true" className="w-3 h-3 text-teal" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M4.5 9.75a6 6 0 0111.573-2.226 3.75 3.75 0 014.133 4.303A4.5 4.5 0 0118 20.25H6.75a5.25 5.25 0 01-.75-10.5z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] font-bold text-teal uppercase tracking-wider">Synced to your account</span>
        </div>
      </div>
    </div>
  );
}
