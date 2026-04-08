"use client";

import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { toast } from "sonner";
import {
  listQuizzes,
  getQuiz,
  submitQuizAnswers,
  getQuizSystemLeaderboard,
  getWsUrl,
  joinLiveQuiz,
  setLiveQuizReadyState,
  getLiveQuizState,
  getLiveQuizLeaderboard,
  submitLiveQuizAnswer,
  QUIZ_TYPE_LABELS,
  PHASE_LABELS,
} from "@/lib/api";
import type {
  IepodQuiz,
  QuizQuestionPublic,
  QuizResult,
  QuizAnswer,
  QuizSystemLeaderboardEntry,
  LiveQuizState,
  LiveQuizWsPacket,
  LiveLeaderboardItem,
} from "@/lib/api";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

type View = "list" | "quiz" | "result" | "leaderboard" | "live";

interface LiveSoundSettings {
  muted: boolean;
}

function resolveConfettiModule(mod: unknown): ((options: Record<string, unknown>) => void) | null {
  const candidate = mod as { default?: unknown };
  if (typeof candidate?.default === "function") {
    return candidate.default as (options: Record<string, unknown>) => void;
  }
  if (typeof mod === "function") {
    return mod as (options: Record<string, unknown>) => void;
  }
  return null;
}

function OptionGlyph({ index, className }: { index: number; className?: string }) {
  const shared = className || "w-4 h-4";
  if (index % 4 === 0) {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={shared} fill="currentColor">
        <circle cx="10" cy="10" r="7" />
      </svg>
    );
  }
  if (index % 4 === 1) {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={shared} fill="currentColor">
        <path d="M10 3L17 16H3L10 3Z" />
      </svg>
    );
  }
  if (index % 4 === 2) {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={shared} fill="currentColor">
        <rect x="4" y="4" width="12" height="12" rx="2" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={shared} fill="currentColor">
      <path d="M10 2L17 10L10 18L3 10L10 2Z" />
    </svg>
  );
}

function optionMarkerPalette(index: number) {
  if (index % 4 === 0) return "bg-coral-light text-coral border-coral/40";
  if (index % 4 === 1) return "bg-lime-light text-lime-dark border-lime/50";
  if (index % 4 === 2) return "bg-lavender-light text-lavender border-lavender/50";
  return "bg-sunny-light text-sunny border-sunny/50";
}

export default function QuizzesPage() {
  const { user, getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("iepod-quizzes");
  const [view, setView] = useState<View>("list");
  const [quizzes, setQuizzes] = useState<IepodQuiz[]>([]);
  const [leaderboard, setLeaderboard] = useState<QuizSystemLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Active quiz state
  const [activeQuiz, setActiveQuiz] = useState<IepodQuiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [answerResponseMs, setAnswerResponseMs] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // seconds remaining
  const submitRef = useRef<() => void>(() => {});
  const questionStartedAtRef = useRef<number>(Date.now());

  // Result state
  const [result, setResult] = useState<QuizResult | null>(null);
  const [liveJoinCode, setLiveJoinCode] = useState("");
  const [liveState, setLiveState] = useState<LiveQuizState | null>(null);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LiveLeaderboardItem[]>([]);
  const [liveRankMovementByUser, setLiveRankMovementByUser] = useState<Record<string, number>>({});
  const [liveMovementRoundIndex, setLiveMovementRoundIndex] = useState<number>(-1);
  const [liveAnswerResultByQuestion, setLiveAnswerResultByQuestion] = useState<Record<number, { selectedOption: number; isCorrect: boolean; pointsAwarded: number }>>({});
  const [liveSelectedOptionByQuestion, setLiveSelectedOptionByQuestion] = useState<Record<number, number>>({});
  const [liveAnsweredQuestionIndex, setLiveAnsweredQuestionIndex] = useState<number | null>(null);
  const [liveJoining, setLiveJoining] = useState(false);
  const [liveReadyMarked, setLiveReadyMarked] = useState(false);
  const [liveReadySubmitting, setLiveReadySubmitting] = useState(false);
  const [liveSubmitting, setLiveSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveRemainingSeconds, setLiveRemainingSeconds] = useState(0);
  const [showFinalPodium, setShowFinalPodium] = useState(false);
  const [joinPopups, setJoinPopups] = useState<Array<{ id: string; label: string; x: number; y: number; tone: "teal" | "coral" | "lavender" | "sunny" }>>([]);
  const [liveParticipantsCount, setLiveParticipantsCount] = useState(0);
  const [lateJoinCatchup, setLateJoinCatchup] = useState<{ questionIndex: number; dismissible: boolean } | null>(null);
  const [livePhasePulse, setLivePhasePulse] = useState(false);
  const [livePhaseSplash, setLivePhaseSplash] = useState<{ title: string; subtitle: string } | null>(null);
  const [liveDisplayPhase, setLiveDisplayPhase] = useState<string>("waiting");
  const [liveLeaderboardTransitionTick, setLiveLeaderboardTransitionTick] = useState(0);
  const [liveWsStatus, setLiveWsStatus] = useState<"connecting" | "open" | "closed">("closed");
  const liveWsRef = useRef<WebSocket | null>(null);
  const liveReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveCancelledRef = useRef(false);
  const liveQuestionIndexRef = useRef(-1);
  const liveResumeAttemptedRef = useRef(false);
  const livePhaseRef = useRef<string>("waiting");
  const liveStateVersionRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const previousRanksRef = useRef<Record<string, number>>({});
  const previousScoreRef = useRef<Record<string, number>>({});
  const [liveDisplayedScoreByUser, setLiveDisplayedScoreByUser] = useState<Record<string, number>>({});
  const leaderboardRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previousRowTopRef = useRef<Record<string, number>>({});
  const [liveSoundSettings, setLiveSoundSettings] = useState<LiveSoundSettings>({
    muted: false,
  });

  const LIVE_JOIN_CODE_STORAGE_KEY = "iepod_live_join_code";
  const livePhaseEnteredAtRef = useRef<number>(Date.now());
  const liveSeenParticipantIdsRef = useRef<Set<string>>(new Set());
  const liveLastSplashKeyRef = useRef<string>("");
  const liveScoreAnimSignatureRef = useRef<string>("");
  const revealSeenByQuestionRef = useRef<Set<number>>(new Set());
  const [preRevealQuestionIndex, setPreRevealQuestionIndex] = useState<number | null>(null);
  const liveIntermissionSecondsRef = useRef<number>(8);
  const liveSplashHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiBurstKeyRef = useRef<string>("");
  const confettiRef = useRef<((options: Record<string, unknown>) => void) | null>(null);
  const [confettiReady, setConfettiReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void import("canvas-confetti")
      .then((mod) => {
        if (mounted) {
          const resolved = resolveConfettiModule(mod);
          confettiRef.current = resolved;
          setConfettiReady(Boolean(resolved));
        }
      })
      .catch(() => {
        confettiRef.current = null;
        setConfettiReady(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    liveIntermissionSecondsRef.current = liveState?.intermissionSeconds ?? 8;
  }, [liveState?.intermissionSeconds]);

  const liveTopTen = useMemo(() => {
    const stateWithLeaderboard = liveState as (LiveQuizState & { leaderboard?: LiveLeaderboardItem[] }) | null;
    const source = liveLeaderboard.length > 0 ? liveLeaderboard : (stateWithLeaderboard?.leaderboard || []);
    return source.slice(0, 10);
  }, [liveLeaderboard, liveState]);

  const deriveLiveServerPhase = useCallback((state: LiveQuizState | null): "waiting" | "question_intro" | "question_answering" | "answer_reveal" | "leaderboard_reveal" | "ended" => {
    if (!state) return "waiting";
    if (state.phase) return state.phase;
    if (state.questionPhase === "reveal") return "answer_reveal";
    if (state.questionPhase === "leaderboard") return "leaderboard_reveal";
    if (state.questionPhase === "question") return "question_answering";
    if (state.questionPhase === "ended" || state.status === "ended") return "ended";
    if (state.questionPhase === "waiting" || state.status === "waiting") return "waiting";
    return "waiting";
  }, []);

  const deriveLivePhase = useCallback((state: LiveQuizState | null): string => {
    const phase = deriveLiveServerPhase(state);
    if (phase === "question_intro" || phase === "question_answering") return "question";
    if (phase === "answer_reveal") return "reveal";
    if (phase === "leaderboard_reveal") return "leaderboard";
    if (phase === "ended") return "ended";
    return "waiting";
  }, [deriveLiveServerPhase]);

  const getPhaseRemainingSeconds = useCallback((state: LiveQuizState | null): number => {
    if (!state) return 0;
    if (state.phaseEndsAt) {
      const endsAtMs = new Date(state.phaseEndsAt).getTime();
      if (Number.isFinite(endsAtMs)) {
        return Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000));
      }
    }
    return Math.max(0, state.phaseRemainingSeconds ?? state.remainingSeconds ?? 0);
  }, []);

  const applyIncomingLiveState = useCallback((nextState: LiveQuizState) => {
    const nextVersion = Number(nextState.stateVersion ?? 0);
    if (nextVersion > 0) {
      if (nextVersion < liveStateVersionRef.current) return false;
      liveStateVersionRef.current = nextVersion;
    }
    setLiveState(nextState);
    return true;
  }, []);

  const currentUserLiveRank = useMemo(() => {
    const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim().toLowerCase();
    const candidates = [
      user?.id,
      (user as unknown as { _id?: string } | null)?._id,
      (user as unknown as { uid?: string } | null)?.uid,
    ].filter((value): value is string => Boolean(value));
    const mine = liveTopTen.find((entry) => candidates.includes(entry.userId))
      || liveTopTen.find((entry) => fullName.length > 0 && entry.userName.trim().toLowerCase() === fullName);
    return mine?.rank ?? null;
  }, [user, liveTopTen]);

  useEffect(() => {
    if (view !== "live" || !liveState) return;
    if (liveState.status !== "ended" || !showFinalPodium) return;

    const burstKey = `${liveState.joinCode}:${liveState.currentQuestionIndex}:podium`;
    if (confettiBurstKeyRef.current === burstKey) return;
    confettiBurstKeyRef.current = burstKey;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const endAt = Date.now() + 1600;
    const colors = ["#F5D547", "#E07A5F", "#7A5AF8", "#17B890", "#0F0F2D"];

    const runBurst = () => {
      if (!confettiRef.current) return;
      const fire = () => {
        confettiRef.current?.({
          particleCount: 90,
          spread: 90,
          startVelocity: 38,
          origin: { x: 0.2 + Math.random() * 0.6, y: 0.2 + Math.random() * 0.2 },
          colors,
        });
      };

      fire();
      timer = setInterval(() => {
        if (Date.now() >= endAt) {
          if (timer) clearInterval(timer);
          timer = null;
          return;
        }
        fire();
      }, 320);
    };

    const ensureAndBurst = async () => {
      if (!confettiRef.current) {
        try {
          const mod = await import("canvas-confetti");
          const resolved = resolveConfettiModule(mod);
          confettiRef.current = resolved;
          setConfettiReady(Boolean(resolved));
        } catch {
          confettiRef.current = null;
          setConfettiReady(false);
        }
      }

      if (!cancelled) runBurst();
    };

    void ensureAndBurst();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [view, liveState, showFinalPodium, confettiReady]);

  useEffect(() => {
    if (view !== "result" || !result) return;
    if (result.percentage < 70) return;

    const fire = confettiRef.current;
    if (!fire) return;
    fire({
      particleCount: 70,
      spread: 80,
      startVelocity: 35,
      origin: { x: 0.5, y: 0.35 },
      colors: ["#F5D547", "#17B890", "#7A5AF8", "#E07A5F", "#0F0F2D"],
    });
  }, [view, result]);

  const applyLeaderboardSnapshot = useCallback((items: LiveLeaderboardItem[]) => {
    const previous = previousRanksRef.current;
    const movement: Record<string, number> = {};
    items.forEach((item) => {
      const priorRank = previous[item.userId];
      if (typeof priorRank === "number") {
        movement[item.userId] = priorRank - item.rank;
      }
    });
    previousRanksRef.current = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.userId] = item.rank;
      return acc;
    }, {});
    setLiveRankMovementByUser(movement);
    setLiveLeaderboard(items);
  }, []);

  useEffect(() => {
    if (view !== "live") {
      setLiveRankMovementByUser({});
      return;
    }
    const phase = deriveLivePhase(liveState);
    if (phase !== "leaderboard") {
      setLiveRankMovementByUser({});
      return;
    }
    if ((liveState?.currentQuestionIndex ?? -1) !== liveMovementRoundIndex) {
      setLiveMovementRoundIndex(liveState?.currentQuestionIndex ?? -1);
      setLiveRankMovementByUser({});
    }
  }, [view, liveState, liveMovementRoundIndex, deriveLivePhase]);

  useEffect(() => {
    if (liveLeaderboard.length === 0) return;
    const nextByUser = liveLeaderboard.reduce<Record<string, number>>((acc, row) => {
      acc[row.userId] = row.totalScore;
      return acc;
    }, {});
    const signature = liveLeaderboard.map((row) => `${row.userId}:${row.totalScore}`).join("|");
    if (signature === liveScoreAnimSignatureRef.current) return;
    liveScoreAnimSignatureRef.current = signature;

    const startByUser = { ...previousScoreRef.current };
    const start = Date.now();
    const durationMs = 550;
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / durationMs);
      setLiveDisplayedScoreByUser(() => {
        const frame: Record<string, number> = {};
        Object.keys(nextByUser).forEach((userId) => {
          const from = startByUser[userId] ?? nextByUser[userId];
          const to = nextByUser[userId];
          frame[userId] = Math.round(from + (to - from) * p);
        });
        return frame;
      });
      if (p >= 1) {
        clearInterval(timer);
        previousScoreRef.current = nextByUser;
      }
    }, 16);
    return () => clearInterval(timer);
  }, [liveLeaderboard]);

  useLayoutEffect(() => {
    if (view !== "live" || liveTopTen.length === 0) return;

    const currentPositions: Record<string, number> = {};
    liveTopTen.forEach((item) => {
      const el = leaderboardRowRefs.current[item.userId];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      currentPositions[item.userId] = rect.top;
      const previousTop = previousRowTopRef.current[item.userId];
      if (typeof previousTop === "number") {
        const deltaY = previousTop - rect.top;
        if (Math.abs(deltaY) > 1) {
          el.style.transition = "transform 0s";
          el.style.transform = `translateY(${deltaY}px)`;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.transition = "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)";
              el.style.transform = "translateY(0)";
            });
          });
        }
      }
    });

    previousRowTopRef.current = currentPositions;
  }, [view, liveTopTen, liveState?.currentQuestionIndex, liveState?.questionPhase, liveDisplayPhase]);

  useEffect(() => {
    const visible = new Set(liveTopTen.map((row) => row.userId));
    Object.keys(leaderboardRowRefs.current).forEach((userId) => {
      if (!visible.has(userId)) {
        delete leaderboardRowRefs.current[userId];
        delete previousRowTopRef.current[userId];
      }
    });
  }, [liveTopTen]);

  useEffect(() => {
    if (!liveState?.status || view !== "live") return;
    const nextPhase = deriveLivePhase(liveState);

    livePhaseEnteredAtRef.current = Date.now();
    setLiveDisplayPhase((prev) => {
      if (prev === nextPhase) return prev;
      if (nextPhase === "leaderboard") {
        setLiveLeaderboardTransitionTick((tick) => tick + 1);
      }
      return nextPhase;
    });
  }, [view, liveState, liveDisplayPhase, deriveLivePhase]);

  useEffect(() => {
    if (view !== "live" || !liveState || liveState.status !== "live") {
      setPreRevealQuestionIndex(null);
      return;
    }

    const qIndex = liveState.currentQuestionIndex;
    const phase = deriveLivePhase(liveState);

    if (phase === "reveal") {
      revealSeenByQuestionRef.current.add(qIndex);
      setPreRevealQuestionIndex((prev) => (prev === qIndex ? null : prev));
      return;
    }

    const shouldPrimeReveal = phase === "leaderboard" && !revealSeenByQuestionRef.current.has(qIndex);
    if (!shouldPrimeReveal) {
      setPreRevealQuestionIndex((prev) => (prev === qIndex ? null : prev));
      return;
    }

    setPreRevealQuestionIndex(qIndex);
  }, [view, liveState, deriveLivePhase]);

  useEffect(() => {
    if (view !== "live") {
      revealSeenByQuestionRef.current = new Set();
      setPreRevealQuestionIndex(null);
      return;
    }

    const joinCode = liveState?.joinCode || "";
    const currentQuestionIndex = liveState?.currentQuestionIndex ?? -1;
    const status = liveState?.status;
    if (!joinCode || status === "waiting" || currentQuestionIndex < 0) {
      revealSeenByQuestionRef.current = new Set();
      setPreRevealQuestionIndex(null);
    }
  }, [view, liveState?.joinCode, liveState?.status, liveState?.currentQuestionIndex]);

  // Keep submitRef current so timer callback always calls latest handleSubmitQuiz
  useEffect(() => { submitRef.current = () => handleSubmitQuiz(true); });

  // ── Quiz Countdown Timer ──
  useEffect(() => {
    if (view !== "quiz" || !activeQuiz?.timeLimitMinutes) { setTimeLeft(null); return; }
    setTimeLeft(activeQuiz.timeLimitMinutes * 60);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          toast.error("Time's up! Submitting your answers.");
          submitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [view, activeQuiz]);

  // ── Beforeunload guard during quiz ──
  useEffect(() => {
    if (view !== "quiz") return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [view]);

  useEffect(() => {
    liveQuestionIndexRef.current = liveState?.currentQuestionIndex ?? -1;
    const phase = deriveLivePhase(liveState);
    const nextRemaining = getPhaseRemainingSeconds(liveState);
    setLiveRemainingSeconds(nextRemaining);
    livePhaseRef.current = phase;
  }, [liveState, deriveLivePhase, getPhaseRemainingSeconds]);

  useEffect(() => {
    if (liveState?.status !== "ended") {
      setShowFinalPodium(false);
      return;
    }
    // Final podium should be host-triggered from admin after session end.
    const stateWithPodium = liveState as (LiveQuizState & { finalPodiumRevealed?: boolean }) | null;
    setShowFinalPodium(Boolean(stateWithPodium?.finalPodiumRevealed || deriveLivePhase(liveState) === "reveal"));
  }, [liveState, deriveLivePhase]);

  useEffect(() => {
    if (view !== "live" || !liveState) return;
    const nextCount = liveState.participantsCount || 0;
    const prevCount = liveParticipantsCount;
    if (nextCount <= prevCount) {
      setLiveParticipantsCount(nextCount);
      return;
    }

    const addCount = Math.min(4, nextCount - prevCount);
    const tones: Array<"teal" | "coral" | "lavender" | "sunny"> = ["teal", "coral", "lavender", "sunny"];
    const popups = Array.from({ length: addCount }).map((_, idx) => {
      const number = nextCount - idx;
      return {
        id: `${Date.now()}-${number}-${idx}`,
        label: `P${number}`,
        x: 8 + Math.random() * 78,
        y: 30 + Math.random() * 48,
        tone: tones[(number + idx) % tones.length],
      };
    });

    setJoinPopups((existing) => [...existing, ...popups]);
    popups.forEach((popup) => {
      setTimeout(() => {
        setJoinPopups((existing) => existing.filter((item) => item.id !== popup.id));
      }, 3600);
    });
    setLiveParticipantsCount(nextCount);
  }, [view, liveState, liveParticipantsCount]);

  useEffect(() => {
    const phase = deriveLivePhase(liveState);
    if (livePhaseRef.current !== phase) {
      livePhaseRef.current = phase;
      setLivePhasePulse(true);
      const timer = setTimeout(() => setLivePhasePulse(false), 700);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [liveState, deriveLivePhase]);

  useEffect(() => {
    if (!liveState || view !== "live") return;
    if (liveDisplayPhase !== "reveal") return;
    const questionIndex = liveState.currentQuestionIndex;
    const selectedOption = liveSelectedOptionByQuestion[questionIndex];
    if (selectedOption === undefined) return;
    const existing = liveAnswerResultByQuestion[questionIndex];
    if (existing?.isCorrect !== undefined) return;
    if (typeof liveState.question?.correctIndex !== "number") return;

    const inferredCorrect = selectedOption === liveState.question.correctIndex;
    setLiveAnswerResultByQuestion((prev) => ({
      ...prev,
      [questionIndex]: {
        selectedOption,
        isCorrect: inferredCorrect,
        pointsAwarded: prev[questionIndex]?.pointsAwarded ?? 0,
      },
    }));
  }, [view, liveDisplayPhase, liveState, liveSelectedOptionByQuestion, liveAnswerResultByQuestion]);

  useEffect(() => {
    if (view !== "live" || !liveState) {
      liveLastSplashKeyRef.current = "";
      setLivePhaseSplash(null);
      if (liveSplashHideTimerRef.current) {
        clearTimeout(liveSplashHideTimerRef.current);
        liveSplashHideTimerRef.current = null;
      }
      return;
    }

    const effectivePhase = liveDisplayPhase || deriveLivePhase(liveState);
    const questionNumber = Math.max(0, liveState.currentQuestionIndex + 1);
    let title = "";
    let subtitle = "";
    let cue = "";

    if (effectivePhase === "question") {
      title = `Question ${questionNumber}`;
      subtitle = "Answer window is opening";
      cue = "question_intro";
    } else if (effectivePhase === "leaderboard") {
      title = "Leaderboard";
      subtitle = "Scores are settling";
      cue = "leaderboard_break";
    } else if (effectivePhase === "reveal") {
      title = "Reveal";
      subtitle = "Let us break this one down";
      cue = "reveal";
    } else {
      return;
    }

    const splashKey = `${effectivePhase}:${liveState.currentQuestionIndex}`;
    if (liveLastSplashKeyRef.current === splashKey) {
      return;
    }
    liveLastSplashKeyRef.current = splashKey;

    setLivePhaseSplash({ title, subtitle });
    if (liveSplashHideTimerRef.current) {
      clearTimeout(liveSplashHideTimerRef.current);
    }
    liveSplashHideTimerRef.current = setTimeout(() => {
      setLivePhaseSplash(null);
      liveSplashHideTimerRef.current = null;
    }, 950);

    const triggerCue = () => {
      window.dispatchEvent(new CustomEvent("iepod-live-cue", { detail: { cue, phase: effectivePhase, questionIndex: liveState.currentQuestionIndex } }));
      if (liveSoundSettings.muted) return;
      try {
        const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") {
          void ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = effectivePhase === "reveal" ? "triangle" : "sine";
        osc.frequency.value = effectivePhase === "question"
          ? 740
          : effectivePhase === "leaderboard"
            ? 560
            : 920;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        const peak = 0.06;
        gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
      } catch {
        // Audio cues are optional and should never disrupt gameplay.
      }
    };

    triggerCue();

  }, [view, liveState, liveDisplayPhase, liveSoundSettings.muted, deriveLivePhase]);

  useEffect(() => {
    return () => {
      if (liveSplashHideTimerRef.current) {
        clearTimeout(liveSplashHideTimerRef.current);
        liveSplashHideTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (view !== "live" || !liveState?.joinCode) {
      setLiveWsStatus("closed");
      return;
    }

    liveCancelledRef.current = false;

    const connectWS = async (retryToken?: string) => {
      if (liveCancelledRef.current) return;
      const token = retryToken ?? (await getAccessToken());
      if (!token || liveCancelledRef.current) return;

      const wsUrl = getWsUrl(
        `/api/v1/iepod/quizzes/live/${encodeURIComponent(liveState.joinCode)}/ws?token=${encodeURIComponent(token)}`,
      );
      const ws = new WebSocket(wsUrl);
      liveWsRef.current = ws;
      setLiveWsStatus("connecting");

      ws.onopen = () => {
        setLiveWsStatus("open");
        if (liveHeartbeatRef.current) clearInterval(liveHeartbeatRef.current);
        liveHeartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data) as LiveQuizWsPacket;
          if (packet.type !== "live_state" || !packet.data) return;
          if (!applyIncomingLiveState(packet.data)) return;

          if (packet.data.currentQuestionIndex !== liveQuestionIndexRef.current) {
            if (packet.data.currentQuestionIndex > -1) {
              setLiveAnsweredQuestionIndex(null);
            }
          }

          if (Array.isArray(packet.data.leaderboard)) {
            applyLeaderboardSnapshot(packet.data.leaderboard);
          }
        } catch {
          // Ignore malformed packets to keep gameplay uninterrupted.
        }
      };

      ws.onclose = () => {
        setLiveWsStatus("closed");
        if (liveHeartbeatRef.current) {
          clearInterval(liveHeartbeatRef.current);
          liveHeartbeatRef.current = null;
        }
        if (!liveCancelledRef.current) {
          liveReconnectRef.current = setTimeout(() => {
            void connectWS();
          }, 3000);
        }
      };

      ws.onerror = () => ws.close();
    };

    void connectWS();

    return () => {
      liveCancelledRef.current = true;
      if (liveReconnectRef.current) clearTimeout(liveReconnectRef.current);
      if (liveHeartbeatRef.current) clearInterval(liveHeartbeatRef.current);
      if (liveWsRef.current) {
        liveWsRef.current.onclose = null;
        liveWsRef.current.close();
        liveWsRef.current = null;
      }
    };
  }, [view, liveState?.joinCode, getAccessToken, applyLeaderboardSnapshot, applyIncomingLiveState]);

  useEffect(() => {
    if (view !== "live" || !liveState?.joinCode) return;
    if (liveWsStatus === "open") return;

    let cancelled = false;
    const hydrateLiveState = async () => {
      try {
        const state = await getLiveQuizState(liveState.joinCode, { showErrorToast: false, timeout: 12000 });
        if (!cancelled) {
          applyIncomingLiveState(state);
          if (Array.isArray((state as LiveQuizState & { leaderboard?: LiveLeaderboardItem[] }).leaderboard)) {
            applyLeaderboardSnapshot(((state as LiveQuizState & { leaderboard?: LiveLeaderboardItem[] }).leaderboard || []));
          }
        }
      } catch {
        // Ignore transient polling failures; websocket updates remain active.
      }
    };

    void hydrateLiveState();
    const timer = setInterval(() => {
      void hydrateLiveState();
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [view, liveState?.joinCode, liveWsStatus, applyLeaderboardSnapshot, applyIncomingLiveState]);

  useEffect(() => {
    if (view !== "live" || liveState?.status !== "live") return;
    const timer = setInterval(() => {
      setLiveRemainingSeconds(getPhaseRemainingSeconds(liveState));
    }, 1000);
    return () => clearInterval(timer);
  }, [view, liveState, getPhaseRemainingSeconds]);

  useEffect(() => {
    const snapshotLeaderboard = (liveState as (LiveQuizState & { leaderboard?: LiveLeaderboardItem[] }) | null)?.leaderboard;
    if (!Array.isArray(snapshotLeaderboard) || snapshotLeaderboard.length === 0) return;
    applyLeaderboardSnapshot(snapshotLeaderboard);
  }, [liveState, applyLeaderboardSnapshot]);

  useEffect(() => {
    if (view !== "live" || !liveState?.joinCode) return;
    if (liveWsStatus === "open") return;

    let cancelled = false;
    const hydrateLeaderboard = async () => {
      try {
        const lb = await getLiveQuizLeaderboard(liveState.joinCode, 20, { showErrorToast: false, timeout: 12000 });
        if (!cancelled) applyLeaderboardSnapshot(lb.items || []);
      } catch {
        // Keep UI non-blocking if leaderboard refresh fails temporarily.
      }
    };

    void hydrateLeaderboard();
    const interval = setInterval(() => {
      void hydrateLeaderboard();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [view, liveState?.joinCode, liveWsStatus, liveState?.questionPhase, liveState?.status, liveState?.currentQuestionIndex, applyLeaderboardSnapshot]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!user || liveResumeAttemptedRef.current) return;
    liveResumeAttemptedRef.current = true;
    const storedJoinCode = window.localStorage.getItem(LIVE_JOIN_CODE_STORAGE_KEY);
    if (!storedJoinCode) return;

    let cancelled = false;
    const resumeLiveArena = async () => {
      try {
        const state = await getLiveQuizState(storedJoinCode, { showErrorToast: false, timeout: 12000 });
        if (cancelled) return;
        if (state.status === "ended") {
          window.localStorage.removeItem(LIVE_JOIN_CODE_STORAGE_KEY);
          return;
        }
        setLiveJoinCode(storedJoinCode);
        applyIncomingLiveState(state);
        setLiveDisplayPhase(deriveLivePhase(state));
        setLiveLeaderboard([]);
        previousRanksRef.current = {};
        setLiveRemainingSeconds(getPhaseRemainingSeconds(state));
        setLiveAnsweredQuestionIndex(null);
        setLiveSelectedOptionByQuestion({});
        setLiveAnswerResultByQuestion({});
        setLiveReadyMarked(false);
        setLiveParticipantsCount(state.participantsCount || 0);
        liveSeenParticipantIdsRef.current = new Set();
        setView("live");
        setLiveWsStatus("connecting");
      } catch {
        window.localStorage.removeItem(LIVE_JOIN_CODE_STORAGE_KEY);
      }
    };

    void resumeLiveArena();
    return () => {
      cancelled = true;
    };
  }, [user, deriveLivePhase, applyIncomingLiveState, getPhaseRemainingSeconds]);

  const fetchData = useCallback(async () => {
    try {
      const [quizzesRes, lbRes] = await Promise.allSettled([
        listQuizzes(undefined, { showErrorToast: false, timeout: 12000 }),
        getQuizSystemLeaderboard(50, { showErrorToast: false, timeout: 12000 }),
      ]);

      if (quizzesRes.status === "fulfilled") {
        setQuizzes(Array.isArray(quizzesRes.value) ? quizzesRes.value : []);
      }
      if (lbRes.status === "fulfilled") {
        setLeaderboard(Array.isArray(lbRes.value) ? lbRes.value : []);
      }

      if (quizzesRes.status === "rejected" && lbRes.status === "rejected") {
        toast.error("Could not refresh quiz data right now. Please retry shortly.");
      }
    } catch {
      toast.error("Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const liveQuizzes = useMemo(
    () => quizzes.filter((q) => q.activeLiveJoinCode || q.quizType === "live"),
    [quizzes],
  );

  const practiceQuizzes = useMemo(
    () => quizzes.filter((q) => q.quizType !== "live"),
    [quizzes],
  );

  async function handleStartQuiz(quizId: string) {
    try {
      const data = await getQuiz(quizId);

      // Check if already taken
      if ("alreadyTaken" in data && data.alreadyTaken) {
        setResult(data.result);
        setView("result");
        return;
      }

      // Quiz with questions
      if ("questions" in data && Array.isArray(data.questions)) {
        setActiveQuiz(data as IepodQuiz);
        setQuestions(data.questions as QuizQuestionPublic[]);
        setCurrentQ(0);
        setAnswers({});
        setAnswerResponseMs({});
        questionStartedAtRef.current = Date.now();
        setView("quiz");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load quiz");
    }
  }

  async function handleSubmitQuiz(force = false) {
    if (!activeQuiz) return;

    const quizId = activeQuiz._id || activeQuiz.id;
    if (!quizId) return;

    // Build answers array
    const answersList: QuizAnswer[] = questions.map((q, i) => ({
      questionIndex: q.index ?? i,
      selectedOption: answers[i] ?? -1,
      responseMs: answerResponseMs[i],
    }));

    const unanswered = answersList.filter((a) => a.selectedOption === -1).length;
    if (!force && unanswered > 0) {
      toast.error(`${unanswered} question${unanswered > 1 ? "s" : ""} unanswered. Please answer all questions.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitQuizAnswers(quizId, answersList);
      setResult(res);
      try {
        const latest = await getQuizSystemLeaderboard(50);
        setLeaderboard(latest);
      } catch {
        // Keep result flow non-blocking if leaderboard refresh fails.
      }
      setView("result");
      toast.success(`Quiz completed! Score: ${res.score}/${res.maxScore}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  }

  function selectAnswer(questionIdx: number, optionIdx: number) {
    setAnswers({ ...answers, [questionIdx]: optionIdx });
    setAnswerResponseMs((prev) => {
      if (typeof prev[questionIdx] === "number") return prev;
      return {
        ...prev,
        [questionIdx]: Math.max(0, Date.now() - questionStartedAtRef.current),
      };
    });
  }

  function moveToQuestion(nextIndex: number) {
    setCurrentQ(nextIndex);
    questionStartedAtRef.current = Date.now();
  }

  async function handleJoinLiveArena() {
    if (liveJoining) return;
    if (!liveJoinCode.trim()) {
      toast.error("Enter a join code");
      return;
    }
    setLiveJoining(true);
    try {
      const joined = await joinLiveQuiz(liveJoinCode.trim().toUpperCase());
      const state = await getLiveQuizState(joined.joinCode, { showErrorToast: false, timeout: 12000 });
      window.localStorage.setItem(LIVE_JOIN_CODE_STORAGE_KEY, joined.joinCode);
      applyIncomingLiveState(state);
      setLiveDisplayPhase(deriveLivePhase(state));
      setLiveLeaderboard([]);
      previousRanksRef.current = {};
      setLiveRemainingSeconds(getPhaseRemainingSeconds(state));
      setLiveAnsweredQuestionIndex(null);
      setLiveSelectedOptionByQuestion({});
      setLiveAnswerResultByQuestion({});
      setLiveReadyMarked(Boolean(joined.participantReady));
      setLiveParticipantsCount(state.participantsCount || 0);
      liveSeenParticipantIdsRef.current = new Set();
      setView("live");
      setLiveWsStatus("connecting");
      const phaseGuess = deriveLivePhase(state);
      const likelyLateJoin =
        state.status === "live"
        && phaseGuess === "question"
        && (state.currentQuestionIndex ?? -1) >= 0
        && (state.remainingSeconds ?? 0) > 0
        && (state.question?.timeLimitSeconds ?? state.questionWindowSeconds ?? 0) - (state.remainingSeconds ?? 0) >= 5;
      setLateJoinCatchup(likelyLateJoin ? { questionIndex: state.currentQuestionIndex, dismissible: true } : null);
      toast.success(`Joined live session ${joined.joinCode}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not join live session");
    } finally {
      setLiveJoining(false);
    }
  }

  async function handleToggleLiveReady() {
    if (!liveState?.joinCode || liveReadySubmitting) return;
    setLiveReadySubmitting(true);
    try {
      const nextReady = !liveReadyMarked;
      const res = await setLiveQuizReadyState(liveState.joinCode, nextReady);
      setLiveReadyMarked(res.ready);
      toast.success(res.ready ? "You are marked ready" : "You are marked not ready");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update ready status");
    } finally {
      setLiveReadySubmitting(false);
    }
  }

  async function handleLiveAnswer(optionIndex: number) {
    if (!liveState?.question || liveSubmitting || liveAnsweredQuestionIndex === liveState.currentQuestionIndex) return;
    const questionIndex = liveState.currentQuestionIndex;
    setLiveSelectedOptionByQuestion((prev) => ({ ...prev, [questionIndex]: optionIndex }));
    setLiveAnsweredQuestionIndex(questionIndex);
    toast.success("Answer locked in");
    setLiveSubmitting(true);
    try {
      const res = await submitLiveQuizAnswer(liveState.joinCode, {
        questionIndex,
        selectedOption: optionIndex,
      });
      setLiveAnswerResultByQuestion((prev) => ({
        ...prev,
        [questionIndex]: {
          selectedOption: optionIndex,
          isCorrect: Boolean(res.isCorrect),
          pointsAwarded: Number(res.pointsAwarded || 0),
        },
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit answer";
      const lowered = msg.toLowerCase();
      if (lowered.includes("window has closed") || lowered.includes("not the active question") || lowered.includes("not active")) {
        setLiveAnsweredQuestionIndex(null);
        setLiveSelectedOptionByQuestion((prev) => {
          const next = { ...prev };
          delete next[questionIndex];
          return next;
        });
        toast.info("Answer window closed. Waiting for the next question.");
      } else if (lowered.includes("already answered")) {
        toast.info("Answer already locked in.");
      } else {
        setLiveAnsweredQuestionIndex(null);
        setLiveSelectedOptionByQuestion((prev) => {
          const next = { ...prev };
          delete next[questionIndex];
          return next;
        });
        toast.error(msg);
      }
    } finally {
      setLiveSubmitting(false);
    }
  }

  useEffect(() => {
    if (view !== "live" || !liveState) return;
    const phase = deriveLivePhase(liveState);
    if (phase !== "question") {
      setLateJoinCatchup(null);
      return;
    }
    if (!lateJoinCatchup) return;
    if (lateJoinCatchup.questionIndex !== liveState.currentQuestionIndex) {
      setLateJoinCatchup(null);
    }
  }, [view, liveState, lateJoinCatchup, deriveLivePhase]);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.error("Fullscreen is not available in this browser context");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <DashboardHeader title="Quizzes & Challenges" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-snow border-[3px] border-cloud rounded-2xl p-6 animate-pulse mb-4">
              <div className="h-4 bg-cloud rounded w-1/3 mb-4" />
              <div className="h-6 bg-cloud rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <DashboardHeader title="Quizzes & Challenges" />
      <ToolHelpModal toolId="iepod-quizzes" isOpen={showHelp} onClose={closeHelp} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/dashboard/iepod" className="text-lavender font-bold text-sm hover:underline">
            &larr; Back to IEPOD
          </Link>
          <div className="flex items-center gap-2">
            {view !== "list" && (
              <button
                onClick={() => { setView("list"); setActiveQuiz(null); setResult(null); setAnswerResponseMs({}); }}
                className="bg-transparent border-[3px] border-navy px-4 py-1.5 rounded-xl font-display font-bold text-xs text-navy hover:bg-navy hover:text-lime transition-all"
              >
                All Quizzes
              </button>
            )}
            <HelpButton onClick={openHelp} />
          </div>
        </div>

        {/* ── Quiz List ──────────────────────────────────────── */}
        {view === "list" && (
          <div className="space-y-5">
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 items-start">
                <div className="space-y-3">
                  <p className="text-label text-navy">Live Arena</p>
                  <h3 className="font-display font-black text-display-sm text-navy leading-[0.95]">Join with your host code</h3>
                  <p className="text-sm text-navy-muted">Jump straight into live rounds, reveals, and real-time standings.</p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center pt-1">
                    <input
                      value={liveJoinCode}
                      onChange={(e) => setLiveJoinCode(e.target.value.toUpperCase())}
                      placeholder="Enter live code"
                      disabled={liveJoining}
                      className="border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-black tracking-[0.2em] text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime w-full sm:w-44 uppercase"
                      maxLength={8}
                    />
                    <button
                      onClick={handleJoinLiveArena}
                      disabled={liveJoining}
                      className="bg-coral border-[3px] border-navy px-4 py-2 rounded-xl font-display font-black text-sm text-snow press-3 press-black whitespace-nowrap disabled:opacity-60"
                    >
                      {liveJoining ? "Entering..." : "Enter Live Arena"}
                    </button>
                  </div>
                </div>
                <div className="bg-ghost border border-navy/20 rounded-2xl p-4 space-y-3">
                  <p className="text-label-sm text-navy">Leaderboard Modes</p>
                  <div className="flex-col sm:flex-row gap-3 flex">
                  <button
                    onClick={() => setView("leaderboard")}
                    className="w-full inline-flex items-center justify-center bg-lime border-[3px] border-navy px-4 py-2 rounded-xl font-display font-black text-xs text-navy press-2 press-navy"
                  >
                    Quiz Leaderboard
                  </button>
                  <Link
                    href="/dashboard/iepod/spectate"
                    className="w-full inline-flex items-center justify-center bg-snow border-[3px] border-navy px-4 py-2 rounded-xl font-display font-black text-xs text-navy press-2 press-black"
                  >
                    Watch-Only View
                  </Link>
                </div>
                </div>
              </div>
            </div>

            {liveQuizzes.length > 0 && (
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-4 shadow-[6px_6px_0_0_#000] space-y-3">
                <p className="text-label-sm text-navy">Live Quizzes Available Now</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {liveQuizzes.map((q) => (
                    <div key={q._id || q.id} className="bg-ghost border border-navy/20 rounded-xl px-3 py-2">
                      <p className="font-display font-black text-sm text-navy truncate">{q.title}</p>
                      <p className="text-[11px] text-navy-muted mt-1">{q.activeLiveJoinCode ? `Host code: ${q.activeLiveJoinCode}` : "Live game hosted. Enter code above to join."}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000] overflow-hidden">
              <div className="px-5 py-4 border-b border-cloud bg-lavender-light/60">
                <p className="font-display font-black text-lg text-navy">Practice Quizzes</p>
                <p className="text-xs text-navy-muted">Pick a deck and continue where your momentum is strongest.</p>
              </div>
              <div className="divide-y divide-cloud">
              {practiceQuizzes.map((q) => {
                const qId = q._id || q.id || "";
                return (
                  <div key={qId} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-display font-black text-base text-navy truncate">{q.title}</h4>
                        <span className="bg-lavender-light text-lavender font-bold text-[10px] px-2 py-0.5 rounded-lg whitespace-nowrap">
                          {QUIZ_TYPE_LABELS[q.quizType]}
                        </span>
                      </div>
                      {q.description && <p className="text-slate text-sm mt-1 line-clamp-2">{q.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 text-slate text-xs mt-2">
                        <span>{q.questionCount ?? q.questions?.length ?? 0} questions</span>
                        {q.timeLimitMinutes && <span>{q.timeLimitMinutes} min</span>}
                        {q.phase && <span>{PHASE_LABELS[q.phase]}</span>}
                      </div>
                    </div>
                    <div className="sm:shrink-0">
                      <button
                        onClick={() => handleStartQuiz(qId)}
                        className="w-full sm:w-auto bg-lime border-[3px] border-navy press-3 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy"
                      >
                        Start Quiz
                      </button>
                    </div>
                  </div>
                );
              })}
              {practiceQuizzes.length === 0 && (
                <div className="md:col-span-2 text-center py-12 bg-ghost">
                  <p className="text-slate font-medium">No quizzes available right now.</p>
                  <p className="text-slate text-sm mt-1">Check back later for new challenges!</p>
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {/* ── Active Quiz ────────────────────────────────────── */}
        {view === "quiz" && activeQuiz && questions.length > 0 && (
          <div className="max-w-xl mx-auto space-y-5">
            {/* Quiz header */}
            <div className="bg-[linear-gradient(145deg,#2C1A7A_0%,#4A28A8_55%,#6A35CC_100%)] border-[3px] border-navy rounded-3xl p-5 shadow-[7px_7px_0_0_#000]">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => { setView("list"); setActiveQuiz(null); setAnswerResponseMs({}); }}
                  className="w-12 h-12 rounded-xl bg-snow/20 border border-snow/30 text-snow font-display font-black text-2xl"
                  aria-label="Back to quiz list"
                >
                  &larr;
                </button>
                <p className="font-display font-black text-snow text-lg">
                  {String(currentQ + 1).padStart(2, "0")} of {String(questions.length).padStart(2, "0")}
                </p>
                {timeLeft !== null ? (
                  <span className="font-display font-black text-base px-4 py-2 rounded-full bg-snow/20 border border-snow/30 text-snow">
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
                  </span>
                ) : (
                  <span className="w-24" />
                )}
              </div>
              <p className="text-snow/75 text-xs mt-3 truncate">{activeQuiz.title}</p>
              <div className="mt-3 h-2 rounded-full bg-navy/60 overflow-hidden">
                <div className="h-full bg-teal transition-all" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
              </div>
            </div>

            {/* Question card */}
            <div className="relative pb-14">
              <div className="absolute inset-x-3 -bottom-4 h-full rounded-3xl bg-lavender-light/70 border border-navy/15 z-0 pointer-events-none" />
              <div className="absolute inset-x-6 -bottom-8 h-full rounded-3xl bg-sunny-light/50 border border-navy/10 z-0 pointer-events-none" />
              <div className="relative z-10 bg-snow/96 backdrop-blur-sm border-[3px] border-navy/25 rounded-3xl p-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-slate text-xs font-bold uppercase tracking-wider">General Knowledge</span>
              </div>
              <h4 className="font-display font-black text-2xl text-navy mb-6 leading-[1.2]">
                {questions[currentQ].question}
              </h4>

              <div className="space-y-3">
                {questions[currentQ].options.map((opt, oi) => {
                  const selected = answers[currentQ] === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(currentQ, oi)}
                      className={`w-full text-left flex items-center gap-3 px-5 py-4 rounded-2xl border-[2px] transition-all ${
                        selected
                          ? "bg-snow border-navy"
                          : "bg-ghost/90 border-cloud hover:border-navy/40"
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        selected ? "bg-navy text-snow" : "bg-cloud text-slate"
                      }`}>
                        <OptionGlyph index={oi} className="w-4 h-4" />
                      </span>
                      <span className={`font-medium text-sm ${selected ? "text-navy font-bold" : "text-navy-muted"}`}>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8">
                <button
                  type="button"
                  onClick={() => moveToQuestion(Math.max(0, currentQ - 1))}
                  disabled={currentQ === 0}
                  className="bg-transparent border-[3px] border-navy px-5 py-2 rounded-xl font-display font-bold text-sm text-navy hover:bg-navy hover:text-lime transition-all disabled:opacity-50"
                >
                  Previous
                </button>

                {/* Question dots */}
                <div className="hidden sm:flex items-center gap-1">
                  {questions.map((_, qi) => (
                    <button
                      key={qi}
                      onClick={() => moveToQuestion(qi)}
                      aria-label={`Go to question ${qi + 1}`}
                      className={`w-3 h-3 rounded-full transition-all ${
                        qi === currentQ
                          ? "bg-navy scale-125"
                          : answers[qi] !== undefined
                          ? "bg-teal"
                          : "bg-cloud"
                      }`}
                    />
                  ))}
                </div>

                <span className="w-[132px]" />
              </div>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 -bottom-2">
              {currentQ < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => moveToQuestion(currentQ + 1)}
                  className="bg-lime border-[4px] border-navy press-5 press-navy min-w-56 px-8 py-3 rounded-2xl font-display font-black text-2xl text-snow/95"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmitQuiz()}
                  disabled={submitting}
                  className="bg-lime border-[4px] border-navy press-5 press-navy min-w-56 px-8 py-3 rounded-2xl font-display font-black text-xl text-snow/95 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Finish"}
                </button>
              )}
            </div>
            </div>
          </div>
        )}

        {/* ── Result ─────────────────────────────────────────── */}
        {view === "result" && result && (
          <div className="max-w-xl mx-auto space-y-5">
            <div className="bg-[linear-gradient(145deg,#2C1A7A_0%,#4A28A8_55%,#6A35CC_100%)] border-[3px] border-navy rounded-3xl p-5 shadow-[7px_7px_0_0_#000]">
              <p className="font-display font-black text-3xl text-snow text-center">Quiz Summary</p>
              <div className="mt-5 bg-snow rounded-3xl p-7 text-center border border-navy/15">
                <div className="w-16 h-16 mx-auto rounded-full bg-sunny-light border-2 border-navy/20 flex items-center justify-center">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="w-9 h-9 text-sunny" fill="currentColor"><path d="M7 2h10v2h3v3a5 5 0 0 1-5 5h-1.1a4 4 0 0 1-1.9 2.6V17h3v2H9v-2h3v-2.4A4 4 0 0 1 10.1 12H9A5 5 0 0 1 4 7V4h3V2Zm10 4v1a3 3 0 0 1-3 3h1a3 3 0 0 0 3-3V6h-1ZM6 6v1a3 3 0 0 0 3 3H8A3 3 0 0 1 5 7V6h1Z"/></svg>
                </div>
                <h3 className="font-display font-black text-3xl text-navy mt-4">Great Effort!</h3>
                <p className="text-navy-muted text-lg mt-1">You scored <span className="font-display font-black text-teal">{result.score}</span> out of <span className="font-display font-black text-navy">{result.maxScore}</span></p>
                <div className="mt-5 grid grid-cols-3 border border-cloud rounded-2xl overflow-hidden text-center">
                  <div className="py-3">
                    <p className="font-display font-black text-xl text-navy">{questions.length}</p>
                    <p className="text-slate text-xs">Total Q</p>
                  </div>
                  <div className="py-3 border-x border-cloud">
                    <p className="font-display font-black text-xl text-teal">{result.score}</p>
                    <p className="text-slate text-xs">Scored</p>
                  </div>
                  <div className="py-3">
                    <p className="font-display font-black text-xl text-navy">{result.percentage}%</p>
                    <p className="text-slate text-xs">Score %</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 bg-snow border-[3px] border-navy rounded-2xl p-2 gap-2 text-center">
              <button
                onClick={() => setView("leaderboard")}
                className="bg-lavender-light border border-navy/20 rounded-xl py-2 font-display font-black text-sm text-navy"
              >
                Standings
              </button>
              <button className="bg-ghost border border-navy/20 rounded-xl py-2 font-display font-black text-sm text-slate" disabled>
                Summary
              </button>
              <button
                onClick={() => { setView("list"); setResult(null); }}
                className="bg-ghost border border-navy/20 rounded-xl py-2 font-display font-black text-sm text-navy"
              >
                Play Again
              </button>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => { setView("list"); setResult(null); }}
                className="bg-transparent border-[3px] border-navy px-6 py-2.5 rounded-xl font-display font-bold text-sm text-navy hover:bg-navy hover:text-lime transition-all"
              >
                Back to Quizzes
              </button>
              <button
                onClick={() => setView("leaderboard")}
                className="bg-navy border-[3px] border-lime px-6 py-2.5 rounded-xl font-display font-bold text-sm text-lime press-3 press-lime"
              >
                View Leaderboard
              </button>
            </div>
          </div>
        )}

        {/* ── Leaderboard ────────────────────────────────────── */}
        {view === "leaderboard" && (
          <div className="max-w-xl mx-auto space-y-5">
            <div className="bg-[linear-gradient(145deg,#2C1A7A_0%,#4A28A8_55%,#6A35CC_100%)] border-[3px] border-navy rounded-3xl p-5 shadow-[7px_7px_0_0_#000]">
              <h3 className="font-display font-black text-3xl text-snow text-center">Quiz Leaderboard</h3>
              <div className="mt-4 bg-snow rounded-3xl border border-navy/15 overflow-hidden">
                <div className="grid grid-cols-3 text-center border-b border-cloud py-3">
                  <p className="font-display font-black text-navy text-sm">Standings</p>
                  <p className="font-display font-black text-slate text-sm">Summary</p>
                  <p className="font-display font-black text-slate text-sm">Play again</p>
                </div>
                <div className="grid grid-cols-3 text-[11px] text-slate border-b border-cloud px-4 py-2">
                  <p>Rank</p>
                  <p>Player</p>
                  <p className="text-right">Points</p>
                </div>
                <div className="space-y-0">
                {leaderboard.map((entry) => {
                  const isMe = entry.userId === user?.id;
                  const podium = entry.rank <= 3;
                  const initials = entry.userName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() || "")
                    .join("");
                  return (
                    <div
                      key={entry.userId}
                      className={`grid grid-cols-[52px_1fr_auto] items-center gap-3 px-4 py-4 border-b border-cloud transition-colors ${
                        isMe
                          ? "bg-lime-light/60"
                          : podium
                          ? "bg-teal-light/35"
                          : "bg-snow"
                      }`}
                    >
                      <span className={`font-display font-black text-base text-center ${
                        entry.rank === 1
                          ? "text-sunny"
                          : entry.rank === 2
                          ? "text-cloud"
                          : entry.rank === 3
                          ? "text-coral"
                          : "text-slate"
                      }`}>
                        {entry.rank}{entry.rank === 1 ? "st" : entry.rank === 2 ? "nd" : entry.rank === 3 ? "rd" : "th"}
                      </span>
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="w-10 h-10 rounded-xl bg-lavender-light border border-navy/20 flex items-center justify-center font-display font-black text-navy text-xs">
                          {initials || "PL"}
                        </span>
                        <p className="font-bold text-sm truncate text-navy">
                          {entry.userName} {isMe && "(You)"}
                        </p>
                      </div>
                      <span className="font-display font-black text-base text-navy text-right">
                        {entry.totalPoints}
                      </span>
                    </div>
                  );
                })}
                {leaderboard.length === 0 && (
                  <p className="text-slate text-sm text-center py-8">No rankings yet. Be the first!</p>
                )}
              </div>
              </div>
            </div>
          </div>
        )}

        {view === "live" && liveState && (
          <div className="fixed inset-0 z-[120] overflow-y-auto overflow-x-hidden bg-[linear-gradient(160deg,#2D1374_0%,#4C24A7_52%,#6F3BD0_100%)]">
            <svg aria-hidden="true" className="fixed top-12 left-[8%] w-6 h-6 text-navy/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" /></svg>
            <svg aria-hidden="true" className="fixed bottom-12 right-[10%] w-7 h-7 text-navy/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" /></svg>
            {livePhaseSplash && (
              <div className="fixed inset-0 z-[140] pointer-events-none flex items-center justify-center">
                <div className="bg-snow/92 backdrop-blur-sm border-[2px] border-navy/25 rounded-2xl px-8 py-5 text-center animate-scale-in">
                  <p className="font-display font-black text-3xl text-navy leading-none">{livePhaseSplash.title}</p>
                  <p className="text-navy-muted text-sm mt-2 uppercase tracking-wider font-bold">{livePhaseSplash.subtitle}</p>
                </div>
              </div>
            )}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
              {(() => {
                const serverPhase = deriveLiveServerPhase(liveState);
                const liveQuestionPhase = serverPhase;
                const preRevealActive = serverPhase === "leaderboard_reveal" && preRevealQuestionIndex === liveState.currentQuestionIndex;
                const questionAnswered = liveAnsweredQuestionIndex === liveState.currentQuestionIndex;
                const inQuestionIntroPhase = liveQuestionPhase === "question_intro";
                const inQuestionAnsweringPhase = liveQuestionPhase === "question_answering";
                const inQuestionPhase = inQuestionIntroPhase || inQuestionAnsweringPhase;
                const inLeaderboardPhase = liveQuestionPhase === "leaderboard_reveal" && !preRevealActive;
                const inRevealPhase = liveQuestionPhase === "answer_reveal" || preRevealActive;
                const inWaitingRoom = liveQuestionPhase === "waiting" && !liveState.question && liveState.status !== "ended";
                const inFinalPodium = liveState.status === "ended" && showFinalPodium;
                const optionsVisible = inQuestionAnsweringPhase;
                const phaseTitle = inQuestionIntroPhase
                  ? "Ready Check"
                  : inQuestionAnsweringPhase
                    ? "Answer Now"
                  : inRevealPhase
                    ? "Answer Reveal"
                    : inLeaderboardPhase
                      ? "Leaderboard Moment"
                    : liveState.status === "ended" && !inFinalPodium
                      ? "Round Complete"
                      : inFinalPodium
                        ? "Final Podium"
                        : "Get Ready";
                const phaseAnimationClass = inQuestionPhase
                  ? "animate-fade-in-up"
                  : inRevealPhase
                    ? "animate-slide-left"
                    : inLeaderboardPhase
                      ? "animate-scale-in"
                      : "animate-fade-in";
                const liveLeaderboardSource = liveLeaderboard.length > 0
                  ? liveLeaderboard
                  : (((liveState as (LiveQuizState & { leaderboard?: LiveLeaderboardItem[] }) | null)?.leaderboard) || []);
                const myStanding = currentUserLiveRank
                  ? liveLeaderboardSource.find((entry) => entry.rank === currentUserLiveRank) || null
                  : null;
                const viewerResultLabel = myStanding
                  ? myStanding.rank <= 3
                    ? `You finished #${myStanding.rank} on the podium`
                    : `You finished #${myStanding.rank} overall`
                  : "Final standings";

                return (
                  <div className="min-h-[calc(100dvh-2rem)] grid lg:grid-cols-[1fr_280px] gap-4 items-start pb-4">
                    <section className="space-y-3 max-w-xl w-full mx-auto lg:mx-0">
                      <div className="bg-snow/12 backdrop-blur-sm border border-snow/25 rounded-2xl p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-label-sm text-snow/70">Live Quiz</p>
                            <h2 className="font-display font-black text-display-sm text-snow leading-[0.95]">{liveState.quizTitle}</h2>
                            <p className="text-xs text-snow/70 mt-1">Code {liveState.joinCode} • {liveState.participantsCount} players</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-snow/30 ${liveWsStatus === "open" ? "bg-teal-light text-navy" : liveWsStatus === "connecting" ? "bg-sunny-light text-navy" : "bg-coral-light text-navy"}`}>
                              {liveWsStatus === "open" ? "Live" : liveWsStatus === "connecting" ? "Connecting" : "Reconnecting"}
                            </span>
                            <button onClick={toggleFullscreen} className="bg-snow/92 border-[2px] border-navy/30 px-3 py-2 rounded-xl text-xs font-black text-navy press-2 press-black">{isFullscreen ? "Exit" : "Fullscreen"}</button>
                            <button onClick={() => setLiveSoundSettings((prev) => ({ ...prev, muted: !prev.muted }))} className="bg-snow/92 border-[2px] border-navy/30 px-3 py-2 rounded-xl text-xs font-black text-navy press-2 press-black">{liveSoundSettings.muted ? "Unmute" : "Mute"}</button>
                            <button
                              onClick={() => {
                                window.localStorage.removeItem(LIVE_JOIN_CODE_STORAGE_KEY);
                                setLiveReadyMarked(false);
                                setView("list");
                              }}
                              className="bg-snow/92 border-[2px] border-navy/30 px-3 py-2 rounded-xl text-xs font-black text-navy press-2 press-black"
                            >
                              Leave
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-snow rounded-[2rem] border-[3px] border-navy/20 p-5 relative overflow-visible">
                        <div className="relative z-10">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          {!inFinalPodium ? (
                            <span className="text-label-sm text-navy-muted">
                              {liveState.status === "ended"
                                ? "Session Complete"
                                : liveState.currentQuestionIndex < 0
                                ? "Waiting Room"
                                : `Question ${liveState.currentQuestionIndex + 1} of ${liveState.totalQuestions}`}
                            </span>
                          ) : (
                            <span className="text-label-sm text-navy-muted">Session Complete</span>
                          )}
                          {inQuestionAnsweringPhase && (
                            <span className={`px-3 py-1 rounded-full text-sm font-display font-black ${liveRemainingSeconds <= 5 ? "bg-coral-light text-navy" : "bg-lime-light text-navy"}`}>
                              {liveRemainingSeconds}s
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] font-bold text-navy-muted mb-4">{phaseTitle}</p>

                        <div className={`relative space-y-4 ${phaseAnimationClass} ${livePhasePulse ? "animate-pulse-soft" : ""}`}>
                            {joinPopups.map((popup) => (
                              <div
                                key={popup.id}
                                className="absolute z-20 pointer-events-none animate-rank-enter"
                                style={{ left: `${popup.x}%`, top: `${popup.y}%` }}
                              >
                                <div className={`w-11 h-11 rounded-full border-2 border-navy flex items-center justify-center font-display font-black text-xs shadow-[3px_3px_0_0_#000] animate-waitroom-bounce ${popup.tone === "teal" ? "bg-teal text-snow" : popup.tone === "coral" ? "bg-coral text-snow" : popup.tone === "sunny" ? "bg-sunny text-navy" : "bg-lavender text-snow"}`}>
                                  {popup.label}
                                </div>
                              </div>
                            ))}
                            {inWaitingRoom && (
                              <div className="bg-snow border border-navy/20 rounded-2xl p-6 text-center">
                                <p className="font-display font-black text-2xl text-navy">You are in the lobby</p>
                                <p className="text-sm text-navy-muted mt-1">Host is setting up the next round. Tap ready so we can kick off smoothly.</p>
                                <div className="mt-4 inline-flex items-center gap-2 bg-snow/90 border border-navy/25 rounded-full px-4 py-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-teal animate-pulse" />
                                  <span className="font-display font-black text-xs text-navy uppercase tracking-wider">{liveState.participantsCount} players connected</span>
                                </div>
                                <div className="mt-4">
                                  <button
                                    onClick={handleToggleLiveReady}
                                    disabled={liveReadySubmitting}
                                    className={`rounded-xl px-5 py-2 text-xs font-display font-black uppercase tracking-wider disabled:opacity-60 border-[2px] border-navy/40 ${liveReadyMarked ? "bg-teal-light text-navy press-3 press-navy" : "bg-sunny-light text-navy press-3 press-black"}`}
                                  >
                                    {liveReadySubmitting ? "Updating..." : liveReadyMarked ? "Ready Confirmed" : "I'm Ready"}
                                  </button>
                                  <p className="text-[11px] text-navy-muted mt-2">Ready players: <span className="font-black text-navy">{liveState.readyParticipantsCount ?? 0}</span></p>
                                </div>
                              </div>
                            )}

                            {liveState.status === "ended" && (
                              <div className="bg-snow border border-navy/20 rounded-2xl p-6 text-center">
                                <p className="font-display font-black text-xl text-navy">Round complete. Nice effort.</p>
                                <p className="text-sm text-navy-muted mt-1">Final podium spotlight is coming up shortly.</p>
                              </div>
                            )}

                            {inQuestionPhase && liveState.question && (
                              <div key={`question-${liveState.currentQuestionIndex}`} className="space-y-4">
                                  <div className="relative">
                                    <div className="absolute inset-x-3 -bottom-3 h-full rounded-3xl bg-lavender-light/60 border border-navy/10" />
                                    <div className="relative bg-snow border border-navy/20 rounded-3xl p-5">
                                    <h3 className="font-display font-black text-display-sm text-navy leading-[0.95]">{liveState.question.question}</h3>
                                    {lateJoinCatchup && lateJoinCatchup.questionIndex === liveState.currentQuestionIndex && (
                                      <div className="mt-3 bg-sunny-light border border-navy/20 rounded-xl p-3 flex items-center justify-between gap-3">
                                        <p className="text-xs font-bold text-navy">Round in progress. Next question in {liveRemainingSeconds}s.</p>
                                        {lateJoinCatchup.dismissible && (
                                          <button
                                            onClick={() => setLateJoinCatchup(null)}
                                            className="bg-snow border-2 border-navy rounded-lg px-2 py-1 text-[10px] font-black text-navy"
                                          >
                                            Dismiss
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    {inQuestionIntroPhase && (
                                      <div className="bg-sunny-light border border-navy/20 rounded-xl px-4 py-3 mt-3 text-center animate-fade-in">
                                        <p className="font-display font-black text-sm text-navy">Get ready, answering starts in {liveRemainingSeconds}s...</p>
                                      </div>
                                    )}
                                    {optionsVisible && (
                                    <div className="grid sm:grid-cols-2 gap-3 mt-4">
                                      {liveState.question.options.map((opt, idx) => {
                                        const selectedForCurrentQuestion = liveSelectedOptionByQuestion[liveState.currentQuestionIndex];
                                        const isSelected = selectedForCurrentQuestion === idx;
                                        const alreadyAnswered = questionAnswered;
                                        return (
                                          <button
                                            key={`${liveState.currentQuestionIndex}-${idx}`}
                                            onClick={() => handleLiveAnswer(idx)}
                                            disabled={alreadyAnswered || liveSubmitting || liveRemainingSeconds <= 0}
                                            className={`text-left border-[2px] rounded-2xl p-4 transition-all ${isSelected ? "bg-snow border-navy" : "bg-ghost border-navy/20 hover:border-navy/40 hover:-translate-y-0.5"} disabled:opacity-60`}
                                          >
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className={`w-7 h-7 rounded-lg border flex items-center justify-center ${isSelected ? "bg-navy text-snow border-navy" : optionMarkerPalette(idx)}`}>
                                                <OptionGlyph index={idx} className="w-4 h-4" />
                                              </span>
                                              <p className="text-[10px] uppercase tracking-wider font-black text-navy/55">Option {String.fromCharCode(65 + idx)}</p>
                                            </div>
                                            <p className="font-bold text-navy text-sm pl-9">{opt}</p>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    )}
                                    </div>
                                  </div>
                              </div>
                            )}

                            {inRevealPhase && (
                              <div key={`reveal-${liveState.currentQuestionIndex}`} className="bg-snow border-[2px] border-navy/25 rounded-3xl p-6 sm:p-8 space-y-6 animate-scale-in shadow-[6px_6px_0_0_#000]">
                                {(() => {
                                  const revealCorrectIndex = liveState.question?.correctIndex;
                                  const revealCorrectLetter = typeof revealCorrectIndex === "number"
                                    ? String.fromCharCode(65 + revealCorrectIndex)
                                    : null;
                                  const revealCorrectOption = liveState.question?.correctOption || null;
                                  return (
                                    <div className="bg-teal-light border-2 border-teal rounded-2xl px-4 py-3 text-center">
                                      <p className="text-[10px] font-black uppercase tracking-wider text-teal">Correct Answer</p>
                                      <p className="font-display font-black text-xl text-navy mt-0.5">
                                        {revealCorrectLetter ? `${revealCorrectLetter}` : "Unavailable"}
                                        {revealCorrectOption ? `: ${revealCorrectOption}` : ""}
                                      </p>
                                    </div>
                                  );
                                })()}
                                <div className="text-center space-y-2">
                                  <p className="font-display font-black text-3xl sm:text-4xl text-navy leading-none">Answer Breakdown</p>
                                  <p className="text-base font-bold text-navy-muted">{preRevealActive ? "Host is opening the reveal now..." : "Here is how this round played out across the room."}</p>
                                  {(() => {
                                    if (preRevealActive) {
                                      return <p className="text-sm font-black text-slate mt-2">Almost there. Reveal starts in a moment.</p>;
                                    }
                                    const feedback = liveAnswerResultByQuestion[liveState.currentQuestionIndex];
                                    if (!feedback) {
                                      return <p className="text-sm font-black text-slate mt-2">No locked answer was recorded from this device this round.</p>;
                                    }
                                    return (
                                      <p className={`text-base font-black mt-2 ${feedback.isCorrect ? "text-teal" : "text-coral"}`}>
                                        {feedback.isCorrect ? `Nice one!${feedback.pointsAwarded > 0 ? ` +${feedback.pointsAwarded} pts` : ""}` : "Not this one, bounce back next round."}
                                      </p>
                                    );
                                  })()}
                                  {liveState.question?.correctOption && (
                                    <p className="text-lg font-display font-black text-navy mt-1">
                                      Correct option {typeof liveState.question.correctIndex === "number" ? String.fromCharCode(65 + liveState.question.correctIndex) : ""}: {liveState.question.correctOption}
                                    </p>
                                  )}
                                </div>
                                <div className="bg-ghost border-2 border-navy/20 rounded-2xl px-4 py-5 overflow-visible">
                                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-navy-muted mb-3">
                                    <span>Answer Spread</span>
                                    <span>Per option vote share</span>
                                  </div>
                                  {preRevealActive ? (
                                    <div className="min-h-[15rem] sm:min-h-[17rem] rounded-2xl border border-navy/15 bg-snow/70 flex items-center justify-center">
                                      <p className="text-lg font-display font-black text-navy">Reveal starts now...</p>
                                    </div>
                                  ) : (
                                  (() => {
                                    const sourceDistribution = liveState.question?.optionDistribution || [];
                                    const usingFallback = sourceDistribution.length === 0;
                                    const distribution = usingFallback
                                      ? (liveState.question?.options || []).map((option, optionIndex) => ({ optionIndex, option, count: 0, percent: 0 }))
                                      : sourceDistribution;
                                    return (
                                    <>
                                  {usingFallback && (
                                    <div className="mb-3 rounded-xl bg-cloud border border-navy/20 px-3 py-2 text-center">
                                      <p className="text-[11px] font-black text-navy-muted uppercase tracking-wider">Awaiting submissions sync</p>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-4 gap-2 sm:gap-5 items-end min-h-[18rem] sm:min-h-[21rem]">
                                    {distribution.map((opt, distIdx) => {
                                      const isCorrect = liveState.question?.correctIndex === opt.optionIndex;
                                      const isMyChoice = liveAnswerResultByQuestion[liveState.currentQuestionIndex]?.selectedOption === opt.optionIndex;
                                      const markerClasses = optionMarkerPalette(opt.optionIndex);
                                      return (
                                        <div key={`dist-${opt.optionIndex}`} className="h-full flex flex-col items-center justify-end gap-2 pb-1 animate-elastic-rise" style={{ animationDelay: `${distIdx * 120}ms`, animationFillMode: "both" }}>
                                          <div className="text-sm sm:text-base font-display font-black text-navy">{opt.percent}%</div>
                                          <div className={`w-full h-36 sm:h-48 rounded-t-2xl bg-cloud/80 border-2 relative overflow-hidden ${isCorrect ? "border-teal shadow-[0_0_0_2px_#17B890]" : "border-navy/15"} ${isMyChoice ? "ring-2 ring-lavender ring-offset-2 ring-offset-snow" : ""}`}>
                                            {isCorrect && (
                                              <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
                                                <span className="px-2 py-0.5 rounded-full bg-teal text-snow text-[10px] font-black uppercase tracking-wider">Correct</span>
                                                <span className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[7px] border-l-transparent border-r-transparent border-t-teal" />
                                              </div>
                                            )}
                                            <div
                                              className={`absolute bottom-0 left-0 right-0 origin-bottom transition-all duration-700 ${usingFallback ? "bg-cloud" : isCorrect ? "bg-teal" : "bg-navy/45"}`}
                                              style={{
                                                height: `${Math.max(10, opt.percent)}%`,
                                                transitionDelay: `${distIdx * 140}ms`,
                                                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                                              }}
                                            />
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <span className={`w-7 h-7 rounded-md border flex items-center justify-center ${markerClasses}`}>
                                              <OptionGlyph index={opt.optionIndex} className="w-3.5 h-3.5" />
                                            </span>
                                            <span className="text-xs font-black text-navy">{opt.count}</span>
                                          </div>
                                          <p className="text-xs font-bold text-navy-muted text-center leading-tight line-clamp-2 min-h-9">{opt.option}</p>
                                          <div className="min-h-4">
                                            {isMyChoice && <span className="inline-block px-2 py-0.5 rounded-full bg-lavender text-snow text-[10px] font-black uppercase tracking-wider">Your pick</span>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  </>
                                    );
                                  })()
                                  )}
                                </div>
                              </div>
                            )}

                            {inLeaderboardPhase && (
                              <div key={`leaderboard-${liveState.currentQuestionIndex}-${liveLeaderboardTransitionTick}`} className="bg-snow border-[3px] border-navy/35 rounded-2xl p-6 space-y-4 shadow-[8px_8px_0_0_#000]">
                                <div className="text-center">
                                  <p className="font-display font-black text-2xl text-navy">Scoreboard Reveal</p>
                                  <p className="text-sm text-navy-muted">Top performers are reshuffling in real time.</p>
                                  {liveRemainingSeconds <= 2 && (
                                    <p className="text-xs font-black text-navy mt-2 animate-pulse">Next question is about to begin…</p>
                                  )}
                                </div>
                                <div className="space-y-2.5">
                                  {liveTopTen.map((item) => {
                                    const movement = liveRankMovementByUser[item.userId] || 0;
                                    const movementClass = movement > 0
                                      ? "bg-teal-light/75 border-teal/45"
                                      : movement < 0
                                        ? "bg-coral-light/75 border-coral/45"
                                        : "bg-snow/95 border-navy/25";
                                    return (
                                      <div
                                        key={item.userId}
                                        ref={(el) => {
                                          leaderboardRowRefs.current[item.userId] = el;
                                        }}
                                        className={`flex items-center justify-between rounded-xl border-[2px] px-4 py-2.5 transition-all will-change-transform animate-rank-enter shadow-[4px_4px_0_0_#000] ${movementClass}`}
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <p className="font-display font-black text-base text-navy">#{item.rank}</p>
                                          <p className="font-bold text-base text-navy truncate">{item.userName}</p>
                                          {movement > 0 && <span className="text-[10px] font-black text-teal">▲ {movement}</span>}
                                          {movement < 0 && <span className="text-[10px] font-black text-coral">▼ {Math.abs(movement)}</span>}
                                        </div>
                                        <div className="text-right">
                                          <p className="font-display font-black text-xl text-navy leading-none">{liveDisplayedScoreByUser[item.userId] ?? item.totalScore}</p>
                                          {item.rank <= 3 && <p className="text-[10px] font-black text-teal uppercase tracking-wider">Top 3</p>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {liveLeaderboard.length === 0 && <p className="text-slate text-sm text-center">Waiting for score updates...</p>}
                                </div>
                              </div>
                            )}

                            {liveState.status === "ended" && !showFinalPodium && (
                              <div className="bg-snow border border-navy/20 rounded-2xl p-6 text-center shadow-[6px_6px_0_0_#000]">
                                <p className="font-display font-black text-lg text-navy">Host is preparing the Final Top 3 spotlight.</p>
                                <p className="text-sm text-navy-muted mt-1">Stay with us, the closing podium is about to start.</p>
                              </div>
                            )}

                            {liveState.status === "ended" && showFinalPodium && (
                              <div className="relative bg-snow border border-navy/20 rounded-2xl p-6 space-y-4 animate-scale-in overflow-hidden">
                                <p className="font-display font-black text-2xl text-navy text-center">Final Top 3</p>
                                <p className="text-center text-xs font-black text-navy-muted uppercase tracking-wider">{viewerResultLabel}</p>
                                <div className="grid sm:grid-cols-3 gap-3 items-end">
                                  {[3, 2, 1].map((rankLabel, index) => {
                                    const podiumItem = liveTopTen.find((item) => item.rank === rankLabel);
                                    const heights = ["h-26", "h-32", "h-40"];
                                    if (!podiumItem) return null;
                                    const initials = podiumItem.userName
                                      .split(" ")
                                      .filter(Boolean)
                                      .slice(0, 2)
                                      .map((part) => part[0]?.toUpperCase() || "")
                                      .join("");
                                    const delayMs = index * 520;
                                    const rankTheme = podiumItem.rank === 1
                                      ? "bg-[linear-gradient(135deg,#F8E08A_0%,#C99A1A_45%,#8D6503_100%)] border-navy"
                                      : podiumItem.rank === 2
                                        ? "bg-[linear-gradient(135deg,#E7E8EC_0%,#B8BDC9_48%,#858EA0_100%)] border-navy"
                                        : "bg-[linear-gradient(135deg,#E9BDA4_0%,#B67956_48%,#6C3A25_100%)] border-navy";
                                    const tilt = podiumItem.rank === 3 ? "rotate-[-2deg]" : podiumItem.rank === 2 ? "rotate-[1.4deg]" : "rotate-[-0.7deg]";
                                    const badgeTheme = podiumItem.rank === 1
                                      ? "bg-navy text-sunny"
                                      : podiumItem.rank === 2
                                        ? "bg-navy text-cloud"
                                        : "bg-navy text-coral";
                                    const scoreTheme = podiumItem.rank === 1
                                      ? "text-navy"
                                      : podiumItem.rank === 2
                                        ? "text-navy"
                                        : "text-coral";
                                    return (
                                      <div
                                        key={podiumItem.userId}
                                        className={`relative ${rankTheme} ${tilt} border-[3px] rounded-2xl p-3 text-center ${heights[index]} flex flex-col justify-end animate-flip-reveal shadow-[9px_9px_0_0_#000] overflow-hidden`}
                                        style={{ animationDelay: `${delayMs}ms`, animationFillMode: "both" }}
                                      >
                                        <div className="absolute inset-0 bg-[linear-gradient(112deg,transparent_0%,rgba(255,255,255,0.34)_33%,transparent_60%)]" />
                                        <div className="absolute inset-y-2 right-3 w-[28%] rounded-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,transparent_75%)]" />
                                        <div className="absolute inset-x-3 -bottom-2 h-full rounded-2xl bg-navy/12" />
                                        <svg aria-hidden="true" className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 text-sunny animate-pulse-soft" style={{ animationDelay: `${delayMs + 160}ms` }} viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                                        </svg>
                                        <div className="relative z-10">
                                          <div className="w-10 h-10 rounded-full bg-snow border-[2px] border-navy/40 mx-auto mb-2 flex items-center justify-center font-display font-black text-xs text-navy">
                                            {initials || "PL"}
                                          </div>
                                          <svg aria-hidden="true" className="absolute -right-1 -top-1 w-3.5 h-3.5 text-sunny" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                                          </svg>
                                        </div>
                                        <span className="absolute bottom-2 right-3 text-[10px] font-black text-navy/65">•••</span>
                                        <p className={`relative z-10 mx-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${badgeTheme}`}>#{podiumItem.rank}</p>
                                        <p className="relative z-10 font-display font-black text-sm text-navy truncate">{podiumItem.userName}</p>
                                        <p className={`relative z-10 font-display font-black text-lg ${scoreTheme}`}>{podiumItem.totalScore}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                        </div>
                        </div>
                      </div>

                    </section>

                    <aside className="hidden lg:block space-y-3 sticky top-4">
                      <div className="bg-snow/68 backdrop-blur-md border border-navy/20 rounded-2xl p-4">
                        <p className="text-label-sm text-slate">Current #1</p>
                        {liveTopTen[0] ? (
                          <>
                            <p className="font-display font-black text-xl text-navy mt-1 truncate">{liveTopTen[0].userName}</p>
                            <p className="font-display font-black text-3xl text-teal leading-none mt-1">{liveDisplayedScoreByUser[liveTopTen[0].userId] ?? liveTopTen[0].totalScore}</p>
                          </>
                        ) : (
                          <p className="text-sm text-navy-muted mt-2">No rank yet</p>
                        )}
                      </div>
                      <div className="bg-snow/68 backdrop-blur-md border border-navy/20 rounded-2xl p-4">
                        <p className="text-label-sm text-navy">Helpful Tip</p>
                        <p className="font-bold text-sm text-navy mt-1">
                          {inQuestionPhase
                            ? "Trust your first instinct, then answer before the timer drops."
                            : inRevealPhase
                              ? "Use this review to spot patterns for the next round."
                              : inLeaderboardPhase
                                ? "Small gains matter. One good round can move you up."
                                : "Take a breath and tap ready whenever you're set."}
                        </p>
                      </div>
                    </aside>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
