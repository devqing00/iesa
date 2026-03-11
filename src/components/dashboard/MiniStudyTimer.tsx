"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ─── Types & Config ─── */
type TimerMode = "focus" | "shortBreak" | "longBreak";

const MODE_CONFIG = {
  focus: { label: "Focus", bg: "bg-lavender", text: "text-lavender", stroke: "stroke-lavender" },
  shortBreak: { label: "Short", bg: "bg-teal", text: "text-teal", stroke: "stroke-teal" },
  longBreak: { label: "Long", bg: "bg-sunny", text: "text-sunny", stroke: "stroke-sunny" },
} as const;

const DURATIONS: Record<TimerMode, number> = { focus: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 };

const CIRCUMFERENCE = 2 * Math.PI * 44;

/* ─── Component ─── */
export default function MiniStudyTimer() {
  const [mode, setMode] = useState<TimerMode>("focus");
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleComplete = useCallback(() => {
    setIsRunning(false);
    // Play a short beep
    try {
      const ac = new AudioContext();
      const o = ac.createOscillator();
      o.connect(ac.destination);
      o.frequency.value = 800;
      o.start();
      setTimeout(() => o.stop(), 200);
    } catch { /* audio unsupported */ }

    if (mode === "focus") {
      setSessionsCompleted((p) => {
        const n = p + 1;
        if (n % 4 === 0) {
          setMode("longBreak");
          setTimeLeft(DURATIONS.longBreak);
        } else {
          setMode("shortBreak");
          setTimeLeft(DURATIONS.shortBreak);
        }
        return n;
      });
    } else {
      setMode("focus");
      setTimeLeft(DURATIONS.focus);
    }
  }, [mode]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    } else if (timeLeft === 0 && isRunning) {
      // Defer to avoid synchronous setState in effect body
      const id = setTimeout(handleComplete, 0);
      return () => clearTimeout(id);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timeLeft, handleComplete]);

  const switchMode = (m: TimerMode) => {
    setMode(m);
    setTimeLeft(DURATIONS[m]);
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const progress = (DURATIONS[mode] - timeLeft) / DURATIONS[mode];
  const cfg = MODE_CONFIG[mode];

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-1.5">
        {(Object.keys(MODE_CONFIG) as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 px-2 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
              mode === m
                ? `${MODE_CONFIG[m].bg} text-snow border-2 border-navy`
                : "bg-ghost text-slate border-2 border-cloud hover:border-navy"
            }`}
          >
            {MODE_CONFIG[m].label}
          </button>
        ))}
      </div>

      {/* Countdown ring */}
      <div className="flex flex-col items-center">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" strokeWidth="6" fill="none" className="stroke-cloud" />
            <circle
              cx="50"
              cy="50"
              r="44"
              strokeWidth="6"
              fill="none"
              className={cfg.stroke}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display font-black text-2xl text-navy tabular-nums">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
          </div>
        </div>
        <span className={`text-[10px] font-bold mt-1 ${cfg.text}`}>{cfg.label}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => {
            setTimeLeft(DURATIONS[mode]);
            setIsRunning(false);
          }}
          className="w-9 h-9 rounded-xl bg-ghost border-2 border-cloud flex items-center justify-center hover:border-navy transition-colors"
          aria-label="Reset timer"
        >
          <svg aria-hidden="true" className="w-4 h-4 text-slate" fill="currentColor" viewBox="0 0 24 24">
            <path
              fillRule="evenodd"
              d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903H14.25a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 .75-.75v-6a.75.75 0 0 0-1.5 0v3.068l-1.964-1.964A9 9 0 0 0 3.305 9.64a.75.75 0 1 0 1.45.418Zm14.49 3.882a.75.75 0 0 0-1.45-.418 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h4.956a.75.75 0 0 0 0-1.5h-6a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 1.5 0v-3.068l1.964 1.964A9 9 0 0 0 20.695 14.36a.75.75 0 0 0-.45-.418Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`w-12 h-12 rounded-2xl border-[3px] border-navy flex items-center justify-center transition-all press-2 press-navy ${
            isRunning ? "bg-coral text-snow" : "bg-lime text-navy"
          }`}
          aria-label={isRunning ? "Pause" : "Start"}
        >
          {isRunning ? (
            <svg aria-hidden="true" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg aria-hidden="true" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Session count */}
      <div className="text-center">
        <span className="text-[10px] font-bold text-slate uppercase tracking-wider">
          {sessionsCompleted} session{sessionsCompleted !== 1 ? "s" : ""} completed
        </span>
      </div>
    </div>
  );
}
