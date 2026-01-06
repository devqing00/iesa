"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";

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

const DEFAULT_SETTINGS: TimerSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  autoStartBreaks: false,
  soundEnabled: true,
};

const MODE_CONFIG = {
  focus: { label: "Focus", color: "bg-blue-600", textColor: "text-blue-600" },
  shortBreak: {
    label: "Short Break",
    color: "bg-emerald-600",
    textColor: "text-emerald-600",
  },
  longBreak: {
    label: "Long Break",
    color: "bg-purple-600",
    textColor: "text-purple-600",
  },
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
  const [mode, setMode] = useState<TimerMode>("focus");
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [todayStats, setTodayStats] = useState({
    focusMinutes: 0,
    sessions: 0,
  });
  const [streak, setStreak] = useState(0);
  const [quote, setQuote] = useState("");

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateStats = useCallback((records: SessionRecord[]) => {
    const today = new Date().toDateString();
    const todayRecords = records.filter(
      (r) => r.date === today && r.mode === "focus"
    );
    const focusMinutes = todayRecords.reduce((acc, r) => acc + r.duration, 0);
    setTodayStats({ focusMinutes, sessions: todayRecords.length });

    const dates = [
      ...new Set(records.filter((r) => r.mode === "focus").map((r) => r.date)),
    ]
      .sort()
      .reverse();
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
      setQuote(
        MOTIVATIONAL_QUOTES[
          Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)
        ]
      );
    } catch {
      console.error("Failed to load timer data");
    }
  }, [calculateStats]);

  const getDuration = useCallback(
    (timerMode: TimerMode) => {
      switch (timerMode) {
        case "focus":
          return settings.focusDuration * 60;
        case "shortBreak":
          return settings.shortBreakDuration * 60;
        case "longBreak":
          return settings.longBreakDuration * 60;
      }
    },
    [settings]
  );

  const switchMode = useCallback(
    (newMode: TimerMode) => {
      setMode(newMode);
      setTimeLeft(getDuration(newMode));
      setIsRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [getDuration]
  );

  const handleTimerComplete = useCallback(() => {
    setIsRunning(false);

    if (settings.soundEnabled) {
      try {
        const audioContext = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        oscillator.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 200);
      } catch {
        console.log("Audio not supported");
      }
    }

    const newRecord: SessionRecord = {
      id: Date.now().toString(),
      mode,
      duration:
        mode === "focus"
          ? settings.focusDuration
          : mode === "shortBreak"
          ? settings.shortBreakDuration
          : settings.longBreakDuration,
      completedAt: new Date().toISOString(),
      date: new Date().toDateString(),
    };

    setHistory((prev) => {
      const updatedHistory = [newRecord, ...prev].slice(0, 100);
      localStorage.setItem(
        "iesa-timer-history",
        JSON.stringify(updatedHistory)
      );
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
        if (settings.autoStartBreaks)
          setTimeout(() => setIsRunning(true), 1000);
        return newCount;
      });
    } else {
      setMode("focus");
      setTimeLeft(settings.focusDuration * 60);
    }
  }, [mode, settings, calculateStats]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(
        () => setTimeLeft((prev) => prev - 1),
        1000
      );
    } else if (timeLeft === 0 && isRunning) {
      handleTimerComplete();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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
      case "focus":
        setTimeLeft(newSettings.focusDuration * 60);
        break;
      case "shortBreak":
        setTimeLeft(newSettings.shortBreakDuration * 60);
        break;
      case "longBreak":
        setTimeLeft(newSettings.longBreakDuration * 60);
        break;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const totalTime = getDuration(mode);
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Study Timer" />

      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto">
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

          {/* Hero Stats */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="page-frame px-5 py-3 flex items-center gap-2">
              <span className="text-label-sm text-text-muted">Today:</span>
              <span className="font-display text-lg">
                {todayStats.focusMinutes} min
              </span>
            </div>
            <div className="page-frame px-5 py-3 flex items-center gap-2">
              <span className="text-label-sm text-text-muted">Sessions:</span>
              <span className="font-display text-lg">
                {todayStats.sessions}
              </span>
            </div>
            {streak > 0 && (
              <div className="page-frame px-5 py-3 flex items-center gap-2">
                <span className="text-amber-600">✦</span>
                <span className="font-display text-lg">
                  {streak} day streak
                </span>
              </div>
            )}
          </div>

          {/* Mode Selector */}
          <div className="flex justify-center gap-2 mb-8 border-b border-border pb-6">
            {(Object.keys(MODE_CONFIG) as TimerMode[]).map((m) => {
              const config = MODE_CONFIG[m];
              return (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`px-4 py-2.5 text-label transition-all ${
                    mode === m
                      ? `${config.color} text-white`
                      : "bg-bg-secondary text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Timer Display */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-64 h-64 md:w-80 md:h-80">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="120"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-border"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="120"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className={`transition-all duration-500 ${MODE_CONFIG[mode].textColor}`}
                  stroke="currentColor"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-label-sm mb-2 ${MODE_CONFIG[mode].textColor}`}
                >
                  {MODE_CONFIG[mode].label}
                </span>
                <div className="font-display text-display-lg tracking-tight">
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={resetTimer}
              className="w-14 h-14 page-frame flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>

            <button
              onClick={toggleTimer}
              className={`w-20 h-20 flex items-center justify-center text-white ${MODE_CONFIG[mode].color} hover:opacity-90 transition-opacity`}
            >
              {isRunning ? (
                <svg
                  className="w-9 h-9"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="w-9 h-9 ml-1"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            <button
              onClick={() => !isRunning && setShowSettings(!showSettings)}
              disabled={isRunning}
              className={`w-14 h-14 page-frame flex items-center justify-center transition-all ${
                isRunning
                  ? "opacity-40 cursor-not-allowed"
                  : showSettings
                  ? "text-text-primary border-border-dark"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>

          {/* Motivational Quote */}
          <div className="text-center mb-8">
            <p className="text-text-secondary text-body flex items-center justify-center gap-2">
              <span className="text-amber-600">✦</span> {quote}
            </p>
          </div>

          {/* Settings Panel */}
          {showSettings && !isRunning && (
            <div className="page-frame p-6 mb-8">
              <h3 className="font-display text-lg mb-4 flex items-center gap-2">
                <span className="text-text-muted">◆</span> Timer Settings
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-label-sm text-text-secondary mb-2">
                    Focus Duration (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={settings.focusDuration}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        focusDuration: parseInt(e.target.value) || 25,
                      })
                    }
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-label-sm text-text-secondary mb-2">
                    Short Break (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.shortBreakDuration}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        shortBreakDuration: parseInt(e.target.value) || 5,
                      })
                    }
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-label-sm text-text-secondary mb-2">
                    Long Break (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.longBreakDuration}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        longBreakDuration: parseInt(e.target.value) || 15,
                      })
                    }
                    className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-text-secondary text-body cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoStartBreaks}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        autoStartBreaks: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  Auto-start breaks
                </label>
                <label className="flex items-center gap-2 text-text-secondary text-body cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        soundEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  Sound enabled
                </label>
              </div>
            </div>
          )}

          {/* Session History */}
          <div className="page-frame overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-5 hover:bg-bg-secondary transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-label text-text-muted">◆</span>
                <span className="font-display">Session History</span>
                {history.length > 0 && (
                  <span className="px-2 py-0.5 bg-bg-secondary text-text-muted text-label-sm">
                    {history.length}
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-text-muted transition-transform ${
                  showHistory ? "rotate-180" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>

            {showHistory && (
              <div className="border-t border-border p-5 max-h-64 overflow-y-auto">
                {history.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-text-muted text-label-sm">
                      No sessions yet. Start your first focus session!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.slice(0, 20).map((record) => {
                      const config = MODE_CONFIG[record.mode];
                      return (
                        <div
                          key={record.id}
                          className="flex items-center justify-between p-3 bg-bg-secondary border border-border"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 ${config.color} flex items-center justify-center text-white text-label-sm`}
                            >
                              {record.mode === "focus" ? "F" : "B"}
                            </div>
                            <div>
                              <p className="font-display text-sm">
                                {config.label}
                              </p>
                              <p className="text-label-sm text-text-muted">
                                {record.duration} min •{" "}
                                {new Date(
                                  record.completedAt
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                          <span className="text-label-sm text-text-muted">
                            {new Date(record.date).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tips Card */}
          <div className="mt-6 page-frame p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-600 flex items-center justify-center text-white flex-shrink-0">
                ✦
              </div>
              <div>
                <h4 className="font-display mb-1">Pro Tip</h4>
                <p className="text-text-secondary text-body text-sm">
                  Take a 15-30 minute long break after completing 4 focus
                  sessions. Your brain needs time to consolidate learning!
                </p>
              </div>
            </div>
          </div>

          {/* Privacy Note */}
          <p className="mt-4 text-center text-label-sm text-text-muted flex items-center justify-center gap-1.5">
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
          </p>
        </div>
      </div>
    </div>
  );
}
