"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ─── Types & Config ─── */
type TimerMode = "focus" | "shortBreak" | "longBreak";
type TimerDurations = Record<TimerMode, number>;

const MODE_CONFIG = {
  focus: { label: "Focus", bg: "bg-lavender", text: "text-lavender", stroke: "stroke-lavender" },
  shortBreak: { label: "Short", bg: "bg-teal", text: "text-teal", stroke: "stroke-teal" },
  longBreak: { label: "Long", bg: "bg-sunny", text: "text-sunny", stroke: "stroke-sunny" },
} as const;

const SETTINGS_KEY = "iesa-mini-timer-settings";
const DEFAULT_DURATIONS_MINUTES: TimerDurations = { focus: 25, shortBreak: 5, longBreak: 15 };
const DURATION_LIMITS: Record<TimerMode, [number, number]> = {
  focus: [1, 90],
  shortBreak: [1, 30],
  longBreak: [1, 60],
};

function loadDurationSettings(): TimerDurations {
  if (typeof window === "undefined") return DEFAULT_DURATIONS_MINUTES;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_DURATIONS_MINUTES;
    const parsed = JSON.parse(raw) as Partial<TimerDurations>;
    return {
      focus: Number.isFinite(parsed.focus) ? Number(parsed.focus) : DEFAULT_DURATIONS_MINUTES.focus,
      shortBreak: Number.isFinite(parsed.shortBreak) ? Number(parsed.shortBreak) : DEFAULT_DURATIONS_MINUTES.shortBreak,
      longBreak: Number.isFinite(parsed.longBreak) ? Number(parsed.longBreak) : DEFAULT_DURATIONS_MINUTES.longBreak,
    };
  } catch {
    return DEFAULT_DURATIONS_MINUTES;
  }
}

const CIRCUMFERENCE = 2 * Math.PI * 44;

/* ─── Component ─── */
export default function MiniStudyTimer() {
  const [mode, setMode] = useState<TimerMode>("focus");
  const [durationSettings, setDurationSettings] = useState<TimerDurations>(() => loadDurationSettings());
  const [timeLeft, setTimeLeft] = useState(() => loadDurationSettings().focus * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [draftDurations, setDraftDurations] = useState<Record<TimerMode, string>>(() => {
    const initial = loadDurationSettings();
    return {
      focus: String(initial.focus),
      shortBreak: String(initial.shortBreak),
      longBreak: String(initial.longBreak),
    };
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getDurationSeconds = useCallback(
    (timerMode: TimerMode) => (durationSettings[timerMode] || DEFAULT_DURATIONS_MINUTES[timerMode]) * 60,
    [durationSettings],
  );

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(durationSettings));
  }, [durationSettings]);

  const playCompletionTune = useCallback((completedMode: TimerMode) => {
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const context = new AudioCtx();
      const masterGain = context.createGain();
      masterGain.connect(context.destination);
      masterGain.gain.setValueAtTime(0.0001, context.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.05);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 3.2);

      const pattern =
        completedMode === "focus"
          ? [523.25, 659.25, 783.99, 659.25, 880]
          : completedMode === "shortBreak"
            ? [659.25, 587.33, 659.25, 783.99]
            : [440, 523.25, 659.25, 783.99, 659.25, 523.25];

      const noteDuration = 0.38;
      const noteGap = 0.06;
      const startAt = context.currentTime + 0.02;

      pattern.forEach((frequency, index) => {
        const osc = context.createOscillator();
        const gainNode = context.createGain();
        osc.type = "sine";
        osc.frequency.value = frequency;
        osc.connect(gainNode);
        gainNode.connect(masterGain);

        const noteStart = startAt + index * (noteDuration + noteGap);
        const noteEnd = noteStart + noteDuration;

        gainNode.gain.setValueAtTime(0.0001, noteStart);
        gainNode.gain.exponentialRampToValueAtTime(0.7, noteStart + 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

        osc.start(noteStart);
        osc.stop(noteEnd + 0.02);
      });

      const closeAfter = startAt + pattern.length * (noteDuration + noteGap) + 0.4;
      window.setTimeout(() => {
        context.close().catch(() => undefined);
      }, Math.ceil((closeAfter - context.currentTime) * 1000));
    } catch {
      /* audio unsupported */
    }
  }, []);

  const handleComplete = useCallback(() => {
    setIsRunning(false);
    playCompletionTune(mode);

    if (mode === "focus") {
      setSessionsCompleted((p) => {
        const n = p + 1;
        if (n % 4 === 0) {
          setMode("longBreak");
          setTimeLeft(getDurationSeconds("longBreak"));
        } else {
          setMode("shortBreak");
          setTimeLeft(getDurationSeconds("shortBreak"));
        }
        return n;
      });
    } else {
      setMode("focus");
      setTimeLeft(getDurationSeconds("focus"));
    }
  }, [mode, playCompletionTune, getDurationSeconds]);

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
    setTimeLeft(getDurationSeconds(m));
    setIsRunning(false);
    setShowSettings(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const applyDurationChange = (targetMode: TimerMode, value: string) => {
    setDraftDurations((prev) => ({ ...prev, [targetMode]: value }));
    const parsed = parseInt(value, 10);
    const [min, max] = DURATION_LIMITS[targetMode];
    if (Number.isNaN(parsed) || parsed < min || parsed > max) return;

    setDurationSettings((prev) => ({ ...prev, [targetMode]: parsed }));
    if (!isRunning && mode === targetMode) {
      setTimeLeft(parsed * 60);
    }
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const totalSeconds = getDurationSeconds(mode);
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
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

      {/* Quick duration settings */}
      <div className="bg-ghost border-2 border-cloud rounded-xl">
        <button
          onClick={() => setShowSettings((prev) => !prev)}
          className="w-full px-3 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.08em] text-slate hover:text-navy transition-colors"
          aria-label="Toggle timer duration settings"
        >
          <span>Durations</span>
          <span className="text-[9px] text-navy-muted">
            {durationSettings.focus}/{durationSettings.shortBreak}/{durationSettings.longBreak}m
          </span>
        </button>
        {showSettings && (
          <div className="px-3 pb-3 grid grid-cols-3 gap-2">
            {(
              [
                { key: "focus", label: "Focus" },
                { key: "shortBreak", label: "Short" },
                { key: "longBreak", label: "Long" },
              ] as const
            ).map(({ key, label }) => {
              const [min, max] = DURATION_LIMITS[key];
              const currentValue = parseInt(draftDurations[key], 10);
              const isValid = !Number.isNaN(currentValue) && currentValue >= min && currentValue <= max;
              return (
                <label key={key} className="space-y-1">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-slate">{label}</span>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={draftDurations[key]}
                    onChange={(e) => applyDurationChange(key, e.target.value)}
                    className={`w-full h-8 px-2 rounded-lg border-2 bg-snow text-xs font-bold text-navy focus:outline-none ${isValid ? "border-navy" : "border-coral"}`}
                  />
                </label>
              );
            })}
          </div>
        )}
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
              className={`${cfg.stroke} timer-progress-circle`}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
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
            setTimeLeft(getDurationSeconds(mode));
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
