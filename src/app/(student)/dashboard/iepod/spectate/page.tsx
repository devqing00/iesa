"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { getLiveQuizLeaderboard, getLiveQuizState, getWsUrl } from "@/lib/api";
import type { LiveLeaderboardItem, LiveQuizState, LiveQuizWsPacket } from "@/lib/api";

export default function SpectateLiveQuizPage() {
  const { getAccessToken } = useAuth();
  const initialCode = typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("code") || "").toUpperCase()
    : "";
  const [joinCode, setJoinCode] = useState(initialCode);
  const [activeCode, setActiveCode] = useState(initialCode);
  const [state, setState] = useState<LiveQuizState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LiveLeaderboardItem[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">("closed");
  const [muted, setMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const previousPhaseRef = useRef<string>("waiting");
  const latestStateVersionRef = useRef(0);

  const derivePhase = useCallback((liveState: LiveQuizState | null): string => {
    if (!liveState) return "waiting";
    if (liveState.status === "ended" && liveState.finalPodiumRevealed) return "final-reveal";
    if (liveState.phase === "question_intro" || liveState.phase === "question_answering") return "question";
    if (liveState.phase === "answer_reveal") return "reveal";
    if (liveState.phase === "leaderboard_reveal") return "leaderboard";
    if (liveState.phase === "ended") return "ended";
    if (liveState.phase === "waiting") return "waiting";
    return liveState.questionPhase || liveState.status || "waiting";
  }, []);

  const getPhaseRemainingSeconds = useCallback((liveState: LiveQuizState | null): number => {
    if (!liveState) return 0;
    if (liveState.phaseEndsAt) {
      const endsAtMs = new Date(liveState.phaseEndsAt).getTime();
      if (Number.isFinite(endsAtMs)) {
        return Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000));
      }
    }
    return Math.max(0, liveState.phaseRemainingSeconds ?? liveState.remainingSeconds ?? 0);
  }, []);

  const applyIncomingState = useCallback((nextState: LiveQuizState) => {
    const nextVersion = Number(nextState.stateVersion ?? 0);
    if (nextVersion > 0) {
      if (nextVersion < latestStateVersionRef.current) return false;
      latestStateVersionRef.current = nextVersion;
    }
    setState(nextState);
    setRemaining(getPhaseRemainingSeconds(nextState));
    return true;
  }, [getPhaseRemainingSeconds]);

  const hydrate = useCallback(async (code: string) => {
    const [stateRes, lbRes] = await Promise.allSettled([
      getLiveQuizState(code, { showErrorToast: false, timeout: 12000 }),
      getLiveQuizLeaderboard(code, 10, { showErrorToast: false, timeout: 12000 }),
    ]);
    if (stateRes.status === "fulfilled") {
      applyIncomingState(stateRes.value);
    }
    if (lbRes.status === "fulfilled") {
      setLeaderboard(lbRes.value.items || []);
    }
  }, [applyIncomingState]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(getPhaseRemainingSeconds(state));
    }, 1000);
    return () => clearInterval(timer);
  }, [state, getPhaseRemainingSeconds]);

  useEffect(() => {
    if (!activeCode) return;
    if (wsStatus === "open") return;
    let cancelled = false;
    const poll = async () => {
      try {
        await hydrate(activeCode);
      } catch {
        if (!cancelled) {
          // Keep watch-only mode alive during transient errors.
        }
      }
    };
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeCode, hydrate, wsStatus]);

  useEffect(() => {
    if (!activeCode) {
      return;
    }

    cancelledRef.current = false;

    const connect = async (retryToken?: string) => {
      if (cancelledRef.current) return;
      const token = retryToken ?? (await getAccessToken());
      if (!token || cancelledRef.current) return;

      const wsUrl = getWsUrl(
        `/api/v1/iepod/quizzes/live/${encodeURIComponent(activeCode)}/ws?token=${encodeURIComponent(token)}&spectator=1`,
      );
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setWsStatus("connecting");

      ws.onopen = () => {
        setWsStatus("open");
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data) as LiveQuizWsPacket;
          if (packet.type !== "live_state" || !packet.data) return;
          if (!applyIncomingState(packet.data)) return;
          if (Array.isArray(packet.data.leaderboard)) {
            setLeaderboard(packet.data.leaderboard.slice(0, 10));
          }
        } catch {
          // Ignore malformed packets.
        }
      };

      ws.onclose = () => {
        setWsStatus("closed");
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        if (!cancelledRef.current) {
          reconnectRef.current = setTimeout(() => {
            void connect();
          }, 2500);
        }
      };

      ws.onerror = () => ws.close();
    };

    void connect();

    return () => {
      cancelledRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [activeCode, getAccessToken, applyIncomingState]);

  useEffect(() => {
    if (!state) return;
    const phase = derivePhase(state);
    if (previousPhaseRef.current === phase) return;
    previousPhaseRef.current = phase;

    if (muted) return;
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
      osc.type = phase === "reveal" ? "triangle" : "sine";
      osc.frequency.value = phase === "question" ? 740 : phase === "leaderboard" ? 560 : 900;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      const peak = 0.05;
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Audio cue failures are non-blocking.
    }
  }, [state, muted, derivePhase]);

  const connect = async () => {
    if (!joinCode.trim()) {
      toast.error("Enter a live code");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    setActiveCode(code);
    try {
      await hydrate(code);
      toast.success(`Watching live room ${code}`);
    } catch {
      toast.error("Could not load this live room");
    }
  };

  const phase = useMemo(() => derivePhase(state), [state, derivePhase]);
  const phaseTitle =
    phase === "question"
      ? "Answer Window"
      : phase === "reveal"
        ? "Answer Breakdown"
        : phase === "leaderboard"
          ? "Leaderboard Reveal"
          : phase === "final-reveal"
            ? "Final Reveal"
            : phase;
  const topRows = useMemo(() => leaderboard.slice(0, 10), [leaderboard]);
  const podiumRows = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);

  return (
    <main id="main-content" className="min-h-screen bg-[linear-gradient(160deg,#2D1374_0%,#4C24A7_52%,#6F3BD0_100%)]">
      <DashboardHeader title="Watch Live Quiz" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link href="/dashboard/iepod/quizzes" className="text-lavender font-bold text-sm hover:underline">
            &larr; Back to Quizzes
          </Link>
          <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${wsStatus === "open" ? "bg-teal text-snow" : wsStatus === "connecting" ? "bg-sunny text-navy" : "bg-coral text-snow"}`}>
            {wsStatus === "open" ? "Realtime" : wsStatus === "connecting" ? "Connecting" : "Reconnecting"}
          </span>
        </div>

        <section className="bg-snow/95 border-[4px] border-navy rounded-3xl p-5 shadow-[8px_8px_0_0_#000] space-y-4">
          <div>
            <p className="text-label text-navy">Spectator Mode</p>
            <h1 className="font-display font-black text-display-sm text-navy">Watch-Only Live Audience</h1>
            <p className="text-sm text-slate mt-1">No answer controls on this route. Built for non-participant stage watching.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-black tracking-[0.2em] text-navy bg-snow w-40 uppercase"
              maxLength={8}
              placeholder="LIVE CODE"
            />
            <button onClick={connect} className="bg-lime border-[3px] border-navy px-4 py-2 rounded-xl text-xs font-black text-navy press-2 press-navy">Watch</button>
            <button onClick={() => setMuted((prev) => !prev)} className={`border-[3px] px-4 py-2 rounded-xl text-xs font-black ${muted ? "bg-coral border-navy text-snow press-2 press-black" : "bg-teal border-navy text-snow press-2 press-navy"}`}>
              {muted ? "Muted" : "Sound On"}
            </button>
          </div>
        </section>

        {state && (
          <div className="grid lg:grid-cols-3 gap-4 items-start">
            <section className="lg:col-span-2 bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-label text-navy">Live Stage</p>
                  <h2 className="font-display font-black text-display-lg text-navy leading-[0.9]">{state.quizTitle}</h2>
                  <p className="text-xs text-slate">Code: {state.joinCode} · Players: {state.participantsCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-label text-navy">{phaseTitle}</p>
                  <p className="font-display font-black text-5xl text-navy leading-none">{remaining}s</p>
                </div>
              </div>

              {phase === "question" && state.question && (
                <div className="space-y-3">
                  <h3 className="font-display font-black text-display-lg text-navy leading-[0.95]">{state.question.question}</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {state.question.options.map((option, idx) => (
                      <div key={`spectate-opt-${idx}`} className="bg-ghost border-[3px] border-navy rounded-2xl px-4 py-3 min-h-16 flex items-center">
                        <p className="font-display font-black text-lg text-navy">{String.fromCharCode(65 + idx)}. {option}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {phase === "reveal" && (
                <div className="space-y-4">
                  <h3 className="font-display font-black text-display-lg text-navy leading-none">Answer Breakdown</h3>
                  <p className="text-lg font-black text-navy">Correct option: {state.question?.correctOption || "Not available"}</p>
                  <div className="bg-ghost border-2 border-navy/20 rounded-2xl px-4 py-5">
                    {((state.question?.optionDistribution || []).length === 0) && (
                      <div className="mb-3 rounded-xl bg-cloud border border-navy/20 px-3 py-2 text-center">
                        <p className="text-[11px] font-black text-navy-muted uppercase tracking-wider">Awaiting submissions sync</p>
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-3 sm:gap-5 items-end min-h-[18rem] sm:min-h-[20rem]">
                      {(((state.question?.optionDistribution || []).length > 0)
                        ? (state.question?.optionDistribution || [])
                        : (state.question?.options || []).map((option, optionIndex) => ({ optionIndex, option, count: 0, percent: 0 }))).map((opt, distIdx) => (
                        <div key={`spectate-dist-${opt.optionIndex}`} className="h-full flex flex-col items-center justify-end gap-2 animate-elastic-rise" style={{ animationDelay: `${distIdx * 100}ms`, animationFillMode: "both" }}>
                          <p className="font-display font-black text-lg text-navy">{opt.percent}%</p>
                          <div className="w-full h-36 sm:h-44 rounded-t-2xl bg-cloud border-2 border-navy/15 relative overflow-hidden">
                            <div className={`absolute bottom-0 left-0 right-0 ${((state.question?.optionDistribution || []).length === 0) ? "bg-cloud" : state.question?.correctIndex === opt.optionIndex ? "bg-teal" : "bg-lavender"}`} style={{ height: `${Math.max(10, opt.percent)}%` }} />
                          </div>
                          <p className="text-xs font-black text-navy">{opt.count} picks</p>
                          <p className="text-xs font-bold text-navy-muted text-center line-clamp-2">{opt.option}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {phase === "leaderboard" && (
                <div className="space-y-4">
                  <h3 className="font-display font-black text-display-lg text-navy leading-none">Leaderboard Reveal</h3>
                  <p className="text-sm font-bold text-slate">Scores are settling. Current front-runners are shown below.</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {podiumRows.map((row) => (
                      <div key={`leaderboard-reveal-${row.userId}`} className="bg-lavender-light border-[3px] border-navy rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-navy-muted">Rank {row.rank}</p>
                        <p className="font-display font-black text-lg text-navy mt-1 truncate">{row.userName}</p>
                        <p className="font-display font-black text-2xl text-navy mt-2">{row.totalScore}</p>
                      </div>
                    ))}
                    {podiumRows.length === 0 && (
                      <div className="sm:col-span-3 bg-ghost border-2 border-cloud rounded-2xl p-4 text-center">
                        <p className="text-sm text-slate">Leaderboard is syncing...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {phase === "final-reveal" && (
                <div className="space-y-4">
                  <h3 className="font-display font-black text-display-lg text-navy leading-none">Final Podium Reveal</h3>
                  <p className="text-sm font-bold text-slate">The live session has ended and final podium is now revealed.</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {podiumRows.map((row) => (
                      <div
                        key={`final-reveal-${row.userId}`}
                        className={`border-[3px] rounded-2xl p-4 ${row.rank === 1 ? "bg-sunny-light border-navy" : row.rank === 2 ? "bg-cloud border-navy" : "bg-coral-light border-navy"}`}
                      >
                        <p className="text-[10px] font-black uppercase tracking-wider text-navy-muted">#{row.rank}</p>
                        <p className="font-display font-black text-lg text-navy mt-1 truncate">{row.userName}</p>
                        <p className="font-display font-black text-2xl text-navy mt-2">{row.totalScore}</p>
                      </div>
                    ))}
                    {podiumRows.length === 0 && (
                      <div className="sm:col-span-3 bg-ghost border-2 border-cloud rounded-2xl p-4 text-center">
                        <p className="text-sm text-slate">Final podium data not available yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {state.status === "ended" && phase !== "reveal" && phase !== "final-reveal" && (
                <div className="bg-sunny-light border-2 border-navy rounded-2xl p-5 text-center">
                  <p className="font-display font-black text-3xl text-navy">Round Complete</p>
                  <p className="text-sm font-bold text-navy-muted mt-1">Thanks for watching. Final podium highlights may appear shortly.</p>
                </div>
              )}
            </section>

            <aside className="bg-snow border-[4px] border-navy rounded-3xl p-4 shadow-[8px_8px_0_0_#000] space-y-3 sticky top-4">
              <p className="text-label text-navy">Top 10 Leaderboard</p>
              <div className="space-y-2">
                {topRows.map((row) => (
                  <div key={row.userId} className="bg-ghost border-[2px] border-navy rounded-xl px-3 py-2.5 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-display font-black text-base text-navy">#{row.rank} {row.userName}</p>
                    </div>
                    <p className="font-display font-black text-xl text-navy">{row.totalScore}</p>
                  </div>
                ))}
                {topRows.length === 0 && <p className="text-sm text-slate">Leaderboard updates will appear here shortly.</p>}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
