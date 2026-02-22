"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";

/* ─── Types ─────────────────────────────────────────────────────── */

interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: number; // SM-2: easiness factor (≥1.3)
  interval: number;   // days until next review
  repetitions: number;
  nextReview: string;  // ISO date string
  lastReviewed?: string;
}

interface Deck {
  id: string;
  name: string;
  color: "lime" | "coral" | "lavender" | "teal" | "sunny";
  icon: string;
  cards: Flashcard[];
  createdAt: string;
}

type ViewMode = "decks" | "study" | "manage";

const STORAGE_KEY = "iesa-flashcards-data";
const DECK_ICONS = ["📚", "🧪", "⚙️", "📐", "🔬", "💻", "📊", "🏭", "🔧", "📏"];
const COLORS: Deck["color"][] = ["lime", "coral", "lavender", "teal", "sunny"];

const COLOR_MAP: Record<string, { bg: string; light: string; text: string }> = {
  lime: { bg: "bg-lime", light: "bg-lime-light", text: "text-navy" },
  coral: { bg: "bg-coral", light: "bg-coral-light", text: "text-snow" },
  lavender: { bg: "bg-lavender", light: "bg-lavender-light", text: "text-snow" },
  teal: { bg: "bg-teal", light: "bg-teal-light", text: "text-navy" },
  sunny: { bg: "bg-sunny", light: "bg-sunny-light", text: "text-navy" },
};

/* ─── SM-2 Algorithm ────────────────────────────────────────────── */

function sm2(card: Flashcard, quality: number): Partial<Flashcard> {
  // quality: 0-5 (0=forgot, 3=hard, 4=good, 5=easy)
  let { difficulty, interval, repetitions } = card;

  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * difficulty);
    repetitions++;
  } else {
    repetitions = 0;
    interval = 1;
  }

  difficulty = Math.max(
    1.3,
    difficulty + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  const next = new Date();
  next.setDate(next.getDate() + interval);

  return {
    difficulty,
    interval,
    repetitions,
    nextReview: next.toISOString().split("T")[0],
    lastReviewed: new Date().toISOString().split("T")[0],
  };
}

function getDueCards(deck: Deck): Flashcard[] {
  const today = new Date().toISOString().split("T")[0];
  return deck.cards.filter((c) => c.nextReview <= today);
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function FlashcardsPage() {
  const { showHelp, openHelp, closeHelp } = useToolHelp("flashcards");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [view, setView] = useState<ViewMode>("decks");
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [showDeckForm, setShowDeckForm] = useState(false);
  const [editDeckId, setEditDeckId] = useState<string | null>(null);

  // Study state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dueQueue, setDueQueue] = useState<Flashcard[]>([]);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });

  // Card form state
  const [showCardForm, setShowCardForm] = useState(false);
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");

  // Deck form state
  const [deckName, setDeckName] = useState("");
  const [deckColor, setDeckColor] = useState<Deck["color"]>("lime");
  const [deckIcon, setDeckIcon] = useState("📚");

  const cardRef = useRef<HTMLDivElement>(null);

  // Load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setDecks(JSON.parse(saved));
    } catch {
      console.error("Failed to load flashcards");
    }
  }, []);

  const persist = useCallback((data: Deck[]) => {
    setDecks(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const activeDeck = decks.find((d) => d.id === activeDeckId) || null;

  // ─── Deck CRUD ─────────────────────────────────────────────
  const resetDeckForm = () => {
    setDeckName("");
    setDeckColor("lime");
    setDeckIcon("📚");
    setEditDeckId(null);
    setShowDeckForm(false);
  };

  const saveDeck = () => {
    if (!deckName.trim()) return;
    if (editDeckId) {
      persist(decks.map((d) => (d.id === editDeckId ? { ...d, name: deckName.trim(), color: deckColor, icon: deckIcon } : d)));
    } else {
      const newDeck: Deck = {
        id: Date.now().toString(36),
        name: deckName.trim(),
        color: deckColor,
        icon: deckIcon,
        cards: [],
        createdAt: new Date().toISOString(),
      };
      persist([...decks, newDeck]);
    }
    resetDeckForm();
  };

  const deleteDeck = (id: string) => {
    if (!confirm("Delete this deck and all its cards?")) return;
    persist(decks.filter((d) => d.id !== id));
    if (activeDeckId === id) {
      setActiveDeckId(null);
      setView("decks");
    }
  };

  // ─── Card CRUD ─────────────────────────────────────────────
  const resetCardForm = () => {
    setCardFront("");
    setCardBack("");
    setEditCardId(null);
    setShowCardForm(false);
  };

  const saveCard = () => {
    if (!cardFront.trim() || !cardBack.trim() || !activeDeckId) return;
    persist(
      decks.map((d) => {
        if (d.id !== activeDeckId) return d;
        if (editCardId) {
          return { ...d, cards: d.cards.map((c) => (c.id === editCardId ? { ...c, front: cardFront.trim(), back: cardBack.trim() } : c)) };
        }
        const newCard: Flashcard = {
          id: Date.now().toString(36),
          front: cardFront.trim(),
          back: cardBack.trim(),
          difficulty: 2.5,
          interval: 0,
          repetitions: 0,
          nextReview: new Date().toISOString().split("T")[0],
        };
        return { ...d, cards: [...d.cards, newCard] };
      })
    );
    resetCardForm();
  };

  const deleteCard = (cardId: string) => {
    if (!activeDeckId) return;
    persist(decks.map((d) => (d.id === activeDeckId ? { ...d, cards: d.cards.filter((c) => c.id !== cardId) } : d)));
  };

  // ─── Study ─────────────────────────────────────────────────
  const startStudy = (deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    const due = getDueCards(deck);
    if (due.length === 0) return;
    setDueQueue([...due]);
    setCurrentIndex(0);
    setFlipped(false);
    setSessionStats({ reviewed: 0, correct: 0 });
    setActiveDeckId(deckId);
    setView("study");
  };

  const answerCard = (quality: number) => {
    if (!activeDeckId || currentIndex >= dueQueue.length) return;
    const card = dueQueue[currentIndex];
    const updates = sm2(card, quality);

    persist(
      decks.map((d) => {
        if (d.id !== activeDeckId) return d;
        return { ...d, cards: d.cards.map((c) => (c.id === card.id ? { ...c, ...updates } : c)) };
      })
    );

    setSessionStats((s) => ({
      reviewed: s.reviewed + 1,
      correct: quality >= 3 ? s.correct + 1 : s.correct,
    }));

    if (currentIndex + 1 < dueQueue.length) {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
    } else {
      setView("decks");
      setActiveDeckId(null);
    }
  };

  // ─── Stats ─────────────────────────────────────────────────
  const totalCards = decks.reduce((sum, d) => sum + d.cards.length, 0);
  const totalDue = decks.reduce((sum, d) => sum + getDueCards(d).length, 0);

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Flashcards" />
      <ToolHelpModal toolId="flashcards" isOpen={showHelp} onClose={closeHelp} />

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
          <div className="md:col-span-7 bg-lavender border-[5px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[180px] flex flex-col justify-between">
            <div className="absolute -bottom-14 -right-14 w-40 h-40 rounded-full bg-navy/8 pointer-events-none" />
            <svg className="absolute top-6 right-10 w-5 h-5 text-snow/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <div>
              <p className="text-[10px] font-bold text-snow/50 uppercase tracking-[0.15em] mb-2">Active Recall</p>
              <h1 className="font-display font-black text-3xl md:text-4xl text-snow leading-[0.95]">
                Flashcards
              </h1>
              <p className="text-sm text-snow/60 mt-3 max-w-md">
                Create study decks, master concepts with spaced repetition, and ace your exams.
              </p>
            </div>
          </div>

          <div className="md:col-span-5 grid grid-cols-2 gap-3">
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Decks</p>
              <p className="font-display font-black text-3xl text-navy mt-2">{decks.length}</p>
            </div>
            <div className="bg-coral-light border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Due Now</p>
              <p className="font-display font-black text-3xl text-navy mt-2">{totalDue}</p>
            </div>
            <div className="bg-lavender-light border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] rotate-[-0.3deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Total Cards</p>
              <p className="font-display font-black text-3xl text-navy mt-2">{totalCards}</p>
            </div>
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Mastered</p>
              <p className="font-display font-black text-3xl text-navy mt-2">
                {decks.reduce((s, d) => s + d.cards.filter((c) => c.repetitions >= 5).length, 0)}
              </p>
            </div>
          </div>
        </div>

        {/* ═══ STUDY MODE ═══ */}
        {view === "study" && activeDeck && dueQueue.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-8 rounded-full bg-coral" />
                <h2 className="font-display font-black text-xl text-navy">
                  Studying: {activeDeck.name}
                </h2>
              </div>
              <button
                onClick={() => { setView("decks"); setActiveDeckId(null); }}
                className="text-sm font-bold text-slate hover:text-navy"
              >
                End Session
              </button>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 bg-cloud rounded-full h-2.5 border-[2px] border-navy/10 overflow-hidden">
                <div
                  className="h-full bg-lavender rounded-full transition-all"
                  style={{ width: `${((currentIndex + 1) / dueQueue.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate">{currentIndex + 1}/{dueQueue.length}</span>
            </div>

            {/* Card */}
            <div
              ref={cardRef}
              onClick={() => setFlipped(!flipped)}
              className="relative cursor-pointer"
              style={{ perspective: "1000px" }}
            >
              <div
                className="relative transition-transform duration-500"
                style={{
                  transformStyle: "preserve-3d",
                  transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Front */}
                <div
                  className={`${COLOR_MAP[activeDeck.color].light} border-[4px] border-navy rounded-3xl shadow-[3px_3px_0_0_#000] p-8 md:p-12 min-h-[250px] flex flex-col items-center justify-center text-center`}
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <p className="text-[10px] font-bold text-slate uppercase tracking-wider mb-3">Question</p>
                  <p className="font-display font-black text-xl md:text-2xl text-navy whitespace-pre-wrap">
                    {dueQueue[currentIndex]?.front}
                  </p>
                  <p className="text-xs text-slate mt-6">Tap to reveal answer</p>
                </div>

                {/* Back */}
                <div
                  className="bg-snow border-[4px] border-navy rounded-3xl shadow-[3px_3px_0_0_#000] p-8 md:p-12 min-h-[250px] flex flex-col items-center justify-center text-center absolute inset-0"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <p className="text-[10px] font-bold text-teal uppercase tracking-wider mb-3">Answer</p>
                  <p className="font-display font-bold text-lg md:text-xl text-navy whitespace-pre-wrap">
                    {dueQueue[currentIndex]?.back}
                  </p>
                </div>
              </div>
            </div>

            {/* Rating buttons (visible when flipped) */}
            {flipped && (
              <div className="mt-5 space-y-3">
                <p className="text-xs font-bold text-slate text-center uppercase tracking-wider">How well did you know it?</p>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => answerCard(1)}
                    className="bg-coral text-snow border-[3px] border-navy rounded-xl py-3 font-display font-bold text-sm press-3 press-black transition-all"
                  >
                    Forgot
                  </button>
                  <button
                    onClick={() => answerCard(3)}
                    className="bg-sunny text-navy border-[3px] border-navy rounded-xl py-3 font-display font-bold text-sm press-3 press-black transition-all"
                  >
                    Hard
                  </button>
                  <button
                    onClick={() => answerCard(4)}
                    className="bg-teal text-navy border-[3px] border-navy rounded-xl py-3 font-display font-bold text-sm press-3 press-black transition-all"
                  >
                    Good
                  </button>
                  <button
                    onClick={() => answerCard(5)}
                    className="bg-lime text-navy border-[3px] border-navy rounded-xl py-3 font-display font-bold text-sm press-3 press-black transition-all"
                  >
                    Easy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ MANAGE MODE ═══ */}
        {view === "manage" && activeDeck && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setView("decks"); setActiveDeckId(null); }}
                  className="w-8 h-8 rounded-lg bg-ghost border-[2px] border-navy/20 hover:border-navy flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-navy" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <div>
                  <h2 className="font-display font-black text-xl text-navy">{activeDeck.name}</h2>
                  <p className="text-xs text-slate">{activeDeck.cards.length} cards</p>
                </div>
              </div>
              <button
                onClick={() => { resetCardForm(); setShowCardForm(true); }}
                className="bg-lime border-[3px] border-navy press-3 press-navy px-4 py-2 rounded-xl font-display font-bold text-sm text-navy transition-all"
              >
                + Add Card
              </button>
            </div>

            {/* Cards list */}
            {activeDeck.cards.length === 0 ? (
              <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] p-10 text-center">
                <p className="text-sm text-slate mb-4">No cards in this deck yet.</p>
                <button
                  onClick={() => { resetCardForm(); setShowCardForm(true); }}
                  className="bg-lime border-[3px] border-navy shadow-[3px_3px_0_0_#0F0F2D] px-6 py-3 rounded-xl font-display font-bold text-sm text-navy transition-all"
                >
                  Add Your First Card
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeDeck.cards.map((card, i) => (
                  <div key={card.id} className="bg-snow border-[3px] border-navy rounded-2xl overflow-hidden shadow-[3px_3px_0_0_#000]">
                    <div className="flex items-start gap-3 p-4">
                      <span className="text-xs font-display font-black text-navy/20 mt-1 w-6 text-center">{String(i + 1).padStart(2, "0")}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-navy mb-1">{card.front}</p>
                        <p className="text-xs text-slate">{card.back}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] font-bold text-slate uppercase tracking-wider">
                            {card.repetitions >= 5 ? "Mastered" : card.repetitions > 0 ? `Rep: ${card.repetitions}` : "New"}
                          </span>
                          {card.lastReviewed && (
                            <span className="text-[10px] text-slate">Last: {card.lastReviewed}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setCardFront(card.front);
                            setCardBack(card.back);
                            setEditCardId(card.id);
                            setShowCardForm(true);
                          }}
                          className="w-7 h-7 rounded-lg bg-ghost hover:bg-lime-light flex items-center justify-center transition-colors"
                        >
                          <svg className="w-3 h-3 text-navy/40" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteCard(card.id)}
                          className="w-7 h-7 rounded-lg bg-ghost hover:bg-coral-light flex items-center justify-center transition-colors"
                        >
                          <svg className="w-3 h-3 text-navy/40" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ DECKS VIEW ═══ */}
        {view === "decks" && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-8 rounded-full bg-lavender" />
                <h2 className="font-display font-black text-xl text-navy">Your Decks</h2>
              </div>
              <button
                onClick={() => { resetDeckForm(); setShowDeckForm(true); }}
                className="bg-lime border-[3px] border-navy press-3 press-navy px-4 py-2 rounded-xl font-display font-bold text-sm text-navy transition-all"
              >
                + New Deck
              </button>
            </div>

            {/* Session complete toast */}
            {sessionStats.reviewed > 0 && (
              <div className="bg-teal-light border-[4px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] mb-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal border-[3px] border-navy flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-navy" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-display font-black text-base text-navy">Session Complete!</p>
                  <p className="text-xs text-navy/60 mt-0.5">
                    Reviewed {sessionStats.reviewed} cards &middot; {sessionStats.correct} correct ({sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0}%)
                  </p>
                </div>
                <button
                  onClick={() => setSessionStats({ reviewed: 0, correct: 0 })}
                  className="text-slate hover:text-navy"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {decks.length === 0 ? (
              <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] p-10 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-lavender-light flex items-center justify-center">
                  <svg className="w-8 h-8 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
                  </svg>
                </div>
                <h3 className="font-display font-black text-xl text-navy mb-2">Create Your First Deck</h3>
                <p className="text-sm text-slate mb-6 max-w-sm mx-auto">
                  Organize flashcards by course or topic for efficient studying.
                </p>
                <button
                  onClick={() => { resetDeckForm(); setShowDeckForm(true); }}
                  className="bg-lime border-[4px] border-navy shadow-[3px_3px_0_0_#0F0F2D] px-8 py-3.5 rounded-2xl font-display font-black text-base text-navy transition-all"
                >
                  Create a Deck
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {decks.map((deck) => {
                  const c = COLOR_MAP[deck.color];
                  const due = getDueCards(deck).length;
                  const mastered = deck.cards.filter((c) => c.repetitions >= 5).length;
                  return (
                    <div key={deck.id} className="bg-snow border-[4px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] overflow-hidden">
                      <div className={`${c.light} border-b-[3px] border-navy px-5 py-4 flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{deck.icon}</span>
                          <div>
                            <h3 className="font-display font-black text-base text-navy">{deck.name}</h3>
                            <p className="text-[10px] font-bold text-navy/40 uppercase tracking-wider">
                              {deck.cards.length} cards
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setDeckName(deck.name);
                              setDeckColor(deck.color);
                              setDeckIcon(deck.icon);
                              setEditDeckId(deck.id);
                              setShowDeckForm(true);
                            }}
                            className="w-7 h-7 rounded-lg bg-snow/60 hover:bg-snow flex items-center justify-center"
                          >
                            <svg className="w-3 h-3 text-navy/40" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteDeck(deck.id)}
                            className="w-7 h-7 rounded-lg bg-snow/60 hover:bg-coral-light flex items-center justify-center"
                          >
                            <svg className="w-3 h-3 text-navy/40" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="flex gap-4 mb-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate uppercase tracking-wider">Due</p>
                            <p className={`font-display font-black text-xl ${due > 0 ? "text-coral" : "text-navy"}`}>{due}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate uppercase tracking-wider">Mastered</p>
                            <p className="font-display font-black text-xl text-teal">{mastered}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate uppercase tracking-wider">New</p>
                            <p className="font-display font-black text-xl text-navy">{deck.cards.filter((c) => c.repetitions === 0).length}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {due > 0 && (
                            <button
                              onClick={() => startStudy(deck.id)}
                              className="flex-1 bg-lime border-[3px] border-navy press-3 press-navy px-4 py-2.5 rounded-xl font-display font-bold text-sm text-navy transition-all"
                            >
                              Study ({due})
                            </button>
                          )}
                          <button
                            onClick={() => { setActiveDeckId(deck.id); setView("manage"); }}
                            className="flex-1 bg-snow border-[3px] border-navy px-4 py-2.5 rounded-xl font-display font-bold text-sm text-navy transition-all hover:bg-ghost"
                          >
                            Manage
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ DECK FORM MODAL ═══ */}
        {showDeckForm && (
          <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center px-4 pt-4 pb-20 md:p-6" onClick={resetDeckForm}>
            <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="border-b-[3px] border-navy px-6 py-4 flex items-center justify-between bg-ghost rounded-t-[1.25rem]">
                <h3 className="font-display font-black text-lg text-navy">
                  {editDeckId ? "Edit Deck" : "New Deck"}
                </h3>
                <button onClick={resetDeckForm} className="text-slate hover:text-navy">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Deck Name</label>
                  <input
                    type="text"
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    placeholder="e.g., Operations Research"
                    className="w-full bg-snow border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy font-medium focus:border-teal focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {DECK_ICONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setDeckIcon(icon)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                          deckIcon === icon ? "bg-lime border-[3px] border-navy scale-110" : "bg-ghost border-[2px] border-navy/10 hover:border-navy/30"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Color</label>
                  <div className="flex gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setDeckColor(color)}
                        className={`w-10 h-10 rounded-xl ${COLOR_MAP[color].bg} border-[3px] transition-all ${
                          deckColor === color ? "border-navy scale-110" : "border-transparent hover:border-navy/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={saveDeck}
                  disabled={!deckName.trim()}
                  className="w-full bg-lime border-[4px] border-navy shadow-[3px_3px_0_0_#0F0F2D] px-6 py-3.5 rounded-2xl font-display font-black text-base text-navy transition-all disabled:opacity-40"
                >
                  {editDeckId ? "Update Deck" : "Create Deck"}
                </button>
                {editDeckId && (
                  <button
                    onClick={() => { deleteDeck(editDeckId); resetDeckForm(); }}
                    className="w-full text-coral text-sm font-bold hover:underline"
                  >
                    Delete this deck
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ CARD FORM MODAL ═══ */}
        {showCardForm && (
          <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center px-4 pt-4 pb-20 md:p-6" onClick={resetCardForm}>
            <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="border-b-[3px] border-navy px-6 py-4 flex items-center justify-between bg-ghost rounded-t-[1.25rem]">
                <h3 className="font-display font-black text-lg text-navy">
                  {editCardId ? "Edit Card" : "Add Card"}
                </h3>
                <button onClick={resetCardForm} className="text-slate hover:text-navy">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Front (Question)</label>
                  <textarea
                    value={cardFront}
                    onChange={(e) => setCardFront(e.target.value)}
                    placeholder="What is the question?"
                    rows={3}
                    className="w-full bg-snow border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy font-medium focus:border-teal focus:outline-none transition-colors resize-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Back (Answer)</label>
                  <textarea
                    value={cardBack}
                    onChange={(e) => setCardBack(e.target.value)}
                    placeholder="What is the answer?"
                    rows={3}
                    className="w-full bg-snow border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy font-medium focus:border-teal focus:outline-none transition-colors resize-none"
                  />
                </div>
                <button
                  onClick={saveCard}
                  disabled={!cardFront.trim() || !cardBack.trim()}
                  className="w-full bg-lime border-[4px] border-navy shadow-[3px_3px_0_0_#0F0F2D] px-6 py-3.5 rounded-2xl font-display font-black text-base text-navy transition-all disabled:opacity-40"
                >
                  {editCardId ? "Update Card" : "Add Card"}
                </button>
              </div>
            </div>
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
