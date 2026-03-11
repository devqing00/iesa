"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { useGrowthData } from "@/hooks/useGrowthData";
import Link from "next/link";
import { useState, useCallback, useRef, ReactNode } from "react";

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

/* ─── SVG Icon System (replaces emoji) ─────────────────────────── */

const DECK_ICON_SVGS: Record<string, ReactNode> = {
  books: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z"/></svg>,
  lab: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M10.5 3.798v5.02a3 3 0 0 1-.879 2.121l-2.377 2.377a9.845 9.845 0 0 1 5.091 1.013 8.315 8.315 0 0 0 5.713.636l.285-.071-3.954-3.955A3 3 0 0 1 13.5 8.818v-5.02a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75ZM8.75 1.5a.75.75 0 0 0 0 1.5h.75v5.318a1.5 1.5 0 0 1-.44 1.06L6.19 12.248A10.056 10.056 0 0 0 3 12a.75.75 0 0 0 0 1.5c.027 0 .054.001.08.002 1.093.043 2.143.335 3.08.842.529.286 1.097.524 1.697.706C9.39 18.792 10.654 21 12 21c1.346 0 2.61-2.208 4.143-5.95a9.838 9.838 0 0 0 1.697-.706c.937-.507 1.987-.8 3.08-.842.027-.001.054-.002.08-.002a.75.75 0 0 0 0-1.5c-1.024 0-2.02.166-2.952.469l-.285.071a9.815 9.815 0 0 1-6.768-.753 8.344 8.344 0 0 0-3.045-.881l2.94-2.94A3 3 0 0 0 12 6.818V3h.75a.75.75 0 0 0 0-1.5h-4Z" clipRule="evenodd"/></svg>,
  gear: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.463 7.463 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd"/></svg>,
  ruler: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd"/><path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-8.25V3Z" clipRule="evenodd"/></svg>,
  microscope: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.644 1.59a.75.75 0 0 1 .712 0l9.75 5.25a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.712 0l-9.75-5.25a.75.75 0 0 1 0-1.32l9.75-5.25Z"/><path d="m3.265 10.602 7.668 4.129a2.25 2.25 0 0 0 2.134 0l7.668-4.13 1.37.739a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.71 0l-9.75-5.25a.75.75 0 0 1 0-1.32l1.37-.738Z"/><path d="m10.933 19.231-7.668-4.13-1.37.739a.75.75 0 0 0 0 1.32l9.75 5.25c.221.12.489.12.71 0l9.75-5.25a.75.75 0 0 0 0-1.32l-1.37-.738-7.668 4.13a2.25 2.25 0 0 1-2.134 0Z"/></svg>,
  code: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M14.447 3.026a.75.75 0 0 1 .527.921l-4.5 16.5a.75.75 0 0 1-1.448-.394l4.5-16.5a.75.75 0 0 1 .921-.527ZM16.72 6.22a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06L21.44 12l-4.72-4.72a.75.75 0 0 1 0-1.06Zm-9.44 0a.75.75 0 0 1 0 1.06L2.56 12l4.72 4.72a.75.75 0 0 1-1.06 1.06L.97 12.53a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd"/></svg>,
  chart: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd"/><path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-8.25V3Z" clipRule="evenodd"/></svg>,
  factory: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.006 3.705a.75.75 0 1 0-.512-1.41L6 6.838V3a.75.75 0 0 0-.75-.75h-1.5A.75.75 0 0 0 3 3v4.93l-1.006.365a.75.75 0 0 0 .512 1.41l16.5-6Z"/><path fillRule="evenodd" d="M3.019 11.114 18 5.667V9.56l4.759 1.653a.75.75 0 0 1 .491.71v9.327a.75.75 0 0 1-.75.75H1.5a.75.75 0 0 1-.75-.75V13.5a.75.75 0 0 1 .512-.71l1.757-.61v-1.066ZM12 12.75a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-.75-.75Zm-2.25 3.75a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1 0-1.5H9a.75.75 0 0 1 .75.75Zm4.508-.75a.75.75 0 0 0 0 1.5h.008a.75.75 0 0 0 0-1.5h-.008Z" clipRule="evenodd"/></svg>,
  wrench: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 6.75a5.25 5.25 0 0 1 6.775-5.025.75.75 0 0 1 .313 1.248l-3.32 3.319c.063.475.276.934.641 1.299.365.365.824.578 1.3.64l3.318-3.319a.75.75 0 0 1 1.248.313 5.25 5.25 0 0 1-5.472 6.756c-1.018-.086-1.87.1-2.309.634L7.344 21.3A3.298 3.298 0 1 1 2.7 16.657l8.684-7.151c.533-.44.72-1.291.634-2.309A5.342 5.342 0 0 1 12 6.75ZM4.117 19.125a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 0 1.5h-.008a.75.75 0 0 1-.75-.75Z" clipRule="evenodd"/></svg>,
  measure: <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd"/><path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z"/></svg>,
};

// Legacy emoji → new key fallback (for existing stored data)
const DECK_EMOJI_TO_KEY: Record<string, string> = {
  "📚": "books", "🧪": "lab", "⚙️": "gear", "📐": "ruler",
  "🔬": "microscope", "💻": "code", "📊": "chart", "🏭": "factory",
  "🔧": "wrench", "📏": "measure",
};

const DECK_ICON_KEYS = Object.keys(DECK_ICON_SVGS);

/** Render a deck icon — handles both new SVG keys and legacy emojis. */
function DeckIcon({ icon, className = "" }: { icon: string; className?: string }) {
  if (DECK_ICON_SVGS[icon]) return <span className={className}>{DECK_ICON_SVGS[icon]}</span>;
  const mapped = DECK_EMOJI_TO_KEY[icon];
  if (mapped && DECK_ICON_SVGS[mapped]) return <span className={className}>{DECK_ICON_SVGS[mapped]}</span>;
  return <span className={className}>{icon}</span>;
}

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
  const [decks, setDecks] = useGrowthData<Deck[]>('flashcards', STORAGE_KEY, []);
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
  const [deckIcon, setDeckIcon] = useState("books");

  const cardRef = useRef<HTMLDivElement>(null);

  const persist = useCallback((data: Deck[]) => {
    setDecks(data);
  }, [setDecks]);

  const activeDeck = decks.find((d) => d.id === activeDeckId) || null;

  // ─── Deck CRUD ─────────────────────────────────────────────
  const resetDeckForm = () => {
    setDeckName("");
    setDeckColor("lime");
    setDeckIcon("books");
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
            <svg aria-hidden="true" className="w-4 h-4 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
            Back to Growth Hub
          </Link>
          <HelpButton onClick={openHelp} />
        </div>

        {/* ═══ BENTO HERO ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          <div className="md:col-span-7 bg-lavender border-[3px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[180px] flex flex-col justify-between">
            <div className="absolute -bottom-14 -right-14 w-40 h-40 rounded-full bg-navy/8 pointer-events-none" />
            <svg aria-hidden="true" className="absolute top-6 right-10 w-5 h-5 text-snow/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
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
            <div className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Decks</p>
              <p className="font-display font-black text-3xl text-navy mt-2">{decks.length}</p>
            </div>
            <div className="bg-coral-light border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Due Now</p>
              <p className="font-display font-black text-3xl text-navy mt-2">{totalDue}</p>
            </div>
            <div className="bg-lavender-light border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] rotate-[-0.3deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Total Cards</p>
              <p className="font-display font-black text-3xl text-navy mt-2">{totalCards}</p>
            </div>
            <div className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex flex-col justify-between">
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
                  className={`${COLOR_MAP[activeDeck.color].light} border-[3px] border-navy rounded-3xl shadow-[3px_3px_0_0_#000] p-8 md:p-12 min-h-[250px] flex flex-col items-center justify-center text-center`}
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
                  className="bg-snow border-[3px] border-navy rounded-3xl shadow-[3px_3px_0_0_#000] p-8 md:p-12 min-h-[250px] flex flex-col items-center justify-center text-center absolute inset-0"
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
                  <svg aria-hidden="true" className="w-4 h-4 text-navy" viewBox="0 0 24 24" fill="currentColor">
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
              <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] p-10 text-center">
                <p className="text-sm text-slate mb-4">No cards in this deck yet.</p>
                <button
                  onClick={() => { resetCardForm(); setShowCardForm(true); }}
                  className="bg-lime border-[3px] border-navy px-6 py-3 rounded-xl font-display font-bold text-sm text-navy press-2 press-navy transition-all"
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
                          className="w-7 h-7 rounded-lg bg-ghost hover:bg-cloud flex items-center justify-center transition-colors"
                        >
                          <svg aria-hidden="true" className="w-3 h-3 text-navy/40" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteCard(card.id)}
                          className="w-7 h-7 rounded-lg bg-ghost hover:bg-coral-light flex items-center justify-center transition-colors"
                        >
                          <svg aria-hidden="true" className="w-3 h-3 text-navy/40" viewBox="0 0 24 24" fill="currentColor">
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
              <div className="bg-teal-light border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] mb-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal border-[3px] border-navy flex items-center justify-center shrink-0">
                  <svg aria-hidden="true" className="w-6 h-6 text-navy" viewBox="0 0 24 24" fill="currentColor">
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
                  <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {decks.length === 0 ? (
              <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] p-10 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-lavender-light flex items-center justify-center">
                  <svg aria-hidden="true" className="w-8 h-8 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
                  </svg>
                </div>
                <h3 className="font-display font-black text-xl text-navy mb-2">Create Your First Deck</h3>
                <p className="text-sm text-slate mb-6 max-w-sm mx-auto">
                  Organize flashcards by course or topic for efficient studying.
                </p>
                <button
                  onClick={() => { resetDeckForm(); setShowDeckForm(true); }}
                  className="bg-lime border-[3px] border-navy px-8 py-3.5 rounded-2xl font-display font-black text-base text-navy press-2 press-navy transition-all"
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
                    <div key={deck.id} className="bg-snow border-[3px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] overflow-hidden">
                      <div className={`${c.light} border-b-[3px] border-navy px-5 py-4 flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                          <DeckIcon icon={deck.icon} className="text-xl" />
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
                            <svg aria-hidden="true" className="w-3 h-3 text-navy/40" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteDeck(deck.id)}
                            className="w-7 h-7 rounded-lg bg-snow/60 hover:bg-coral-light flex items-center justify-center"
                          >
                            <svg aria-hidden="true" className="w-3 h-3 text-navy/40" viewBox="0 0 24 24" fill="currentColor">
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
          <div className="fixed inset-0 bg-navy/40 z-[70] flex items-center justify-center px-4 py-4 sm:p-6" onClick={resetDeckForm}>
            <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="border-b-[3px] border-navy px-6 py-4 flex items-center justify-between bg-ghost rounded-t-[1.25rem]">
                <h3 className="font-display font-black text-lg text-navy">
                  {editDeckId ? "Edit Deck" : "New Deck"}
                </h3>
                <button onClick={resetDeckForm} className="text-slate hover:text-navy">
                  <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
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
                    {DECK_ICON_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => setDeckIcon(key)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          deckIcon === key ? "bg-lime border-[3px] border-navy scale-110" : "bg-ghost border-[2px] border-navy/10 hover:border-navy/30"
                        }`}
                      >
                        <DeckIcon icon={key} />
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
                  className="w-full bg-lime border-[3px] border-navy px-6 py-3.5 rounded-2xl font-display font-black text-base text-navy press-2 press-navy transition-all disabled:opacity-40"
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
          <div className="fixed inset-0 bg-navy/40 z-[70] flex items-center justify-center px-4 py-4 sm:p-6" onClick={resetCardForm}>
            <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="border-b-[3px] border-navy px-6 py-4 flex items-center justify-between bg-ghost rounded-t-[1.25rem]">
                <h3 className="font-display font-black text-lg text-navy">
                  {editCardId ? "Edit Card" : "Add Card"}
                </h3>
                <button onClick={resetCardForm} className="text-slate hover:text-navy">
                  <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
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
                  className="w-full bg-lime border-[3px] border-navy px-6 py-3.5 rounded-2xl font-display font-black text-base text-navy press-2 press-navy transition-all disabled:opacity-40"
                >
                  {editCardId ? "Update Card" : "Add Card"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Privacy */}
        <div className="mt-8 text-center flex items-center justify-center gap-1.5">
          <svg aria-hidden="true" className="w-3 h-3 text-teal" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M4.5 9.75a6 6 0 0111.573-2.226 3.75 3.75 0 014.133 4.303A4.5 4.5 0 0118 20.25H6.75a5.25 5.25 0 01-.75-10.5z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] font-bold text-teal uppercase tracking-wider">Synced to your account</span>
        </div>
      </div>
    </div>
  );
}
