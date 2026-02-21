"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";

/* ─── Types ─── */
type TimerMode = "focus" | "shortBreak" | "longBreak";

interface SessionRecord {
  id: string;
  mode: TimerMode;
  duration: number;
  completedAt: string;
  date: string;
}

interface TimerSettings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  autoStartBreaks: boolean;
  soundEnabled: boolean;
}

/* ─── Constants ─── */
const DEFAULT_SETTINGS: TimerSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  autoStartBreaks: false,
  soundEnabled: true,
};

const MODE_CONFIG = {
  focus: { label: "Focus", bg: "bg-lavender", text: "text-lavender", light: "bg-lavender-light", stroke: "stroke-lavender" },
  shortBreak: { label: "Short Break", bg: "bg-teal", text: "text-teal", light: "bg-teal-light", stroke: "stroke-teal" },
  longBreak: { label: "Long Break", bg: "bg-sunny", text: "text-sunny", light: "bg-sunny-light", stroke: "stroke-sunny" },
};

const MOTIVATIONAL_QUOTES = [
  "Stay focused, stay sharp!",
  "Every minute counts!",
  "You're building greatness!",
  "Deep work, deep results!",
  "Consistency is key!",
  "Your future self thanks you!",
];

export default function StudyTimerPage() {
  const { showHelp, openHelp, closeHelp } = useToolHelp("timer");
  /* ─── State ─── */
  const [mode, setMode] = useState<TimerMode>("focus");
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [todayStats, setTodayStats] = useState({ focusMinutes: 0, sessions: 0 });
  const [streak, setStreak] = useState(0);
  const [quote, setQuote] = useState("");

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /* ─── Callbacks ─── */
  const calculateStats = useCallback((records: SessionRecord[]) => {
    const today = new Date().toDateString();
    const todayRecords = records.filter((r) => r.date === today && r.mode === "focus");
    const focusMinutes = todayRecords.reduce((acc, r) => acc + r.duration, 0);
    setTodayStats({ focusMinutes, sessions: todayRecords.length });

    const dates = [...new Set(records.filter((r) => r.mode === "focus").map((r) => r.date))].sort().reverse();
    let currentStreak = 0;
    const todayDate = new Date();
    for (let i = 0; i < dates.length; i++) {
      const expectedDate = new Date(todayDate);
      expectedDate.setDate(expectedDate.getDate() - i);
      if (dates[i] === expectedDate.toDateString()) currentStreak++;
      else break;
    }
    setStreak(currentStreak);
  }, []);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("iesa-timer-settings");
      if (savedSettings) setSettings(JSON.parse(savedSettings));
      const savedHistory = localStorage.getItem("iesa-timer-history");
      if (savedHistory) {
        const records: SessionRecord[] = JSON.parse(savedHistory);
        setHistory(records);
        calculateStats(records);
      }
      setQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
    } catch { console.error("Failed to load timer data"); }
  }, [calculateStats]);

  const getDuration = useCallback((timerMode: TimerMode) => {
    switch (timerMode) {
      case "focus": return settings.focusDuration * 60;
      case "shortBreak": return settings.shortBreakDuration * 60;
      case "longBreak": return settings.longBreakDuration * 60;
    }
  }, [settings]);

  const switchMode = useCallback((newMode: TimerMode) => {
    setMode(newMode);
    setTimeLeft(getDuration(newMode));
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [getDuration]);

  const handleTimerComplete = useCallback(() => {
    setIsRunning(false);
    if (settings.soundEnabled) {
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        oscillator.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 200);
      } catch { /* Audio not supported */ }
    }

    const newRecord: SessionRecord = {
      id: Date.now().toString(),
      mode,
      duration: mode === "focus" ? settings.focusDuration : mode === "shortBreak" ? settings.shortBreakDuration : settings.longBreakDuration,
      completedAt: new Date().toISOString(),
      date: new Date().toDateString(),
    };

    setHistory((prev) => {
      const updatedHistory = [newRecord, ...prev].slice(0, 100);
      localStorage.setItem("iesa-timer-history", JSON.stringify(updatedHistory));
      calculateStats(updatedHistory);
      return updatedHistory;
    });

    if (mode === "focus") {
      setSessionsCompleted((prev) => {
        const newCount = prev + 1;
        if (newCount % 4 === 0) {
          setMode("longBreak");
          setTimeLeft(settings.longBreakDuration * 60);
        } else {
          setMode("shortBreak");
          setTimeLeft(settings.shortBreakDuration * 60);
        }
        if (settings.autoStartBreaks) setTimeout(() => setIsRunning(true), 1000);
        return newCount;
      });
    } else {
      setMode("focus");
      setTimeLeft(settings.focusDuration * 60);
    }
  }, [mode, settings, calculateStats]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && isRunning) {
      handleTimerComplete();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, timeLeft, handleTimerComplete]);

  const toggleTimer = () => {
    if (!isRunning) setShowSettings(false);
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(getDuration(mode));
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const saveSettings = (newSettings: TimerSettings) => {
    setSettings(newSettings);
    localStorage.setItem("iesa-timer-settings", JSON.stringify(newSettings));
    switch (mode) {
      case "focus": setTimeLeft(newSettings.focusDuration * 60); break;
      case "shortBreak": setTimeLeft(newSettings.shortBreakDuration * 60); break;
      case "longBreak": setTimeLeft(newSettings.longBreakDuration * 60); break;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const totalTime = getDuration(mode);
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const modeConfig = MODE_CONFIG[mode];

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Study Timer" />
      <ToolHelpModal toolId="timer" isOpen={showHelp} onClose={closeHelp} />

      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8 max-w-4xl mx-auto relative">
        {/* Diamond Sparkle Decorators */}
        <svg className="fixed top-24 left-[7%] w-5 h-5 text-lavender/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-44 right-[8%] w-7 h-7 text-teal/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-[50%] left-[5%] w-4 h-4 text-sunny/18 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed bottom-36 right-[12%] w-6 h-6 text-coral/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed top-[35%] right-[20%] w-4 h-4 text-lime/18 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
        <svg className="fixed bottom-52 left-[14%] w-5 h-5 text-lavender/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

        {/* Back Link + Help */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dashboard/growth"
            className="inline-flex items-center gap-2 font-display font-bold text-xs text-slate uppercase tracking-wider hover:text-navy transition-colors group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
            Back to Growth Hub
          </Link>
          <HelpButton onClick={openHelp} />
        </div>

        {/* ═══ BENTO HERO ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          {/* Title Card — lavender theme */}
          <div className="md:col-span-7 bg-lavender border-[6px] border-navy rounded-[2rem] p-8 shadow-[10px_10px_0_0_#000] rotate-[-0.4deg] hover:rotate-0 transition-transform relative overflow-hidden">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/70 flex items-center gap-2 mb-3">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
              Deep Focus
            </span>
            <h1 className="font-display font-black text-3xl md:text-4xl text-navy mb-2">
              <span className="brush-highlight brush-coral">Study</span> Timer
            </h1>
            <p className="font-display font-normal text-sm text-navy/70 max-w-md">
              Pomodoro technique for peak productivity. Focus hard, rest smart.
            </p>
          </div>

          {/* Stats Strip — 3 inline cards */}
          <div className="md:col-span-5 grid grid-cols-1 gap-3">
            {/* Today Minutes */}
            <div className="bg-teal-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[0.3deg] hover:rotate-0 transition-transform flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Today&apos;s Focus</span>
                <p className="font-display font-black text-2xl text-navy">{todayStats.focusMinutes} <span className="text-sm font-bold text-navy/50">min</span></p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-teal" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" /></svg>
              </div>
            </div>
            {/* Sessions */}
            <div className="bg-coral-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Sessions</span>
                <p className="font-display font-black text-2xl text-navy">{todayStats.sessions}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-coral/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-coral" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152-.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clipRule="evenodd" /></svg>
              </div>
            </div>
            {/* Streak */}
            <div className="bg-sunny-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[6px_6px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Streak</span>
                <p className="font-display font-black text-2xl text-navy">{streak} <span className="text-sm font-bold text-navy/50">days</span></p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sunny/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-sunny" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ MODE SELECTOR ═══ */}
        <div className="bg-snow border-[4px] border-navy rounded-[1.5rem] shadow-[6px_6px_0_0_#000] p-4 mb-8">
          <div className="flex justify-center gap-2">
            {(Object.keys(MODE_CONFIG) as TimerMode[]).map((m) => {
              const cfg = MODE_CONFIG[m];
              return (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`px-5 py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider border-[3px] transition-all ${
                    mode === m
                      ? `${cfg.bg} text-navy border-navy shadow-[3px_3px_0_0_#000]`
                      : "bg-ghost text-navy/40 border-transparent hover:border-navy/20 hover:text-navy"
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ TIMER DISPLAY ═══ */}
        <div className={`${modeConfig.light} border-[6px] border-navy rounded-[2rem] shadow-[10px_10px_0_0_#000] p-8 md:p-12 mb-8 rotate-[0.2deg] hover:rotate-0 transition-transform`}>
          <div className="flex flex-col items-center">
            {/* Circle Timer */}
            <div className="relative w-64 h-64 md:w-72 md:h-72 mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="50%" cy="50%" r="120" fill="none" stroke="currentColor" strokeWidth="6" className="text-navy/10" />
                <circle
                  cx="50%" cy="50%" r="120" fill="none" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                  className={`transition-all duration-500 ${modeConfig.stroke}`} stroke="currentColor"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-2 ${modeConfig.text}`}>{modeConfig.label}</span>
                <div className="font-display font-black text-5xl md:text-6xl text-navy tracking-tight">{formatTime(timeLeft)}</div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/40 mt-2">
                  Session {sessionsCompleted + 1}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              {/* Reset */}
              <button
                onClick={resetTimer}
                className="w-14 h-14 bg-snow border-[4px] border-navy rounded-2xl shadow-[4px_4px_0_0_#000] flex items-center justify-center text-slate hover:text-navy hover:shadow-[6px_6px_0_0_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                aria-label="Reset timer"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={toggleTimer}
                className={`w-20 h-20 ${modeConfig.bg} border-[4px] border-navy rounded-full shadow-[5px_5px_0_0_#000] flex items-center justify-center text-navy hover:shadow-[7px_7px_0_0_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all`}
                aria-label={isRunning ? "Pause timer" : "Start timer"}
              >
                {isRunning ? (
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 ml-1" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Settings */}
              <button
                onClick={() => !isRunning && setShowSettings(!showSettings)}
                disabled={isRunning}
                className={`w-14 h-14 bg-snow border-[4px] border-navy rounded-2xl shadow-[4px_4px_0_0_#000] flex items-center justify-center transition-all ${
                  isRunning ? "opacity-40 cursor-not-allowed" : showSettings ? "text-navy" : "text-slate hover:text-navy hover:shadow-[6px_6px_0_0_#000] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                }`}
                aria-label="Timer settings"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Quote */}
            <p className="mt-6 font-display font-normal text-sm text-navy/50 flex items-center gap-2">
              <svg className="w-3 h-3 text-sunny" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
              {quote}
            </p>
          </div>
        </div>

        {/* ═══ SETTINGS PANEL ═══ */}
        {showSettings && !isRunning && (
          <div className="bg-snow border-[4px] border-navy rounded-[1.5rem] shadow-[8px_8px_0_0_#000] p-6 mb-8">
            <h3 className="font-display font-black text-lg text-navy mb-5 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-lavender-light flex items-center justify-center">
                <svg className="w-4 h-4 text-lavender" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
                </svg>
              </div>
              Timer Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div>
                <label htmlFor="focus-duration" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-2">Focus (min)</label>
                <input
                  id="focus-duration" type="number" min="1" max="90" value={settings.focusDuration}
                  onChange={(e) => saveSettings({ ...settings, focusDuration: parseInt(e.target.value) || 25 })}
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-xl text-navy font-display font-bold text-center focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="short-break" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-2">Short Break (min)</label>
                <input
                  id="short-break" type="number" min="1" max="30" value={settings.shortBreakDuration}
                  onChange={(e) => saveSettings({ ...settings, shortBreakDuration: parseInt(e.target.value) || 5 })}
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-xl text-navy font-display font-bold text-center focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="long-break" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-2">Long Break (min)</label>
                <input
                  id="long-break" type="number" min="1" max="60" value={settings.longBreakDuration}
                  onChange={(e) => saveSettings({ ...settings, longBreakDuration: parseInt(e.target.value) || 15 })}
                  className="w-full px-4 py-3 bg-ghost border-[3px] border-navy rounded-xl text-navy font-display font-bold text-center focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-10 h-6 rounded-full border-[2px] border-navy relative transition-colors ${settings.autoStartBreaks ? "bg-teal" : "bg-cloud"}`}
                  onClick={() => saveSettings({ ...settings, autoStartBreaks: !settings.autoStartBreaks })}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-snow border-[2px] border-navy transition-all ${settings.autoStartBreaks ? "left-4" : "left-0.5"}`} />
                </div>
                <span className="font-display font-normal text-sm text-navy/60 group-hover:text-navy transition-colors">Auto-start breaks</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-10 h-6 rounded-full border-[2px] border-navy relative transition-colors ${settings.soundEnabled ? "bg-teal" : "bg-cloud"}`}
                  onClick={() => saveSettings({ ...settings, soundEnabled: !settings.soundEnabled })}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-snow border-[2px] border-navy transition-all ${settings.soundEnabled ? "left-4" : "left-0.5"}`} />
                </div>
                <span className="font-display font-normal text-sm text-navy/60 group-hover:text-navy transition-colors">Sound enabled</span>
              </label>
            </div>
          </div>
        )}

        {/* ═══ BOTTOM BENTO: History + Pro Tip ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Session History */}
          <div className="md:col-span-8 bg-snow border-[4px] border-navy rounded-[1.5rem] shadow-[6px_6px_0_0_#000] overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-5 hover:bg-ghost transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-lavender-light flex items-center justify-center">
                  <svg className="w-4 h-4 text-lavender" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" /></svg>
                </div>
                <span className="font-display font-black text-base text-navy">Session History</span>
                {history.length > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-cloud text-navy/60 font-display font-bold text-[10px] uppercase tracking-[0.08em]">{history.length}</span>
                )}
              </div>
              <svg className={`w-4 h-4 text-slate transition-transform ${showHistory ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z" clipRule="evenodd" />
              </svg>
            </button>

            {showHistory && (
              <div className="border-t-[3px] border-navy p-5 max-h-72 overflow-y-auto">
                {history.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="font-display font-bold text-xs text-slate uppercase tracking-wider">No sessions yet. Start your first focus session!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.slice(0, 20).map((record, i) => {
                      const cfg = MODE_CONFIG[record.mode];
                      const accents = ["border-l-teal", "border-l-coral", "border-l-lavender", "border-l-sunny"];
                      return (
                        <div
                          key={record.id}
                          className={`flex items-center justify-between p-3 bg-ghost border-[3px] border-navy ${accents[i % accents.length]} border-l-[5px] rounded-xl`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center text-navy font-display font-black text-xs`}>
                              {record.mode === "focus" ? "F" : "B"}
                            </div>
                            <div>
                              <p className="font-display font-black text-sm text-navy">{cfg.label}</p>
                              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-navy/40">
                                {record.duration} min &middot; {new Date(record.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-navy/40">
                            {new Date(record.date).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pro Tip Card */}
          <div className="md:col-span-4 bg-navy border-[4px] border-lime rounded-[1.5rem] shadow-[8px_8px_0_0_#000] p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-lime/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
              </div>
              <h4 className="font-display font-black text-base text-lime mb-2">Pro Tip</h4>
              <p className="font-display font-normal text-sm text-lime/60">
                Take a 15-30 minute long break after completing 4 focus sessions. Your brain needs time to consolidate learning!
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-lime/20">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-lime/40 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" /></svg>
                All data stored locally
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
