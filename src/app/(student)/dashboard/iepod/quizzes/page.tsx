"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { toast } from "sonner";
import {
  listQuizzes,
  getQuiz,
  submitQuizAnswers,
  getLeaderboard,
  QUIZ_TYPE_LABELS,
  PHASE_LABELS,
} from "@/lib/api";
import type {
  IepodQuiz,
  QuizQuestionPublic,
  QuizResult,
  QuizAnswer,
  LeaderboardEntry,
  IepodQuizType,
} from "@/lib/api";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

type View = "list" | "quiz" | "result" | "leaderboard";

export default function QuizzesPage() {
  const { user } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("iepod-quizzes");
  const [view, setView] = useState<View>("list");
  const [quizzes, setQuizzes] = useState<IepodQuiz[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");

  // Active quiz state
  const [activeQuiz, setActiveQuiz] = useState<IepodQuiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Result state
  const [result, setResult] = useState<QuizResult | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [quizzesRes, lbRes] = await Promise.allSettled([
        listQuizzes({ live_only: true, quiz_type: typeFilter || undefined }),
        getLeaderboard(50),
      ]);

      if (quizzesRes.status === "fulfilled") setQuizzes(quizzesRes.value);
      if (lbRes.status === "fulfilled") setLeaderboard(lbRes.value);
    } catch {
      toast.error("Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

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
        setView("quiz");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load quiz");
    }
  }

  async function handleSubmitQuiz() {
    if (!activeQuiz) return;

    const quizId = activeQuiz._id || activeQuiz.id;
    if (!quizId) return;

    // Build answers array
    const answersList: QuizAnswer[] = questions.map((q, i) => ({
      questionIndex: q.index ?? i,
      selectedOption: answers[i] ?? -1,
    }));

    const unanswered = answersList.filter((a) => a.selectedOption === -1).length;
    if (unanswered > 0) {
      toast.error(`${unanswered} question${unanswered > 1 ? "s" : ""} unanswered. Please answer all questions.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitQuizAnswers(quizId, answersList);
      setResult(res);
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
                onClick={() => { setView("list"); setActiveQuiz(null); setResult(null); }}
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
            {/* filter + leaderboard toggle */}
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime w-full sm:w-auto"
              >
                <option value="">All Types</option>
                {(Object.keys(QUIZ_TYPE_LABELS) as IepodQuizType[]).map((t) => (
                  <option key={t} value={t}>{QUIZ_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <div className="flex-1" />
              <button
                onClick={() => setView("leaderboard")}
                className="bg-navy border-[3px] border-navy px-5 py-2 rounded-xl font-display font-black text-sm text-lime press-3 press-navy whitespace-nowrap"
              >
                Leaderboard
              </button>
            </div>

            {/* Quiz cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {quizzes.map((q) => {
                const qId = q._id || q.id || "";
                return (
                  <div
                    key={qId}
                    className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-display font-black text-base text-navy">{q.title}</h4>
                      <span className="bg-lavender-light text-lavender font-bold text-[10px] px-2 py-0.5 rounded-lg whitespace-nowrap ml-2">
                        {QUIZ_TYPE_LABELS[q.quizType]}
                      </span>
                    </div>

                    {q.description && (
                      <p className="text-navy/70 text-sm mb-3 line-clamp-2">{q.description}</p>
                    )}

                    <div className="flex items-center gap-3 text-slate text-xs mb-4 mt-auto">
                      <span>{q.questionCount ?? q.questions?.length ?? 0} questions</span>
                      {q.timeLimitMinutes && <span>{q.timeLimitMinutes} min</span>}
                      {q.phase && (
                        <span className="bg-ghost px-2 py-0.5 rounded">{PHASE_LABELS[q.phase]}</span>
                      )}
                    </div>

                    <button
                      onClick={() => handleStartQuiz(qId)}
                      className="w-full bg-lime border-[3px] border-navy press-4 press-navy px-4 py-2.5 rounded-xl font-display font-black text-sm text-navy transition-all"
                    >
                      Start Quiz
                    </button>
                  </div>
                );
              })}
              {quizzes.length === 0 && (
                <div className="md:col-span-2 text-center py-12 bg-ghost rounded-3xl border-[3px] border-cloud">
                  <p className="text-slate font-medium">No quizzes available right now.</p>
                  <p className="text-slate text-sm mt-1">Check back later for new challenges!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Active Quiz ────────────────────────────────────── */}
        {view === "quiz" && activeQuiz && questions.length > 0 && (
          <div className="space-y-5">
            {/* Quiz header */}
            <div className="bg-navy border-[4px] border-lime rounded-3xl p-6 shadow-[6px_6px_0_0_#C8F31D]">
              <h3 className="font-display font-black text-xl text-lime">{activeQuiz.title}</h3>
              <p className="text-lime/60 text-sm mt-1">
                Question {currentQ + 1} of {questions.length}
              </p>
              {/* Progress bar */}
              <div className="mt-3 bg-navy-light rounded-full h-2 overflow-hidden">
                <div
                  className="bg-lime h-full rounded-full transition-all"
                  style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question card */}
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000]">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-lavender text-snow font-display font-black text-xs w-8 h-8 rounded-lg flex items-center justify-center">
                  {currentQ + 1}
                </span>
                <span className="text-slate text-xs font-bold">{questions[currentQ].points} pt{questions[currentQ].points > 1 ? "s" : ""}</span>
              </div>
              <h4 className="font-display font-black text-lg text-navy mb-6">
                {questions[currentQ].question}
              </h4>

              <div className="space-y-3">
                {questions[currentQ].options.map((opt, oi) => {
                  const selected = answers[currentQ] === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(currentQ, oi)}
                      className={`w-full text-left flex items-center gap-3 px-5 py-4 rounded-2xl border-[3px] transition-all ${
                        selected
                          ? "bg-lime border-navy"
                          : "bg-ghost border-cloud hover:border-navy"
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-xs ${
                        selected ? "bg-navy text-lime" : "bg-cloud text-slate"
                      }`}>
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className={`font-medium text-sm ${selected ? "text-navy" : "text-navy/80"}`}>
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
                  onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                  disabled={currentQ === 0}
                  className="bg-transparent border-[3px] border-navy px-5 py-2 rounded-xl font-display font-bold text-sm text-navy hover:bg-navy hover:text-lime transition-all disabled:opacity-30"
                >
                  Previous
                </button>

                {/* Question dots */}
                <div className="hidden sm:flex items-center gap-1">
                  {questions.map((_, qi) => (
                    <button
                      key={qi}
                      onClick={() => setCurrentQ(qi)}
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

                {currentQ < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQ(currentQ + 1)}
                    className="bg-navy border-[3px] border-navy px-5 py-2 rounded-xl font-display font-bold text-sm text-lime press-3 press-navy"
                  >
                    Next &rarr;
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitQuiz}
                    disabled={submitting}
                    className="bg-lime border-[4px] border-navy press-5 press-navy px-6 py-2.5 rounded-xl font-display font-black text-sm text-navy transition-all disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit Quiz"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Result ─────────────────────────────────────────── */}
        {view === "result" && result && (
          <div className="space-y-5">
            <div className={`${result.percentage >= 70 ? "bg-teal" : result.percentage >= 50 ? "bg-sunny" : "bg-coral"} border-[4px] border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] text-center`}>
              <h3 className="font-display font-black text-3xl text-navy mb-2">
                {result.score}/{result.maxScore}
              </h3>
              <p className="font-display font-black text-xl text-navy/80">{result.percentage}%</p>
              <p className="text-navy/60 text-sm mt-2">
                {result.percentage >= 70
                  ? "Excellent work! You've demonstrated strong understanding."
                  : result.percentage >= 50
                  ? "Good effort! Review the material and try again."
                  : "Keep studying! The process is what matters."}
              </p>
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
                className="bg-navy border-[3px] border-navy px-6 py-2.5 rounded-xl font-display font-bold text-sm text-lime press-3 press-navy"
              >
                View Leaderboard
              </button>
            </div>
          </div>
        )}

        {/* ── Leaderboard ────────────────────────────────────── */}
        {view === "leaderboard" && (
          <div className="space-y-5">
            <div className="bg-navy border-[4px] border-lime rounded-3xl p-6 shadow-[8px_8px_0_0_#C8F31D]">
              <h3 className="font-display font-black text-xl text-lime mb-4">IEPOD Leaderboard</h3>
              <div className="space-y-2">
                {leaderboard.map((entry) => {
                  const isMe = entry.userId === user?.id;
                  const podium = entry.rank <= 3;
                  return (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        isMe
                          ? "bg-lime/20 border-[2px] border-lime/30"
                          : podium
                          ? "bg-navy-light"
                          : "bg-navy-light/50"
                      }`}
                    >
                      <span className={`font-display font-black text-sm w-8 text-center ${
                        entry.rank === 1
                          ? "text-sunny"
                          : entry.rank === 2
                          ? "text-cloud"
                          : entry.rank === 3
                          ? "text-coral"
                          : "text-lime/40"
                      }`}>
                        #{entry.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${isMe ? "text-lime" : "text-lime/80"}`}>
                          {entry.userName} {isMe && "(You)"}
                        </p>
                        <div className="flex items-center gap-2">
                          {entry.phase && (
                            <span className="text-lime/40 text-[10px]">
                              {PHASE_LABELS[entry.phase]}
                            </span>
                          )}
                          {entry.societyName && (
                            <span className="text-lime/40 text-[10px]">{entry.societyName}</span>
                          )}
                        </div>
                      </div>
                      <span className="font-display font-black text-base text-lime">
                        {entry.totalPoints}
                      </span>
                    </div>
                  );
                })}
                {leaderboard.length === 0 && (
                  <p className="text-lime/50 text-sm text-center py-8">No rankings yet. Be the first!</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
