
"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { Calculator, History, ArrowLeft } from "lucide-react";
import { useState } from "react";

export default function CgpaPage() {
  const [mode, setMode] = useState<"hub" | "quick" | "personal">("hub");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <DashboardHeader title="CGPA Calculator" />
      
      {mode === "hub" && <CalculatorHub key="hub" onSelectMode={setMode} />}
      {mode === "quick" && <QuickCalculator key="quick" onBack={() => setMode("hub")} />}
      {mode === "personal" && <PersonalCalculator key="personal" onBack={() => setMode("hub")} />}
    </div>
  );
}

// Hub Page - Choose between Quick or Personal mode
function CalculatorHub({ onSelectMode }: { onSelectMode: (mode: "quick" | "personal") => void }) {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-4">
          Smart CGPA Calculator
        </h1>
        <p className="text-xl text-foreground/70">
          Track your academic progress with precision and style
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Quick Calculator Card */}
        <div className="group relative rounded-2xl overflow-hidden bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)] p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
          
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg">
            <Calculator className="w-8 h-8 text-white" strokeWidth={2} />
          </div>

          <h2 className="font-heading font-bold text-2xl text-foreground mb-3">Quick Calculator</h2>
          <p className="text-foreground/70 leading-relaxed mb-6">
            One-time calculation with instant results. Perfect for hypothetical scenarios or quick GPA checks without saving data.
          </p>

          <button
            onClick={() => onSelectMode("quick")}
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            Start Quick Calculation
            <Calculator className="w-5 h-5" />
          </button>
        </div>

        {/* Personal Calculator Card */}
        <div className="group relative rounded-2xl overflow-hidden bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)] p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-teal-600 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
          
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center mb-6 shadow-lg">
            <History className="w-8 h-8 text-white" strokeWidth={2} />
          </div>

          <h2 className="font-heading font-bold text-2xl text-foreground mb-3">Personal Tracker</h2>
          <p className="text-foreground/70 leading-relaxed mb-6">
            Save your progress, track calculation history, and analyze your academic journey over time with persistent data storage.
          </p>

          <button
            onClick={() => onSelectMode("personal")}
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-teal-600 text-white font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            Start Tracked Calculation
            <History className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mt-12 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-6">
        <p className="text-sm text-foreground/60 text-center">
          <svg className="w-4 h-4 inline-block mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          All personal data is stored locally in your browser - your privacy matters
        </p>
      </div>
    </div>
  );
}

// Quick Calculator - No data persistence
function QuickCalculator({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Calculator Hub
      </button>

      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          Instant CGPA Simulator
        </h1>
        <p className="text-foreground/70 text-lg">
          Experiment with different academic scenarios
        </p>
      </div>

      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-8">
        <CgpaCalculatorForm isPersistent={false} />
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-foreground/60">
          <svg className="w-4 h-4 inline-block mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Pro Tip: Use this simulator to plan your future semester targets
        </p>
      </div>
    </div>
  );
}

// Personal Calculator - With localStorage persistence
function PersonalCalculator({ onBack }: { onBack: () => void }) {
  const [history, setHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("iesa-cgpa-history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);

  const handleSave = (data: any) => {
    const newRecord = {
      ...data,
      timestamp: new Date().toISOString(),
      id: Date.now(),
    };
    const updated = [newRecord, ...history].slice(0, 20); // Keep last 20
    setHistory(updated);
    localStorage.setItem("iesa-cgpa-history", JSON.stringify(updated));
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Calculator Hub
      </button>

      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3 bg-gradient-to-r from-green-500 to-teal-600 bg-clip-text text-transparent">
          Academic Progress Tracker
        </h1>
        <p className="text-foreground/70 text-lg">
          Your persistent academic companion
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-8">
          <CgpaCalculatorForm isPersistent={true} onSave={handleSave} />
        </div>

        <div className="space-y-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {showHistory ? "Hide History" : "Show History"}
            <History className="w-5 h-5" />
          </button>

          {showHistory && (
            <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-foreground mb-4">Calculation History</h3>
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-12 h-12 mx-auto text-foreground/20 mb-3" />
                  <p className="text-foreground/60 text-sm">
                    No saved calculations yet. Start calculating to see your history!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {history.map((record) => (
                    <div key={record.id} className="p-4 rounded-xl bg-background/50 border border-[var(--glass-border)]">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-sm text-foreground/60">
                          {new Date(record.timestamp).toLocaleDateString()} at{" "}
                          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-foreground">CGPA: {record.cgpa}</div>
                      <div className="text-sm text-foreground/70 mt-1">
                        Total Credits: {record.totalCredits}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared Calculator Form Component
function CgpaCalculatorForm({ isPersistent, onSave }: { isPersistent: boolean; onSave?: (data: any) => void }) {
  interface Course {
    id: string;
    name: string;
    credits: number;
    grade: string;
  }

  const [courses, setCourses] = useState<Course[]>([
    { id: "1", name: "", credits: 3, grade: "A" },
  ]);
  const [previousCGPA, setPreviousCGPA] = useState("");
  const [previousCredits, setPreviousCredits] = useState("");

  const gradePoints: Record<string, number> = {
    "A": 4.0,
    "B": 3.0,
    "C": 2.0,
    "D": 1.0,
    "F": 0.0,
  };

  const addCourse = () => {
    setCourses([...courses, { id: Date.now().toString(), name: "", credits: 3, grade: "A" }]);
  };

  const removeCourse = (id: string) => {
    setCourses(courses.filter(c => c.id !== id));
  };

  const updateCourse = (id: string, field: keyof Course, value: any) => {
    setCourses(courses.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const calculateGPA = () => {
    let totalPoints = 0;
    let totalCredits = 0;

    // Add previous CGPA if provided
    if (previousCGPA && previousCredits) {
      const prevCGPA = parseFloat(previousCGPA);
      const prevCred = parseFloat(previousCredits);
      if (!isNaN(prevCGPA) && !isNaN(prevCred)) {
        totalPoints += prevCGPA * prevCred;
        totalCredits += prevCred;
      }
    }

    // Add current courses
    courses.forEach(course => {
      const points = gradePoints[course.grade] || 0;
      totalPoints += points * course.credits;
      totalCredits += course.credits;
    });

    const cgpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : "0.00";

    if (isPersistent && onSave) {
      onSave({ cgpa, totalCredits, courses, previousCGPA, previousCredits });
    }

    return { cgpa, totalCredits };
  };

  const result = calculateGPA();

  return (
    <div className="space-y-6">
      {/* Previous CGPA Section */}
      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-lg text-foreground">Previous Academic Record (Optional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground/70 block mb-2">Previous CGPA</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="4"
              value={previousCGPA}
              onChange={(e) => setPreviousCGPA(e.target.value)}
              placeholder="e.g., 3.50"
              className="w-full px-4 py-2 rounded-lg bg-background border border-foreground/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground/70 block mb-2">Previous Credits Completed</label>
            <input
              type="number"
              min="0"
              value={previousCredits}
              onChange={(e) => setPreviousCredits(e.target.value)}
              placeholder="e.g., 60"
              className="w-full px-4 py-2 rounded-lg bg-background border border-foreground/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </div>

      {/* Current Courses */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-lg text-foreground">Current Semester Courses</h3>
          <button
            onClick={addCourse}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
          >
            + Add Course
          </button>
        </div>

        <div className="space-y-3">
          {courses.map((course, index) => (
            <div key={course.id} className="grid grid-cols-12 gap-3 items-center p-4 rounded-xl bg-background/50 border border-[var(--glass-border)]">
              <div className="col-span-12 md:col-span-5">
                <input
                  type="text"
                  value={course.name}
                  onChange={(e) => updateCourse(course.id, "name", e.target.value)}
                  placeholder={`Course ${index + 1} name`}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-foreground/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="col-span-5 md:col-span-3">
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={course.credits}
                  onChange={(e) => updateCourse(course.id, "credits", parseInt(e.target.value) || 3)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-foreground/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="col-span-5 md:col-span-3">
                <select
                  value={course.grade}
                  onChange={(e) => updateCourse(course.id, "grade", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-foreground/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="A">A (4.0)</option>
                  <option value="B">B (3.0)</option>
                  <option value="C">C (2.0)</option>
                  <option value="D">D (1.0)</option>
                  <option value="F">F (0.0)</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-1 flex justify-end">
                <button
                  onClick={() => removeCourse(course.id)}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6">
        <h3 className="font-heading font-semibold text-lg text-foreground mb-4">Your CGPA</h3>
        <div className="flex items-end gap-6">
          <div>
            <div className="text-sm text-foreground/60 mb-1">Cumulative GPA</div>
            <div className="text-5xl font-bold text-foreground">{result.cgpa}</div>
          </div>
          <div className="pb-2">
            <div className="text-sm text-foreground/60 mb-1">Total Credits</div>
            <div className="text-3xl font-bold text-foreground/80">{result.totalCredits}</div>
          </div>
        </div>
        
        {isPersistent && (
          <div className="mt-4 text-xs text-foreground/50">
            <svg className="w-3 h-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Automatically saved to your calculation history
          </div>
        )}
      </div>
    </div>
  );
}
