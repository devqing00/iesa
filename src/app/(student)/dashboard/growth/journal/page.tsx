"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from "react";

/* ─── Types ─────────────────────────────────────────────────────── */

interface JournalEntry {
  id: string;
  weekLabel: string;      // e.g. "Jan 6 – Jan 12, 2025"
  weekKey: string;         // e.g. "2025-W02"
  wentWell: string;
  toImprove: string;
  nextWeekFocus: string;
  gratitude: string;
  mood: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "iesa-journal-entries";

const MOODS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: "😞", label: "Tough" },
  { value: 2, emoji: "😕", label: "Okay" },
  { value: 3, emoji: "😊", label: "Good" },
  { value: 4, emoji: "😄", label: "Great" },
  { value: 5, emoji: "🤩", label: "Amazing" },
];

const PROMPTS: { key: keyof Pick<JournalEntry, "wentWell" | "toImprove" | "nextWeekFocus" | "gratitude">; label: string; placeholder: string; color: string }[] = [
  { key: "wentWell", label: "What went well?", placeholder: "Accomplished assignments, great study sessions, learned new concepts...", color: "teal" },
  { key: "toImprove", label: "What could improve?", placeholder: "Time management, procrastination, study consistency...", color: "coral" },
  { key: "nextWeekFocus", label: "Next week's focus", placeholder: "Finish lab reports, prepare for midterms, attend study group...", color: "lavender" },
  { key: "gratitude", label: "Gratitude", placeholder: "Helpful classmates, supportive lecturers, access to resources...", color: "sunny" },
];

/* ─── Helpers ───────────────────────────────────────────────────── */

function getWeekKey(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getWeekLabel(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const startOfWeek = new Date(d);
  startOfWeek.setDate(d.getDate() - day + 1); // Monday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

  const fmt = (dt: Date) =>
    dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const year = endOfWeek.getFullYear();
  return `${fmt(startOfWeek)} – ${fmt(endOfWeek)}, ${year}`;
}

function getWeekProgress(entries: JournalEntry[]): number {
  // How many weeks in the last 8 have entries
  const weeks: string[] = [];
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    weeks.push(getWeekKey(d));
  }
  const entryWeeks = new Set(entries.map((e) => e.weekKey));
  return weeks.filter((w) => entryWeeks.has(w)).length;
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function JournalPage() {
  const { showHelp, openHelp, closeHelp } = useToolHelp("journal");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  // Form state
  const [wentWell, setWentWell] = useState("");
  const [toImprove, setToImprove] = useState("");
  const [nextWeekFocus, setNextWeekFocus] = useState("");
  const [gratitude, setGratitude] = useState("");
  const [mood, setMood] = useState<number>(3);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setEntries(JSON.parse(saved));
    } catch {
      console.error("Failed to load journal entries");
    }
  }, []);

  const persist = useCallback((data: JournalEntry[]) => {
    setEntries(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const currentWeekKey = getWeekKey();
  const currentWeekLabel = getWeekLabel();
  const hasCurrentWeek = entries.some((e) => e.weekKey === currentWeekKey);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.weekKey.localeCompare(a.weekKey)),
    [entries]
  );

  const resetForm = () => {
    setWentWell("");
    setToImprove("");
    setNextWeekFocus("");
    setGratitude("");
    setMood(3);
    setEditId(null);
    setEditing(false);
  };

  const startNewEntry = () => {
    const existing = entries.find((e) => e.weekKey === currentWeekKey);
    if (existing) {
      setWentWell(existing.wentWell);
      setToImprove(existing.toImprove);
      setNextWeekFocus(existing.nextWeekFocus);
      setGratitude(existing.gratitude);
      setMood(existing.mood);
      setEditId(existing.id);
    } else {
      resetForm();
    }
    setEditing(true);
    setViewingId(null);
  };

  const startEdit = (entry: JournalEntry) => {
    setWentWell(entry.wentWell);
    setToImprove(entry.toImprove);
    setNextWeekFocus(entry.nextWeekFocus);
    setGratitude(entry.gratitude);
    setMood(entry.mood);
    setEditId(entry.id);
    setEditing(true);
    setViewingId(null);
  };

  const handleSave = () => {
    if (!wentWell.trim() && !toImprove.trim() && !nextWeekFocus.trim() && !gratitude.trim()) return;

    if (editId) {
      persist(
        entries.map((e) =>
          e.id === editId
            ? { ...e, wentWell, toImprove, nextWeekFocus, gratitude, mood: mood as JournalEntry["mood"], updatedAt: new Date().toISOString() }
            : e
        )
      );
    } else {
      const entry: JournalEntry = {
        id: Date.now().toString(36),
        weekLabel: currentWeekLabel,
        weekKey: currentWeekKey,
        wentWell,
        toImprove,
        nextWeekFocus,
        gratitude,
        mood: mood as JournalEntry["mood"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      persist([entry, ...entries]);
    }
    resetForm();
  };

  const deleteEntry = (id: string) => {
    if (!confirm("Delete this journal entry?")) return;
    persist(entries.filter((e) => e.id !== id));
    if (viewingId === id) setViewingId(null);
  };

  const viewingEntry = entries.find((e) => e.id === viewingId);

  // Stats
  const avgMood = entries.length > 0 ? entries.reduce((s, e) => s + e.mood, 0) / entries.length : 0;
  const journalStreak = getWeekProgress(entries);
  const totalEntries = entries.length;

  const SECTION_COLORS: Record<string, string> = {
    teal: "bg-teal-light border-teal/30",
    coral: "bg-coral-light border-coral/30",
    lavender: "bg-lavender-light border-lavender/30",
    sunny: "bg-sunny-light border-sunny/30",
  };

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Weekly Journal" />
      <ToolHelpModal toolId="journal" isOpen={showHelp} onClose={closeHelp} />

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
          <div className="md:col-span-7 bg-sunny border-[5px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[180px] flex flex-col justify-between">
            <div className="absolute -bottom-14 -right-14 w-40 h-40 rounded-full bg-navy/8 pointer-events-none" />
            <svg className="absolute top-6 right-10 w-5 h-5 text-navy/10 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <div>
              <p className="text-[10px] font-bold text-navy/40 uppercase tracking-[0.15em] mb-2">Self Reflection</p>
              <h1 className="font-display font-black text-3xl md:text-4xl text-navy leading-[0.95]">
                Weekly Journal
              </h1>
              <p className="text-sm text-navy/50 mt-3 max-w-md">
                Reflect on your week, celebrate wins, and set intentions for the next.
              </p>
            </div>
          </div>

          <div className="md:col-span-5 grid grid-cols-2 gap-3">
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Entries</p>
              <p className="font-display font-black text-3xl text-navy mt-2">{totalEntries}</p>
            </div>
            <div className="bg-teal-light border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">8-Week Run</p>
              <p className="font-display font-black text-3xl text-navy mt-2">
                {journalStreak}<span className="text-base text-slate">/{8}</span>
              </p>
            </div>
            <div className="bg-sunny-light border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] rotate-[-0.3deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Avg Mood</p>
              <p className="font-display font-black text-3xl text-navy mt-2">
                {avgMood > 0 ? MOODS[Math.round(avgMood) - 1]?.emoji || "—" : "—"}
              </p>
            </div>
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">This Week</p>
              <p className="font-display font-black text-2xl text-navy mt-2">
                {hasCurrentWeek ? (
                  <svg className="w-7 h-7 text-teal inline-block" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className="text-coral text-lg">Pending</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ═══ WRITE / EDIT ENTRY ═══ */}
        {editing ? (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-8 rounded-full bg-sunny" />
                <h2 className="font-display font-black text-xl text-navy">
                  {editId ? "Edit Entry" : "This Week"}: {currentWeekLabel}
                </h2>
              </div>
              <button onClick={resetForm} className="text-sm font-bold text-slate hover:text-navy">
                Cancel
              </button>
            </div>

            <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] overflow-hidden">
              {/* Mood selector */}
              <div className="border-b-[3px] border-navy px-6 py-5 bg-ghost">
                <p className="text-[10px] font-bold text-slate uppercase tracking-wider mb-3">How was your week?</p>
                <div className="flex gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMood(m.value)}
                      className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-[3px] transition-all ${
                        mood === m.value
                          ? "bg-sunny-light border-navy shadow-[3px_3px_0_0_#000] scale-105"
                          : "bg-snow border-navy/10 hover:border-navy/30"
                      }`}
                    >
                      <span className="text-2xl">{m.emoji}</span>
                      <span className="text-[9px] font-bold text-navy/50 uppercase">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompts */}
              <div className="p-6 space-y-5">
                {PROMPTS.map((prompt) => {
                  const value = prompt.key === "wentWell" ? wentWell : prompt.key === "toImprove" ? toImprove : prompt.key === "nextWeekFocus" ? nextWeekFocus : gratitude;
                  const setter = prompt.key === "wentWell" ? setWentWell : prompt.key === "toImprove" ? setToImprove : prompt.key === "nextWeekFocus" ? setNextWeekFocus : setGratitude;
                  return (
                    <div key={prompt.key}>
                      <label className={`text-[10px] font-bold uppercase tracking-wider block mb-2 ${
                        prompt.color === "teal" ? "text-teal" : prompt.color === "coral" ? "text-coral" : prompt.color === "lavender" ? "text-lavender" : "text-sunny"
                      }`}>
                        {prompt.label}
                      </label>
                      <textarea
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        placeholder={prompt.placeholder}
                        rows={3}
                        className="w-full bg-snow border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy font-medium focus:border-teal focus:outline-none transition-colors resize-none"
                      />
                    </div>
                  );
                })}

                <button
                  onClick={handleSave}
                  className="w-full bg-lime border-[4px] border-navy press-3 press-navy px-6 py-3.5 rounded-2xl font-display font-black text-base text-navy transition-all"
                >
                  {editId ? "Update Entry" : "Save Reflection"}
                </button>
              </div>
            </div>
          </div>
        ) : viewingEntry ? (
          /* ═══ VIEW ENTRY ═══ */
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewingId(null)}
                  className="w-8 h-8 rounded-lg bg-ghost border-[2px] border-navy/20 hover:border-navy flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-navy" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <h2 className="font-display font-black text-xl text-navy">{viewingEntry.weekLabel}</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(viewingEntry)} className="text-sm font-bold text-lavender hover:underline">Edit</button>
                <button onClick={() => deleteEntry(viewingEntry.id)} className="text-sm font-bold text-coral hover:underline">Delete</button>
              </div>
            </div>

            <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] overflow-hidden">
              {/* Mood */}
              <div className="border-b-[3px] border-navy px-6 py-4 bg-ghost flex items-center gap-3">
                <span className="text-2xl">{MOODS[viewingEntry.mood - 1]?.emoji}</span>
                <p className="text-sm font-bold text-navy">{MOODS[viewingEntry.mood - 1]?.label} week</p>
              </div>

              <div className="p-6 space-y-4">
                {PROMPTS.map((prompt) => {
                  const value = viewingEntry[prompt.key];
                  if (!value) return null;
                  return (
                    <div key={prompt.key} className={`${SECTION_COLORS[prompt.color]} border-l-[4px] rounded-xl p-4`}>
                      <p className="text-[10px] font-bold text-navy/40 uppercase tracking-wider mb-1">{prompt.label}</p>
                      <p className="text-sm text-navy/80 whitespace-pre-wrap">{value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ═══ ENTRIES LIST + CTA ═══ */
          <div className="mb-8">
            {/* CTA for current week */}
            {!hasCurrentWeek && (
              <div className="bg-sunny-light border-[4px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] p-6 mb-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-sunny border-[3px] border-navy flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7 text-navy" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-black text-base text-navy">Reflect on this week</h3>
                  <p className="text-xs text-navy/50 mt-0.5">{currentWeekLabel}</p>
                </div>
                <button
                  onClick={startNewEntry}
                  className="bg-lime border-[3px] border-navy press-3 press-navy px-5 py-2.5 rounded-xl font-display font-bold text-sm text-navy shrink-0 transition-all"
                >
                  Write Now
                </button>
              </div>
            )}

            {hasCurrentWeek && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-8 rounded-full bg-sunny" />
                  <h2 className="font-display font-black text-xl text-navy">Your Reflections</h2>
                </div>
                <button
                  onClick={startNewEntry}
                  className="bg-lime border-[3px] border-navy press-3 press-navy px-4 py-2 rounded-xl font-display font-bold text-sm text-navy transition-all"
                >
                  Edit This Week
                </button>
              </div>
            )}

            {sortedEntries.length === 0 ? (
              <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] p-10 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sunny-light flex items-center justify-center">
                  <svg className="w-8 h-8 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 0 0 3 3h15a3 3 0 0 1-3-3V4.875C17.25 3.839 16.41 3 15.375 3H4.125ZM12 9.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H12Zm-.75-2.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1-.75-.75ZM6 12.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5H6Zm-.75 3.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75ZM6 6.75a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75v-3A.75.75 0 0 0 9 6.75H6Z" clipRule="evenodd" />
                    <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 0 1-3 0V6.75Z" />
                  </svg>
                </div>
                <h3 className="font-display font-black text-xl text-navy mb-2">Start Your Journal</h3>
                <p className="text-sm text-slate mb-6 max-w-sm mx-auto">
                  Weekly reflections help you learn from experience and grow intentionally.
                </p>
                <button
                  onClick={startNewEntry}
                  className="bg-lime border-[4px] border-navy shadow-[3px_3px_0_0_#0F0F2D] px-8 py-3.5 rounded-2xl font-display font-black text-base text-navy transition-all"
                >
                  Write Your First Entry
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedEntries.map((entry) => {
                  const moodData = MOODS[entry.mood - 1];
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setViewingId(entry.id)}
                      className="w-full group bg-snow border-[3px] border-navy rounded-2xl press-3 press-black transition-all overflow-hidden text-left"
                    >
                      <div className="flex items-center gap-4 p-4">
                        <span className="text-2xl shrink-0">{moodData?.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-black text-sm text-navy">{entry.weekLabel}</p>
                          <p className="text-xs text-slate mt-0.5 truncate">
                            {entry.wentWell ? entry.wentWell.slice(0, 80) + (entry.wentWell.length > 80 ? "…" : "") : "No notes"}
                          </p>
                        </div>
                        <svg className="w-4 h-4 text-navy/20 group-hover:text-navy group-hover:translate-x-1 transition-all shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
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
