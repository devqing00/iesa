"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";

/* ─── Types ───────────────────────────────────────────────── */
interface Course {
  id: string;
  name: string;
  credits: number;
  grade: string;
}

interface SemesterRecord {
  id: string;
  semester: string;
  gpa: number;
  credits: number;
  courses: Course[];
  timestamp: string;
  gradingSystem?: "4.0" | "5.0";
}

type GradingSystem = "4.0" | "5.0";

/* ─── Constants ───────────────────────────────────────────── */
const GRADING_SYSTEMS: Record<
  GradingSystem,
  { grades: Record<string, number>; maxGpa: number; label: string }
> = {
  "5.0": {
    grades: { A: 5.0, B: 4.0, C: 3.0, D: 2.0, E: 1.0, F: 0.0 },
    maxGpa: 5.0,
    label: "5-Point (Nigerian)",
  },
  "4.0": {
    grades: { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 },
    maxGpa: 4.0,
    label: "4-Point (US)",
  },
};

const MOTIVATIONAL_MESSAGES = {
  excellent: [
    "You're crushing it!",
    "Academic excellence!",
    "Outstanding performance!",
  ],
  good: [
    "Great progress! Keep pushing!",
    "You're on the right track!",
    "Solid work!",
  ],
  average: [
    "Room for growth! You got this!",
    "Every step counts!",
    "Building momentum!",
  ],
  needsWork: [
    "New semester, new opportunities!",
    "Focus and rise!",
    "Your comeback starts now!",
  ],
};

/* ─── Grade color mapping for pills ───────────────────────── */
const GRADE_COLORS: Record<string, string> = {
  A: "bg-teal text-navy",
  B: "bg-lavender text-snow",
  C: "bg-sunny text-navy",
  D: "bg-coral text-snow",
  E: "bg-coral/70 text-snow",
  F: "bg-navy text-snow",
};

/* ─── Component ───────────────────────────────────────────── */
export default function CgpaPage() {
  const [gradingSystem, setGradingSystem] = useState<GradingSystem>("5.0");
  const [courses, setCourses] = useState<Course[]>([
    { id: "1", name: "", credits: 3, grade: "A" },
  ]);
  const [previousCGPA, setPreviousCGPA] = useState("");
  const [previousCredits, setPreviousCredits] = useState("");
  const [targetCGPA, setTargetCGPA] = useState("");
  const [history, setHistory] = useState<SemesterRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [motivationIndex, setMotivationIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const { showHelp, openHelp, closeHelp } = useToolHelp("cgpa");

  const currentGrading = GRADING_SYSTEMS[gradingSystem];

  useEffect(() => {
    try {
      const saved = localStorage.getItem("iesa-cgpa-history");
      if (saved) setHistory(JSON.parse(saved));
      const savedSystem = localStorage.getItem("iesa-grading-system") as GradingSystem;
      if (savedSystem && GRADING_SYSTEMS[savedSystem]) setGradingSystem(savedSystem);
    } catch {
      console.error("Failed to load CGPA data");
    }
    setMotivationIndex(Math.floor(Math.random() * 3));
  }, []);

  const handleGradingSystemChange = (system: GradingSystem) => {
    setGradingSystem(system);
    localStorage.setItem("iesa-grading-system", system);
    setCourses(courses.map((c) => ({ ...c, grade: "A" })));
    if (hasInteracted) setHasInteracted(false);
  };

  /* ─── Calculations ──────────────────────────────────────── */
  const result = useMemo(() => {
    let totalPoints = 0;
    let totalCredits = 0;
    let semesterPoints = 0;
    let semesterCredits = 0;

    courses.forEach((course) => {
      const points = currentGrading.grades[course.grade] ?? 0;
      semesterPoints += points * course.credits;
      semesterCredits += course.credits;
    });

    const semesterGPA = semesterCredits > 0 ? semesterPoints / semesterCredits : 0;

    if (previousCGPA && previousCredits) {
      const prevCGPA = parseFloat(previousCGPA);
      const prevCred = parseFloat(previousCredits);
      if (!isNaN(prevCGPA) && !isNaN(prevCred)) {
        totalPoints = prevCGPA * prevCred + semesterPoints;
        totalCredits = prevCred + semesterCredits;
      }
    } else {
      totalPoints = semesterPoints;
      totalCredits = semesterCredits;
    }

    const cgpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
    return {
      cgpa: cgpa.toFixed(2),
      semesterGPA: semesterGPA.toFixed(2),
      totalCredits,
      semesterCredits,
    };
  }, [courses, previousCGPA, previousCredits, currentGrading]);

  const trend = useMemo(() => {
    if (!previousCGPA) return "neutral";
    const prev = parseFloat(previousCGPA);
    const current = parseFloat(result.cgpa);
    if (current > prev) return "up";
    if (current < prev) return "down";
    return "neutral";
  }, [previousCGPA, result.cgpa]);

  const motivation = useMemo(() => {
    const gpa = parseFloat(result.cgpa);
    const maxGpa = currentGrading.maxGpa;
    const percentage = gpa / maxGpa;
    let category: keyof typeof MOTIVATIONAL_MESSAGES;
    if (percentage >= 0.9) category = "excellent";
    else if (percentage >= 0.7) category = "good";
    else if (percentage >= 0.5) category = "average";
    else category = "needsWork";
    return MOTIVATIONAL_MESSAGES[category][motivationIndex % 3];
  }, [result.cgpa, motivationIndex, currentGrading.maxGpa]);

  const targetProgress = useMemo(() => {
    if (!targetCGPA) return null;
    const target = parseFloat(targetCGPA);
    const current = parseFloat(result.cgpa);
    const progress = Math.min((current / target) * 100, 100);
    const remaining = Math.max(target - current, 0);
    return { target, current, progress, remaining };
  }, [targetCGPA, result.cgpa]);

  /* ─── Handlers ──────────────────────────────────────────── */
  const addCourse = () => {
    setCourses([...courses, { id: Date.now().toString(), name: "", credits: 3, grade: "A" }]);
    setHasInteracted(true);
  };

  const removeCourse = (id: string) => {
    if (courses.length > 1) setCourses(courses.filter((c) => c.id !== id));
  };

  const updateCourse = (id: string, field: keyof Course, value: string | number) => {
    setCourses(courses.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    if (!hasInteracted) setHasInteracted(true);
  };

  const resetCalculator = () => {
    setCourses([{ id: "1", name: "", credits: 3, grade: "A" }]);
    setPreviousCGPA("");
    setPreviousCredits("");
    setTargetCGPA("");
    setHasInteracted(false);
  };

  const saveToHistory = () => {
    const semesterNum = history.length + 1;
    const newRecord: SemesterRecord = {
      id: Date.now().toString(),
      semester: `Semester ${semesterNum}`,
      gpa: parseFloat(result.cgpa),
      credits: result.totalCredits,
      courses: [...courses],
      timestamp: new Date().toISOString(),
      gradingSystem,
    };
    const updated = [newRecord, ...history].slice(0, 20);
    setHistory(updated);
    localStorage.setItem("iesa-cgpa-history", JSON.stringify(updated));
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  };

  const deleteFromHistory = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    localStorage.setItem("iesa-cgpa-history", JSON.stringify(updated));
  };

  /**
   * CGPA classification using Nigerian University standard absolute breakpoints.
   * Based on NUC/NANS guidelines — NO percentage approximation.
   *
   * 5-Point:  ≥4.50 First Class | ≥3.50 2:1 | ≥2.40 2:2 | ≥1.50 Third | ≥1.00 Pass | <1.00 Fail
   * 4-Point:  ≥3.60 First Class | ≥3.00 2:1 | ≥2.00 2:2 | ≥1.50 Third | ≥1.00 Pass | <1.00 Fail
   */
  const getClassification = (gpa: number, system: GradingSystem) => {
    if (system === "5.0") {
      if (gpa >= 4.50) return { label: "First Class",        color: "text-teal",       bg: "bg-teal-light" };
      if (gpa >= 3.50) return { label: "Second Class Upper", color: "text-lavender",   bg: "bg-lavender-light" };
      if (gpa >= 2.40) return { label: "Second Class Lower", color: "text-sunny",      bg: "bg-sunny-light" };
      if (gpa >= 1.50) return { label: "Third Class",        color: "text-coral",      bg: "bg-coral-light" };
      if (gpa >= 1.00) return { label: "Pass",               color: "text-navy-muted", bg: "bg-cloud" };
      return             { label: "Fail",               color: "text-coral",      bg: "bg-coral-light/60" };
    } else {
      // 4.0 system
      if (gpa >= 3.60) return { label: "First Class",        color: "text-teal",       bg: "bg-teal-light" };
      if (gpa >= 3.00) return { label: "Second Class Upper", color: "text-lavender",   bg: "bg-lavender-light" };
      if (gpa >= 2.00) return { label: "Second Class Lower", color: "text-sunny",      bg: "bg-sunny-light" };
      if (gpa >= 1.50) return { label: "Third Class",        color: "text-coral",      bg: "bg-coral-light" };
      if (gpa >= 1.00) return { label: "Pass",               color: "text-navy-muted", bg: "bg-cloud" };
      return             { label: "Fail",               color: "text-coral",      bg: "bg-coral-light/60" };
    }
  };

  const classification = getClassification(parseFloat(result.cgpa), gradingSystem);

  /* ─── Render ────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="CGPA Calculator" />
      <ToolHelpModal toolId="cgpa" isOpen={showHelp} onClose={closeHelp} />

      {/* Diamond sparkle decorators */}
      <svg className="fixed top-20 left-[8%] w-5 h-5 text-teal/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
      <svg className="fixed top-40 right-[6%] w-4 h-4 text-lavender/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
      <svg className="fixed bottom-32 left-[15%] w-6 h-6 text-sunny/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>
      <svg className="fixed top-60 right-[20%] w-3 h-3 text-coral/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg>

      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8 relative z-10">
        <div className="max-w-6xl mx-auto">

          {/* Back Link + Help */}
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/dashboard/growth"
              className="inline-flex items-center gap-2 font-display font-bold text-xs text-slate uppercase tracking-wider hover:text-navy transition-colors group"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd"/>
              </svg>
              Back to Growth Hub
            </Link>
            <HelpButton onClick={openHelp} />
          </div>

          {/* ═══════════════════════════════════════════════════
              BENTO HERO — Asymmetric 12-col grid
              ═══════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8 relative">
            {/* Confetti overlay */}
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                {[8, 22, 40, 58, 75, 90].map((left, i) => (
                  <svg
                    key={i}
                    className="absolute w-4 h-4 animate-bounce"
                    style={{ left: `${left}%`, top: "15%", animationDelay: `${i * 0.12}s`, color: ["#C8F31D", "#E05B4B", "#62D5C5", "#D4A6EF", "#E8C94A", "#C8F31D"][i] }}
                    viewBox="0 0 24 24" fill="currentColor"
                  >
                    <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/>
                  </svg>
                ))}
              </div>
            )}

            {/* Hero Title — teal theme */}
            <div className="md:col-span-7 bg-teal border-[5px] border-navy rounded-[2rem] shadow-[3px_3px_0_0_#000] p-7 md:p-9 rotate-[-0.5deg] hover:rotate-0 transition-transform">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-3">
                Academic Growth
              </div>
              <h1 className="font-display font-black text-2xl md:text-3xl lg:text-4xl text-navy mb-3 leading-tight overflow-hidden">
                <span className="brush-highlight">CGPA</span> Calculator
              </h1>
              <p className="font-display font-normal text-sm md:text-base text-navy/70 max-w-md">
                Calculate, track, and conquer your academic goals semester by semester.
              </p>
            </div>

            {/* Live Result Mini — navy card */}
            <div className="md:col-span-5 bg-navy border-[5px] border-navy rounded-[2rem] shadow-[3px_3px_0_0_#000] p-7 rotate-[0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ghost/40">
                  Current CGPA
                </span>
                {trend === "up" && (
                  <div className="flex items-center gap-1 text-teal text-xs font-bold">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l7.5 7.5a.75.75 0 11-1.06 1.06l-6.22-6.22V21a.75.75 0 01-1.5 0V4.81l-6.22 6.22a.75.75 0 01-1.06-1.06l7.5-7.5z" clipRule="evenodd"/></svg>
                    Up
                  </div>
                )}
                {trend === "down" && (
                  <div className="flex items-center gap-1 text-coral text-xs font-bold">
                    <svg className="w-3.5 h-3.5 rotate-180" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l7.5 7.5a.75.75 0 11-1.06 1.06l-6.22-6.22V21a.75.75 0 01-1.5 0V4.81l-6.22 6.22a.75.75 0 01-1.06-1.06l7.5-7.5z" clipRule="evenodd"/></svg>
                    Dip
                  </div>
                )}
              </div>
              {hasInteracted ? (
                <>
                  <div className="font-display font-black text-5xl md:text-6xl text-lime mb-1">
                    {result.cgpa}
                  </div>
                  <div className={`text-xs font-bold uppercase tracking-wider ${classification.color === "text-teal" ? "text-teal" : classification.color === "text-lavender" ? "text-lavender-light" : classification.color === "text-sunny" ? "text-sunny" : classification.color === "text-coral" ? "text-coral" : "text-ghost/50"}`}>
                    {classification.label}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-display font-black text-5xl md:text-6xl text-ghost/20 mb-1">
                    —.——
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ghost/30">
                    Start entering courses below
                  </div>
                </>
              )}
              <div className="flex gap-5 mt-4 pt-3 border-t border-ghost/10">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ghost/30">Semester</div>
                  <div className="font-display font-black text-lg text-ghost">{hasInteracted ? result.semesterGPA : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ghost/30">Credits</div>
                  <div className="font-display font-black text-lg text-ghost">{hasInteracted ? result.totalCredits : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ghost/30">System</div>
                  <div className="font-display font-black text-lg text-ghost">{gradingSystem}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              MAIN CONTENT — 2-col bento layout
              ═══════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* ── LEFT COLUMN: Calculator ── */}
            <div className="lg:col-span-8 space-y-5">

              {/* Grading System Selector — lavender accent */}
              <section className="bg-lavender-light border-[4px] border-navy rounded-[1.5rem] shadow-[4px_4px_0_0_#000] p-5 md:p-6 rotate-[0.3deg] hover:rotate-0 transition-transform">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-lavender border-[3px] border-navy flex items-center justify-center">
                    <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z" clipRule="evenodd"/><path fillRule="evenodd" d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-8.25V3z" clipRule="evenodd"/></svg>
                  </div>
                  <h3 className="font-display font-black text-lg text-navy">Grading System</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(GRADING_SYSTEMS) as GradingSystem[]).map((system) => (
                    <button
                      key={system}
                      onClick={() => handleGradingSystemChange(system)}
                      className={`px-4 py-3.5 rounded-2xl text-center transition-all border-[3px] ${
                        gradingSystem === system
                          ? "bg-navy text-ghost border-navy shadow-[3px_3px_0_0_#000]"
                          : "bg-snow text-navy/60 border-navy/20 hover:border-navy hover:bg-snow"
                      }`}
                    >
                      <div className="font-display font-black text-xl mb-0.5">{system}</div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-60">
                        {GRADING_SYSTEMS[system].label}
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Previous Record — coral-light accent */}
              <section className="bg-coral-light border-[4px] border-navy rounded-[1.5rem] shadow-[4px_4px_0_0_#000] p-5 md:p-6 rotate-[-0.3deg] hover:rotate-0 transition-transform">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-coral border-[3px] border-navy flex items-center justify-center">
                    <svg className="w-4 h-4 text-snow" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd"/></svg>
                  </div>
                  <h3 className="font-display font-black text-lg text-navy">Previous Record</h3>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40 bg-snow/60 px-2 py-1 rounded-full">Optional</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-navy/50 mb-2">Previous CGPA</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={currentGrading.maxGpa}
                      value={previousCGPA}
                      onChange={(e) => setPreviousCGPA(e.target.value)}
                      placeholder={gradingSystem === "5.0" ? "e.g., 3.50" : "e.g., 3.00"}
                      className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-xl text-navy font-display font-normal focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-navy/50 mb-2">Credits Done</label>
                    <input
                      type="number"
                      min="0"
                      value={previousCredits}
                      onChange={(e) => setPreviousCredits(e.target.value)}
                      placeholder="e.g., 60"
                      className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-xl text-navy font-display font-normal focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
                    />
                  </div>
                </div>
              </section>

              {/* Course Entry — main calculator card */}
              <section className="bg-snow border-[5px] border-navy rounded-[2rem] shadow-[3px_3px_0_0_#000] p-5 md:p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-lime border-[3px] border-navy flex items-center justify-center">
                      <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 24 24"><path d="M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0122.83 8.72a.75.75 0 01-.231 1.337 49.949 49.949 0 00-9.902 3.912l-.003.002-.34.18a.75.75 0 01-.707 0A50.009 50.009 0 007.5 12.174v-.224c0-.131.067-.248.172-.311a.75.75 0 00.328-.658.75.75 0 00-.5-.707 49.009 49.009 0 00-4.347-1.353.75.75 0 01-.231-1.337A60.653 60.653 0 0111.7 2.805z"/><path d="M13.06 15.473a48.45 48.45 0 017.666-3.282c.134 1.414.22 2.843.255 4.285a.75.75 0 01-.46.711 47.878 47.878 0 00-8.105 4.342.75.75 0 01-.832 0 47.877 47.877 0 00-8.104-4.342.75.75 0 01-.461-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 016 13.18v1.27a1.5 1.5 0 00-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.661a6.729 6.729 0 00.551-1.608 1.5 1.5 0 00.14-2.67v-.645a48.549 48.549 0 013.44 1.668 2.25 2.25 0 002.12 0z"/><path d="M4.462 19.462c.42-.419.753-.89 1-1.395.453.213.902.434 1.347.661a6.743 6.743 0 01-1.286 1.794.75.75 0 11-1.06-1.06z"/></svg>
                    </div>
                    <h3 className="font-display font-black text-lg text-navy">Current Semester</h3>
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40 bg-cloud px-2 py-1 rounded-full">
                      {courses.length} {courses.length === 1 ? "course" : "courses"}
                    </span>
                  </div>
                  <button
                    onClick={addCourse}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-lime border-[3px] border-navy press-3 press-navy font-display font-bold text-xs text-navy uppercase tracking-wider transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd"/>
                    </svg>
                    Add
                  </button>
                </div>

                {/* Course Headers — desktop */}
                <div className="hidden md:grid grid-cols-12 gap-3 mb-3 px-3">
                  <div className="col-span-5 text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40">Course Name</div>
                  <div className="col-span-2 text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40 text-center">Units</div>
                  <div className="col-span-4 text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40 text-center">Grade</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Course Rows */}
                <div className="space-y-3">
                  {courses.map((course, index) => {
                    const rowColors = ["border-teal/30", "border-lavender/30", "border-coral/30", "border-sunny/30"];
                    const rowAccent = rowColors[index % rowColors.length];
                    return (
                      <div
                        key={course.id}
                        className={`grid grid-cols-12 gap-3 items-center p-4 bg-ghost border-[3px] ${rowAccent} rounded-2xl hover:border-navy transition-colors`}
                      >
                        {/* Course Name */}
                        <div className="col-span-12 md:col-span-5">
                          <input
                            type="text"
                            value={course.name}
                            onChange={(e) => updateCourse(course.id, "name", e.target.value)}
                            placeholder={`Course ${index + 1}`}
                            className="w-full px-3 py-2 bg-snow border-[2px] border-navy/20 rounded-xl text-navy font-display font-normal text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
                          />
                        </div>

                        {/* Credits stepper */}
                        <div className="col-span-4 md:col-span-2">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => updateCourse(course.id, "credits", Math.max(1, course.credits - 1))}
                              className="w-7 h-7 rounded-lg bg-snow border-[2px] border-navy/20 flex items-center justify-center text-slate hover:text-navy hover:border-navy transition-all"
                              aria-label="Decrease credits"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M3.75 12a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75z" clipRule="evenodd"/></svg>
                            </button>
                            <span className="w-7 text-center font-display font-black text-lg text-navy">{course.credits}</span>
                            <button
                              onClick={() => updateCourse(course.id, "credits", Math.min(6, course.credits + 1))}
                              className="w-7 h-7 rounded-lg bg-snow border-[2px] border-navy/20 flex items-center justify-center text-slate hover:text-navy hover:border-navy transition-all"
                              aria-label="Increase credits"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd"/></svg>
                            </button>
                          </div>
                        </div>

                        {/* Grade pills — multi-color */}
                        <div className="col-span-6 md:col-span-4">
                          <div className="flex gap-1 justify-center flex-wrap">
                            {Object.keys(currentGrading.grades).map((grade) => (
                              <button
                                key={grade}
                                onClick={() => updateCourse(course.id, "grade", grade)}
                                className={`px-2.5 py-1 rounded-full font-display font-bold text-xs transition-all ${
                                  course.grade === grade
                                    ? `${GRADE_COLORS[grade] || "bg-navy text-ghost"} border-[2px] border-navy shadow-[2px_2px_0_0_#000]`
                                    : "bg-snow text-navy/40 border-[2px] border-navy/15 hover:border-navy/40"
                                }`}
                              >
                                {grade}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Delete */}
                        <div className="col-span-2 md:col-span-1 flex justify-end">
                          <button
                            onClick={() => removeCourse(course.id)}
                            disabled={courses.length === 1}
                            className="p-1.5 text-slate hover:text-coral transition-colors disabled:opacity-20"
                            aria-label="Remove course"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Actions bar */}
                <div className="flex items-center justify-between mt-5 pt-4 border-t-[3px] border-navy/10">
                  <button
                    onClick={resetCalculator}
                    className="flex items-center gap-1.5 text-slate hover:text-navy font-display font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903H14.25a.75.75 0 000 1.5h6a.75.75 0 00.75-.75v-6a.75.75 0 00-1.5 0v4.956l-1.903-1.903A9 9 0 003.306 9.67a.75.75 0 101.45.388zm14.49 3.882a7.5 7.5 0 01-12.548 3.364l-1.902-1.903h4.955a.75.75 0 000-1.5h-6a.75.75 0 00-.75.75v6a.75.75 0 001.5 0v-4.956l1.903 1.903A9 9 0 0020.694 14.33a.75.75 0 10-1.45-.388z" clipRule="evenodd"/></svg>
                    Reset All
                  </button>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy/30">
                    {result.semesterCredits} units this semester
                  </span>
                </div>
              </section>

              {/* Target Goal — sunny accent */}
              <section className="bg-sunny-light border-[4px] border-navy rounded-[1.5rem] shadow-[4px_4px_0_0_#000] p-5 md:p-6 rotate-[-0.3deg] hover:rotate-0 transition-transform">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-sunny border-[3px] border-navy flex items-center justify-center">
                    <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 00-2.25 2.25c0 .414.336.75.75.75h15.75a.75.75 0 00.75-.75 2.25 2.25 0 00-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744z" clipRule="evenodd"/></svg>
                  </div>
                  <h3 className="font-display font-black text-lg text-navy">Set Your Target</h3>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={currentGrading.maxGpa}
                  value={targetCGPA}
                  onChange={(e) => setTargetCGPA(e.target.value)}
                  placeholder={`Target CGPA (e.g., ${gradingSystem === "5.0" ? "4.5" : "3.5"})`}
                  className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-xl text-navy font-display font-normal focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
                />
                {targetProgress && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-navy/50">
                      <span>Progress to {targetProgress.target.toFixed(1)}</span>
                      <span>{targetProgress.progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-3 bg-snow border-[2px] border-navy rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${targetProgress.progress >= 100 ? "bg-teal" : "bg-navy"}`}
                        style={{ width: `${targetProgress.progress}%` }}
                      />
                    </div>
                    {targetProgress.progress >= 100 ? (
                      <p className="font-display font-bold text-xs text-teal">
                        Goal achieved! Set a new target?
                      </p>
                    ) : (
                      <p className="font-display font-bold text-xs text-navy/50">
                        {targetProgress.remaining.toFixed(2)} points to go
                      </p>
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* ── RIGHT COLUMN: Results sidebar ── */}
            <div className="lg:col-span-4 space-y-5">

              {/* Motivation card — coral */}
              <div className="bg-coral border-[4px] border-navy rounded-[1.5rem] shadow-[4px_4px_0_0_#000] p-5 rotate-[0.5deg] hover:rotate-0 transition-transform">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-snow/60" fill="currentColor" viewBox="0 0 24 24"><path d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5z"/></svg>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-snow/60">Motivation</span>
                </div>
                <p className="font-display font-black text-base text-snow leading-snug">{hasInteracted ? motivation : "Add your courses to get started!"}</p>
              </div>

              {/* Classification badge */}
              <div className={`${hasInteracted ? classification.bg : "bg-cloud"} border-[4px] border-navy rounded-[1.5rem] shadow-[3px_3px_0_0_#000] p-5`}>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40 mb-1">Classification</div>
                <div className={`font-display font-black text-xl ${hasInteracted ? classification.color : "text-navy/25"}`}>{hasInteracted ? classification.label : "Awaiting input"}</div>
                <div className="mt-2 text-xs font-display text-navy/50">on the {gradingSystem} scale</div>
              </div>

              {/* Save button — lime CTA */}
              <button
                onClick={saveToHistory}
                className="w-full py-4 rounded-2xl bg-lime text-navy border-[4px] border-navy press-3 press-navy font-display font-black text-base transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clipRule="evenodd"/></svg>
                Save to Progress
              </button>

              {/* History — collapsible */}
              <div className="bg-snow border-[4px] border-navy rounded-[1.5rem] shadow-[3px_3px_0_0_#000] overflow-hidden">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between p-5 hover:bg-ghost transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-lavender-light border-[2px] border-navy/20 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-lavender" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94A48.972 48.972 0 0012 3c-2.227 0-4.406.148-6.336.432A2.96 2.96 0 003 6.108V8.25a3 3 0 003-3h1.502zM6 13.5V6.75a.75.75 0 01.75-.75h8.5a.75.75 0 01.75.75v6.75a.75.75 0 01-.75.75h-8.5a.75.75 0 01-.75-.75z" clipRule="evenodd"/><path d="M5.25 15.375A3.375 3.375 0 018.625 12h8.25a.75.75 0 01.75.75v6.375a3.375 3.375 0 01-3.375 3.375h-6a3.375 3.375 0 01-3-3.375v-3.75z"/></svg>
                    </div>
                    <span className="font-display font-bold text-sm text-navy">Progress History</span>
                    {history.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-lavender-light text-lavender font-display font-bold text-[10px]">
                        {history.length}
                      </span>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-slate transition-transform ${showHistory ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z" clipRule="evenodd"/>
                  </svg>
                </button>

                {showHistory && (
                  <div className="border-t-[3px] border-navy/10 p-4 max-h-80 overflow-y-auto">
                    {history.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-cloud flex items-center justify-center">
                          <svg className="w-5 h-5 text-slate" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clipRule="evenodd"/></svg>
                        </div>
                        <p className="text-xs font-display font-bold text-slate">No saved calculations yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {history.map((record, index) => {
                          const histColors = ["bg-teal-light", "bg-lavender-light", "bg-sunny-light", "bg-coral-light"];
                          return (
                            <div
                              key={record.id}
                              className={`flex items-center justify-between p-3 ${histColors[index % histColors.length]} border-[2px] border-navy/15 rounded-xl group`}
                            >
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-display font-black text-base text-navy">
                                    {typeof record.gpa === "number" ? record.gpa.toFixed(2) : "--"}
                                  </span>
                                  {record.gradingSystem && (
                                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy/40">{record.gradingSystem}</span>
                                  )}
                                  {index === 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-navy text-ghost text-[9px] font-bold uppercase">Latest</span>
                                  )}
                                </div>
                                <span className="text-[10px] font-bold text-navy/40">
                                  {new Date(record.timestamp).toLocaleDateString()} · {record.credits} credits
                                </span>
                              </div>
                              <button
                                onClick={() => deleteFromHistory(record.id)}
                                className="p-1.5 text-slate hover:text-coral opacity-0 group-hover:opacity-100 transition-all"
                                aria-label="Delete record"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd"/></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Privacy note */}
              <div className="flex items-center justify-center gap-2 py-2">
                <svg className="w-3 h-3 text-slate" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd"/></svg>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate">Stored locally on your device</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
