"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

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
const ICONS = ["📖", "💪", "🧘", "💧", "🏃", "✍️", "🎯", "🔬", "📝", "🧪", "⏰", "🍎"];
const COLORS: Habit["color"][] = ["lime", "coral", "lavender", "teal", "sunny"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; light: string; dot: string }> = {
  lime: { bg: "bg-lime", border: "border-lime", text: "text-navy", light: "bg-lime-light", dot: "bg-lime" },
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
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("📖");
  const [formColor, setFormColor] = useState<Habit["color"]>("lime");
  const [formFreq, setFormFreq] = useState<Habit["frequency"]>("daily");
  const [formCustomDays, setFormCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHabits(JSON.parse(saved));
    } catch {
      console.error("Failed to load habits");
    }
  }, []);

  // Save to localStorage
  const persist = useCallback((data: Habit[]) => {
    setHabits(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormIcon("📖");
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
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
            Back to Growth Hub
          </Link>
          <HelpButton onClick={openHelp} />
        </div>

        {/* ═══ BENTO HERO ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          {/* Title card */}
          <div className="md:col-span-7 bg-teal border-[5px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[180px] flex flex-col justify-between">
            <div className="absolute -bottom-14 -right-14 w-40 h-40 rounded-full bg-navy/8 pointer-events-none" />
            <svg className="absolute top-6 right-10 w-5 h-5 text-navy/12 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
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
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Today</p>
              <p className="font-display font-black text-3xl text-navy mt-2">
                {todayDone}<span className="text-base text-slate">/{todayTotal}</span>
              </p>
            </div>
            <div className="bg-sunny-light border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Best Streak</p>
              <p className="font-display font-black text-3xl text-navy mt-2">
                {bestStreak}<span className="text-base text-slate ml-0.5">d</span>
              </p>
            </div>
            <div className="bg-teal-light border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] rotate-[-0.3deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Active</p>
              <p className="font-display font-black text-3xl text-navy mt-2">{activeHabits.length}</p>
            </div>
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] flex flex-col justify-between">
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
              <div className="w-3 h-8 rounded-full bg-teal" />
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
                        ? `${c.light} border-navy shadow-[4px_4px_0_0_#000]`
                        : "bg-snow border-navy/20 hover:border-navy hover:shadow-[4px_4px_0_0_#000]"
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all ${
                      done ? `${c.bg} border-[3px] border-navy scale-110` : "bg-ghost border-[3px] border-navy/20"
                    }`}>
                      {done ? (
                        <svg className="w-6 h-6 text-navy" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span>{habit.icon}</span>
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
              <div className="w-3 h-8 rounded-full bg-lavender" />
              <h2 className="font-display font-black text-xl text-navy">This Week</h2>
            </div>

            <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[6px_6px_0_0_#000] overflow-hidden">
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
                              <svg className="w-3.5 h-3.5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                              </svg>
                            </span>
                          ) : isPast ? (
                            <span className="w-6 h-6 rounded-lg border-[2px] border-coral/30 flex items-center justify-center">
                              <svg className="w-3 h-3 text-coral/40" viewBox="0 0 24 24" fill="currentColor">
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
                <div className="w-3 h-8 rounded-full bg-coral" />
                <h2 className="font-display font-black text-xl text-navy">Your Habits</h2>
              </div>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="bg-lime border-[3px] border-navy shadow-[4px_4px_0_0_#0F0F2D] px-4 py-2 rounded-xl font-display font-bold text-sm text-navy hover:shadow-[6px_6px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
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
                  <div key={habit.id} className="bg-snow border-[4px] border-navy rounded-3xl shadow-[6px_6px_0_0_#000] overflow-hidden">
                    {/* Header */}
                    <div className={`${c.light} border-b-[3px] border-navy px-5 py-4 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{habit.icon}</span>
                        <div>
                          <h3 className="font-display font-black text-base text-navy">{habit.name}</h3>
                          <p className="text-[10px] font-bold text-navy/40 uppercase tracking-wider">{habit.frequency}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(habit)} className="w-8 h-8 rounded-lg bg-snow/60 hover:bg-snow flex items-center justify-center transition-colors">
                          <svg className="w-3.5 h-3.5 text-navy/50" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                          </svg>
                        </button>
                        <button onClick={() => toggleArchive(habit.id)} className="w-8 h-8 rounded-lg bg-snow/60 hover:bg-snow flex items-center justify-center transition-colors">
                          <svg className="w-3.5 h-3.5 text-navy/50" viewBox="0 0 24 24" fill="currentColor">
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
          <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center px-4 pt-4 pb-20 md:p-6" onClick={() => resetForm()}>
            <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[10px_10px_0_0_#000] w-full max-w-md max-h-[80vh] md:max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="border-b-[3px] border-navy px-6 py-4 flex items-center justify-between bg-ghost rounded-t-[1.25rem]">
                <h3 className="font-display font-black text-lg text-navy">
                  {editId ? "Edit Habit" : "New Habit"}
                </h3>
                <button onClick={resetForm} className="text-slate hover:text-navy">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-5">
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
                    {ICONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setFormIcon(icon)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                          formIcon === icon ? "bg-lime border-[3px] border-navy scale-110" : "bg-ghost border-[2px] border-navy/10 hover:border-navy/30"
                        }`}
                      >
                        {icon}
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
                            ? "bg-navy text-snow border-navy"
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
                  className="w-full bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D] px-6 py-3.5 rounded-2xl font-display font-black text-base text-navy hover:shadow-[7px_7px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[6px_6px_0_0_#000] p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-light flex items-center justify-center">
              <svg className="w-8 h-8 text-teal" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-display font-black text-xl text-navy mb-2">Start Building Habits</h3>
            <p className="text-sm text-slate mb-6 max-w-sm mx-auto">
              Create your first habit and begin tracking your consistency.
            </p>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D] px-8 py-3.5 rounded-2xl font-display font-black text-base text-navy hover:shadow-[7px_7px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
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
              <svg className={`w-4 h-4 transition-transform ${showArchived ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="currentColor">
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
          <svg className="w-3 h-3 text-slate" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider">All data stored locally on your device</span>
        </div>
      </div>
    </div>
  );
}
