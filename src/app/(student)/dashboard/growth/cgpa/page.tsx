"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";

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

  const currentGrading = GRADING_SYSTEMS[gradingSystem];

  useEffect(() => {
    try {
      const saved = localStorage.getItem("iesa-cgpa-history");
      if (saved) setHistory(JSON.parse(saved));
      const savedSystem = localStorage.getItem(
        "iesa-grading-system"
      ) as GradingSystem;
      if (savedSystem && GRADING_SYSTEMS[savedSystem])
        setGradingSystem(savedSystem);
    } catch {
      console.error("Failed to load CGPA data");
    }
    setMotivationIndex(Math.floor(Math.random() * 3));
  }, []);

  const handleGradingSystemChange = (system: GradingSystem) => {
    setGradingSystem(system);
    localStorage.setItem("iesa-grading-system", system);
    setCourses(courses.map((c) => ({ ...c, grade: "A" })));
  };

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

    const semesterGPA =
      semesterCredits > 0 ? semesterPoints / semesterCredits : 0;

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
    const messages = MOTIVATIONAL_MESSAGES[category];
    return messages[motivationIndex % messages.length];
  }, [result.cgpa, motivationIndex, currentGrading.maxGpa]);

  const targetProgress = useMemo(() => {
    if (!targetCGPA) return null;
    const target = parseFloat(targetCGPA);
    const current = parseFloat(result.cgpa);
    const progress = Math.min((current / target) * 100, 100);
    const remaining = Math.max(target - current, 0);
    return { target, current, progress, remaining };
  }, [targetCGPA, result.cgpa]);

  const addCourse = () => {
    setCourses([
      ...courses,
      { id: Date.now().toString(), name: "", credits: 3, grade: "A" },
    ]);
  };

  const removeCourse = (id: string) => {
    if (courses.length > 1) {
      setCourses(courses.filter((c) => c.id !== id));
    }
  };

  const updateCourse = (
    id: string,
    field: keyof Course,
    value: string | number
  ) => {
    setCourses(
      courses.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const resetCalculator = () => {
    setCourses([{ id: "1", name: "", credits: 3, grade: "A" }]);
    setPreviousCGPA("");
    setPreviousCredits("");
    setTargetCGPA("");
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

  const getClassification = (gpa: number, system: GradingSystem) => {
    const maxGpa = GRADING_SYSTEMS[system].maxGpa;
    const percentage = gpa / maxGpa;
    if (percentage >= 0.9)
      return { label: "First Class", color: "text-emerald-600" };
    if (percentage >= 0.7)
      return { label: "Second Class Upper", color: "text-blue-600" };
    if (percentage >= 0.5)
      return { label: "Second Class Lower", color: "text-amber-600" };
    if (percentage >= 0.3)
      return { label: "Third Class", color: "text-orange-600" };
    return { label: "Pass", color: "text-red-600" };
  };

  const classification = getClassification(
    parseFloat(result.cgpa),
    gradingSystem
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="CGPA Calculator" />

      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8">
        <div className="max-w-5xl mx-auto">
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

          {/* Page Header */}
          <div className="mb-8 pb-8 border-b border-border relative">
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[5, 25, 45, 65, 85].map((left, i) => (
                  <span
                    key={i}
                    className="absolute text-lg animate-bounce"
                    style={{
                      left: `${left}%`,
                      top: "20%",
                      animationDelay: `${i * 0.1}s`,
                    }}
                  >
                    ✦
                  </span>
                ))}
              </div>
            )}
            <span className="text-label-sm text-text-muted flex items-center gap-2 mb-2">
              <span>✦</span> Academic Growth
            </span>
            <h1 className="font-display text-display-sm mb-2">
              Track Your Progress
            </h1>
            <p className="text-text-secondary text-body text-sm max-w-lg">
              Calculate, visualize, and improve your GPA journey
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Calculator */}
            <div className="lg:col-span-2 space-y-6">
              {/* Grading System */}
              <section className="page-frame p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-label text-text-muted">◆</span>
                  <h3 className="font-display text-lg">Grading System</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(GRADING_SYSTEMS) as GradingSystem[]).map(
                    (system) => (
                      <button
                        key={system}
                        onClick={() => handleGradingSystemChange(system)}
                        className={`px-4 py-3 text-center transition-all ${
                          gradingSystem === system
                            ? "bg-charcoal dark:bg-cream text-cream dark:text-charcoal"
                            : "bg-bg-secondary text-text-secondary hover:bg-bg-card"
                        }`}
                      >
                        <div className="font-display text-lg mb-0.5">
                          {system}
                        </div>
                        <div className="text-label-sm opacity-70">
                          {GRADING_SYSTEMS[system].label}
                        </div>
                      </button>
                    )
                  )}
                </div>
              </section>

              {/* Previous Record */}
              <section className="page-frame p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-label text-text-muted">◆</span>
                  <h3 className="font-display text-lg">Previous Record</h3>
                  <span className="text-label-sm text-text-muted">
                    (optional)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-label-sm text-text-secondary mb-2">
                      Previous CGPA
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={currentGrading.maxGpa}
                      value={previousCGPA}
                      onChange={(e) => setPreviousCGPA(e.target.value)}
                      placeholder={
                        gradingSystem === "5.0" ? "e.g., 3.50" : "e.g., 3.00"
                      }
                      className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm text-text-secondary mb-2">
                      Credits Completed
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={previousCredits}
                      onChange={(e) => setPreviousCredits(e.target.value)}
                      placeholder="e.g., 60"
                      className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
                    />
                  </div>
                </div>
              </section>

              {/* Courses */}
              <section className="page-frame p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-label text-text-muted">◆</span>
                    <h3 className="font-display text-lg">Current Semester</h3>
                  </div>
                  <button
                    onClick={addCourse}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-charcoal dark:bg-cream text-cream dark:text-charcoal text-label-sm hover:opacity-90 transition-opacity"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    Add Course
                  </button>
                </div>

                {/* Course Headers */}
                <div className="hidden md:grid grid-cols-12 gap-3 mb-3 px-2 text-label-sm text-text-muted">
                  <div className="col-span-5">Course Name</div>
                  <div className="col-span-2 text-center">Units</div>
                  <div className="col-span-4 text-center">Grade</div>
                  <div className="col-span-1"></div>
                </div>

                <div className="space-y-3">
                  {courses.map((course, index) => (
                    <div
                      key={course.id}
                      className="grid grid-cols-12 gap-3 items-center p-4 bg-bg-secondary border border-border"
                    >
                      {/* Course Name */}
                      <div className="col-span-12 md:col-span-5">
                        <input
                          type="text"
                          value={course.name}
                          onChange={(e) =>
                            updateCourse(course.id, "name", e.target.value)
                          }
                          placeholder={`Course ${index + 1}`}
                          className="w-full px-3 py-2 bg-bg-card border border-border text-text-primary text-body text-sm focus:outline-none focus:border-border-dark transition-colors"
                        />
                      </div>

                      {/* Credits */}
                      <div className="col-span-4 md:col-span-2">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() =>
                              updateCourse(
                                course.id,
                                "credits",
                                Math.max(1, course.credits - 1)
                              )
                            }
                            className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19.5 12h-15"
                              />
                            </svg>
                          </button>
                          <span className="w-6 text-center font-display text-lg">
                            {course.credits}
                          </span>
                          <button
                            onClick={() =>
                              updateCourse(
                                course.id,
                                "credits",
                                Math.min(6, course.credits + 1)
                              )
                            }
                            className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 4.5v15m7.5-7.5h-15"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Grade */}
                      <div className="col-span-6 md:col-span-4">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {Object.keys(currentGrading.grades).map((grade) => (
                            <button
                              key={grade}
                              onClick={() =>
                                updateCourse(course.id, "grade", grade)
                              }
                              className={`px-2.5 py-1 text-label-sm transition-all ${
                                course.grade === grade
                                  ? "bg-charcoal dark:bg-cream text-cream dark:text-charcoal"
                                  : "bg-bg-card text-text-muted hover:text-text-primary border border-border"
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
                          className="p-1.5 text-text-muted hover:text-red-600 transition-colors disabled:opacity-30"
                        >
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <button
                    onClick={resetCalculator}
                    className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-label-sm transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5"
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
                    Reset
                  </button>
                </div>
              </section>

              {/* Target Goal */}
              <section className="page-frame p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-label text-text-muted">◆</span>
                  <h3 className="font-display text-lg">Set Your Goal</h3>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={currentGrading.maxGpa}
                  value={targetCGPA}
                  onChange={(e) => setTargetCGPA(e.target.value)}
                  placeholder={`Target CGPA (e.g., ${
                    gradingSystem === "5.0" ? "4.5" : "3.5"
                  })`}
                  className="w-full px-4 py-3 bg-bg-card border border-border text-text-primary text-body focus:outline-none focus:border-border-dark transition-colors"
                />
                {targetProgress && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-label-sm text-text-muted">
                      <span>
                        Progress to {targetProgress.target.toFixed(1)}
                      </span>
                      <span>{targetProgress.progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-bg-secondary overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          targetProgress.progress >= 100
                            ? "bg-emerald-600"
                            : "bg-charcoal dark:bg-cream"
                        }`}
                        style={{ width: `${targetProgress.progress}%` }}
                      />
                    </div>
                    {targetProgress.progress >= 100 ? (
                      <p className="text-label-sm text-emerald-600">
                        ✦ Goal achieved! Set a new target?
                      </p>
                    ) : (
                      <p className="text-label-sm text-text-muted">
                        {targetProgress.remaining.toFixed(2)} points to go
                      </p>
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* Right Column - Results */}
            <div className="space-y-6">
              {/* Main Result */}
              <div className="bg-charcoal dark:bg-cream p-6 text-cream dark:text-charcoal">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-label-sm text-cream/60 dark:text-charcoal/60">
                    Your CGPA
                  </span>
                  {trend === "up" && (
                    <span className="text-emerald-400">↑</span>
                  )}
                  {trend === "down" && <span className="text-red-400">↓</span>}
                </div>
                <div className="font-display text-display-lg mb-2">
                  {result.cgpa}
                </div>
                <p className={`text-label-sm mb-4 ${classification.color}`}>
                  {classification.label}
                </p>
                <div className="flex gap-6 text-label-sm text-cream/60 dark:text-charcoal/60">
                  <div>
                    <span className="block text-cream/40 dark:text-charcoal/40">
                      Semester GPA
                    </span>
                    <span className="text-cream dark:text-charcoal font-display">
                      {result.semesterGPA}
                    </span>
                  </div>
                  <div>
                    <span className="block text-cream/40 dark:text-charcoal/40">
                      Total Credits
                    </span>
                    <span className="text-cream dark:text-charcoal font-display">
                      {result.totalCredits}
                    </span>
                  </div>
                </div>
              </div>

              {/* Motivation */}
              <div className="page-frame p-5">
                <p className="font-display text-base text-text-primary">
                  ✦ {motivation}
                </p>
              </div>

              {/* Save Button */}
              <button
                onClick={saveToHistory}
                className="w-full py-4 bg-charcoal dark:bg-cream text-cream dark:text-charcoal font-display text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                  />
                </svg>
                Save to Progress
              </button>

              {/* History */}
              <div className="page-frame overflow-hidden">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between p-5 hover:bg-bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-label text-text-muted">◆</span>
                    <span className="font-display">Progress History</span>
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
                  <div className="border-t border-border p-5 max-h-80 overflow-y-auto">
                    {history.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-text-muted text-label-sm">
                          No saved calculations yet
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {history.map((record, index) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between p-3 bg-bg-secondary border border-border group"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-display">
                                  {typeof record.gpa === "number"
                                    ? record.gpa.toFixed(2)
                                    : "--"}
                                </span>
                                {record.gradingSystem && (
                                  <span className="text-label-sm text-text-muted">
                                    {record.gradingSystem}
                                  </span>
                                )}
                                {index === 0 && (
                                  <span className="text-label-sm text-text-muted">
                                    Latest
                                  </span>
                                )}
                              </div>
                              <span className="text-label-sm text-text-muted">
                                {new Date(
                                  record.timestamp
                                ).toLocaleDateString()}{" "}
                                • {record.credits} credits
                              </span>
                            </div>
                            <button
                              onClick={() => deleteFromHistory(record.id)}
                              className="p-1.5 text-text-muted hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Privacy Note */}
              <p className="text-center text-label-sm text-text-muted flex items-center justify-center gap-1.5">
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
                Data stored locally on your device
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
