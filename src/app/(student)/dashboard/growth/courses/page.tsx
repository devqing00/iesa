"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

/* ─── Types ─────────────────────────────────────────────────────── */

interface Topic {
  id: string;
  name: string;
  completed: boolean;
}

interface Course {
  id: string;
  code: string;
  name: string;
  color: "lime" | "coral" | "lavender" | "teal" | "sunny";
  topics: Topic[];
  creditUnits: number;
  createdAt: string;
}

const STORAGE_KEY = "iesa-courses-progress";
const COLORS: Course["color"][] = ["lime", "coral", "lavender", "teal", "sunny"];

const COLOR_MAP: Record<string, { bg: string; light: string; bar: string; text: string }> = {
  lime: { bg: "bg-lime", light: "bg-lime-light", bar: "bg-lime", text: "text-navy" },
  coral: { bg: "bg-coral", light: "bg-coral-light", bar: "bg-coral", text: "text-snow" },
  lavender: { bg: "bg-lavender", light: "bg-lavender-light", bar: "bg-lavender", text: "text-snow" },
  teal: { bg: "bg-teal", light: "bg-teal-light", bar: "bg-teal", text: "text-navy" },
  sunny: { bg: "bg-sunny", light: "bg-sunny-light", bar: "bg-sunny", text: "text-navy" },
};

/* ─── Component ─────────────────────────────────────────────────── */

export default function CourseProgressPage() {
  const { showHelp, openHelp, closeHelp } = useToolHelp("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState<Course["color"]>("teal");
  const [formCredits, setFormCredits] = useState(3);
  const [formTopics, setFormTopics] = useState<string>("");

  // Add topic inline
  const [inlineTopic, setInlineTopic] = useState("");
  const [addingTopicTo, setAddingTopicTo] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCourses(JSON.parse(saved));
    } catch {
      console.error("Failed to load course progress");
    }
  }, []);

  const persist = useCallback((data: Course[]) => {
    setCourses(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const resetForm = () => {
    setFormCode("");
    setFormName("");
    setFormColor("teal");
    setFormCredits(3);
    setFormTopics("");
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = () => {
    if (!formCode.trim() || !formName.trim()) return;
    if (editId) {
      persist(
        courses.map((c) =>
          c.id === editId
            ? { ...c, code: formCode.trim().toUpperCase(), name: formName.trim(), color: formColor, creditUnits: formCredits }
            : c
        )
      );
    } else {
      const topics: Topic[] = formTopics
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t)
        .map((name) => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, completed: false }));

      const newCourse: Course = {
        id: Date.now().toString(36),
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        color: formColor,
        topics,
        creditUnits: formCredits,
        createdAt: new Date().toISOString(),
      };
      persist([...courses, newCourse]);
    }
    resetForm();
  };

  const startEdit = (c: Course) => {
    setFormCode(c.code);
    setFormName(c.name);
    setFormColor(c.color);
    setFormCredits(c.creditUnits);
    setEditId(c.id);
    setShowForm(true);
  };

  const deleteCourse = (id: string) => {
    if (!confirm("Delete this course and all progress?")) return;
    persist(courses.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const toggleTopic = (courseId: string, topicId: string) => {
    persist(
      courses.map((c) => {
        if (c.id !== courseId) return c;
        return { ...c, topics: c.topics.map((t) => (t.id === topicId ? { ...t, completed: !t.completed } : t)) };
      })
    );
  };

  const addTopicInline = (courseId: string) => {
    if (!inlineTopic.trim()) return;
    persist(
      courses.map((c) => {
        if (c.id !== courseId) return c;
        const newTopic: Topic = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: inlineTopic.trim(), completed: false };
        return { ...c, topics: [...c.topics, newTopic] };
      })
    );
    setInlineTopic("");
  };

  const deleteTopic = (courseId: string, topicId: string) => {
    persist(
      courses.map((c) => {
        if (c.id !== courseId) return c;
        return { ...c, topics: c.topics.filter((t) => t.id !== topicId) };
      })
    );
  };

  // Stats
  const totalTopics = courses.reduce((s, c) => s + c.topics.length, 0);
  const completedTopics = courses.reduce((s, c) => s + c.topics.filter((t) => t.completed).length, 0);
  const overallProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  const coursesComplete = courses.filter((c) => c.topics.length > 0 && c.topics.every((t) => t.completed)).length;

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Course Progress" />
      <ToolHelpModal toolId="courses" isOpen={showHelp} onClose={closeHelp} />

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
          <div className="md:col-span-7 bg-coral border-[5px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[180px] flex flex-col justify-between">
            <div className="absolute -bottom-14 -right-14 w-40 h-40 rounded-full bg-navy/8 pointer-events-none" />
            <svg className="absolute top-6 right-10 w-5 h-5 text-snow/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <div>
              <p className="text-[10px] font-bold text-snow/50 uppercase tracking-[0.15em] mb-2">Syllabus Tracking</p>
              <h1 className="font-display font-black text-3xl md:text-4xl text-snow leading-[0.95]">
                Course Progress
              </h1>
              <p className="text-sm text-snow/60 mt-3 max-w-md">
                Track topics covered per course and visualize your semester progress.
              </p>
            </div>
          </div>

          <div className="md:col-span-5 grid grid-cols-2 gap-3">
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Courses</p>
              <p className="font-display font-black text-3xl text-navy mt-2">{courses.length}</p>
            </div>
            <div className="bg-teal-light border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Progress</p>
              <p className="font-display font-black text-3xl text-navy mt-2">
                {overallProgress}<span className="text-base text-slate">%</span>
              </p>
            </div>
            <div className="bg-coral-light border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] rotate-[-0.3deg] hover:rotate-0 transition-transform flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Topics</p>
              <p className="font-display font-black text-3xl text-navy mt-2">
                {completedTopics}<span className="text-base text-slate">/{totalTopics}</span>
              </p>
            </div>
            <div className="bg-snow border-[4px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">Complete</p>
              <p className="font-display font-black text-3xl text-navy mt-2">
                {coursesComplete}<span className="text-base text-slate">/{courses.length}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Overall progress bar */}
        {courses.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-navy">Overall Semester Progress</p>
              <p className="text-xs font-bold text-slate">{overallProgress}%</p>
            </div>
            <div className="bg-cloud rounded-full h-4 border-[2px] border-navy/10 overflow-hidden">
              <div
                className="h-full bg-teal rounded-full transition-all duration-700"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* ═══ COURSES LIST ═══ */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-8 rounded-full bg-coral" />
              <h2 className="font-display font-black text-xl text-navy">Your Courses</h2>
            </div>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="bg-lime border-[3px] border-navy shadow-[4px_4px_0_0_#0F0F2D] px-4 py-2 rounded-xl font-display font-bold text-sm text-navy hover:shadow-[6px_6px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
            >
              + Add Course
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[6px_6px_0_0_#000] p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-coral-light flex items-center justify-center">
                <svg className="w-8 h-8 text-coral" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.949 49.949 0 0 0-9.902 3.912l-.003.002-.34.18a.75.75 0 0 1-.707 0A50.009 50.009 0 0 0 7.5 12.174v-.224c0-.131.067-.248.172-.311a54.614 54.614 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.129 56.129 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
                  <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.71 47.878 47.878 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.877 47.877 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 0 1 6 13.18v1.27a1.5 1.5 0 0 0-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.661a6.729 6.729 0 0 0 .551-1.607 1.5 1.5 0 0 0 .14-2.67v-.645a48.549 48.549 0 0 1 3.44 1.667 2.25 2.25 0 0 0 2.12 0Z" />
                </svg>
              </div>
              <h3 className="font-display font-black text-xl text-navy mb-2">Add Your Courses</h3>
              <p className="text-sm text-slate mb-6 max-w-sm mx-auto">
                Add your semester courses and track topics as you cover them.
              </p>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D] px-8 py-3.5 rounded-2xl font-display font-black text-base text-navy transition-all"
              >
                Add First Course
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {courses.map((course) => {
                const c = COLOR_MAP[course.color];
                const completed = course.topics.filter((t) => t.completed).length;
                const total = course.topics.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const isExpanded = expandedId === course.id;
                const isComplete = total > 0 && completed === total;

                return (
                  <div key={course.id} className={`bg-snow border-[4px] border-navy rounded-3xl shadow-[6px_6px_0_0_#000] overflow-hidden ${isComplete ? "opacity-80" : ""}`}>
                    {/* Course header */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : course.id)}
                      className={`w-full ${c.light} border-b-[3px] border-navy px-5 py-4 flex items-center gap-4 text-left transition-colors`}
                    >
                      <div className={`w-12 h-12 rounded-xl ${c.bg} border-[3px] border-navy flex items-center justify-center shrink-0`}>
                        <span className={`font-display font-black text-sm ${c.text}`}>{course.code.slice(0, 3)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-black text-base text-navy truncate">{course.code}</h3>
                          <span className="text-[10px] font-bold text-navy/30 uppercase tracking-wider">{course.creditUnits} CU</span>
                        </div>
                        <p className="text-xs text-navy/50 truncate">{course.name}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className={`font-display font-black text-lg ${isComplete ? "text-teal" : "text-navy"}`}>{pct}%</p>
                          <p className="text-[10px] font-bold text-slate">{completed}/{total}</p>
                        </div>
                        <svg className={`w-5 h-5 text-navy/30 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>

                    {/* Progress bar */}
                    <div className="px-5 py-3 border-b-[2px] border-cloud">
                      <div className="bg-cloud rounded-full h-2.5 overflow-hidden">
                        <div className={`h-full ${c.bar} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {/* Expanded topics */}
                    {isExpanded && (
                      <div className="px-5 py-4">
                        {course.topics.length === 0 ? (
                          <p className="text-sm text-slate text-center py-4">No topics added yet.</p>
                        ) : (
                          <div className="space-y-1.5 mb-4">
                            {course.topics.map((topic, i) => (
                              <div key={topic.id} className="flex items-center gap-3 group">
                                <button
                                  onClick={() => toggleTopic(course.id, topic.id)}
                                  className={`w-6 h-6 rounded-lg border-[2px] flex items-center justify-center shrink-0 transition-all ${
                                    topic.completed
                                      ? `${c.bg} border-navy`
                                      : "border-navy/20 hover:border-navy"
                                  }`}
                                >
                                  {topic.completed && (
                                    <svg className="w-3.5 h-3.5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                                      <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                                <span className="text-xs font-bold text-navy/25 w-5">{String(i + 1).padStart(2, "0")}</span>
                                <span className={`flex-1 text-sm ${topic.completed ? "text-slate line-through" : "text-navy font-medium"}`}>
                                  {topic.name}
                                </span>
                                <button
                                  onClick={() => deleteTopic(course.id, topic.id)}
                                  className="opacity-0 group-hover:opacity-100 text-coral/50 hover:text-coral transition-all"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add topic inline */}
                        <div className="flex gap-2">
                          {addingTopicTo === course.id ? (
                            <>
                              <input
                                type="text"
                                value={inlineTopic}
                                onChange={(e) => setInlineTopic(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") addTopicInline(course.id); }}
                                placeholder="Topic name"
                                className="flex-1 bg-snow border-[2px] border-navy/20 rounded-lg px-3 py-2 text-sm text-navy focus:border-teal focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => addTopicInline(course.id)}
                                className="bg-teal text-navy border-[2px] border-navy px-3 py-2 rounded-lg text-xs font-bold"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => { setAddingTopicTo(null); setInlineTopic(""); }}
                                className="text-slate hover:text-navy px-2"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setAddingTopicTo(course.id)}
                              className="text-xs font-bold text-teal hover:underline"
                            >
                              + Add Topic
                            </button>
                          )}
                        </div>

                        {/* Course actions */}
                        <div className="flex gap-3 mt-4 pt-4 border-t border-cloud">
                          <button onClick={() => startEdit(course)} className="text-xs font-bold text-lavender hover:underline">
                            Edit Course
                          </button>
                          <button onClick={() => deleteCourse(course.id)} className="text-xs font-bold text-coral hover:underline">
                            Delete Course
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ COURSE FORM MODAL ═══ */}
        {showForm && (
          <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center px-4 pt-4 pb-20 md:p-6" onClick={resetForm}>
            <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[10px_10px_0_0_#000] w-full max-w-md max-h-[80vh] md:max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="border-b-[3px] border-navy px-6 py-4 flex items-center justify-between bg-ghost rounded-t-[1.25rem]">
                <h3 className="font-display font-black text-lg text-navy">
                  {editId ? "Edit Course" : "Add Course"}
                </h3>
                <button onClick={resetForm} className="text-slate hover:text-navy">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Code</label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="IEN 301"
                      className="w-full bg-snow border-[3px] border-navy rounded-xl px-3 py-3 text-sm text-navy font-bold uppercase focus:border-teal focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Course Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Operations Research I"
                      className="w-full bg-snow border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy font-medium focus:border-teal focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Credit Units</label>
                    <select
                      value={formCredits}
                      onChange={(e) => setFormCredits(Number(e.target.value))}
                      className="w-full bg-snow border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy font-medium focus:border-teal focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>{n} CU</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">Color</label>
                    <div className="flex gap-2 py-2">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setFormColor(color)}
                          className={`w-9 h-9 rounded-xl ${COLOR_MAP[color].bg} border-[3px] transition-all ${
                            formColor === color ? "border-navy scale-110" : "border-transparent hover:border-navy/30"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {!editId && (
                  <div>
                    <label className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">
                      Topics / Chapters <span className="text-slate/50">(one per line)</span>
                    </label>
                    <textarea
                      value={formTopics}
                      onChange={(e) => setFormTopics(e.target.value)}
                      placeholder={"Linear Programming\nSimplex Method\nTransportation Problem\nAssignment Problem\nGame Theory"}
                      rows={5}
                      className="w-full bg-snow border-[3px] border-navy rounded-xl px-4 py-3 text-sm text-navy font-medium focus:border-teal focus:outline-none resize-none"
                    />
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={!formCode.trim() || !formName.trim()}
                  className="w-full bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D] px-6 py-3.5 rounded-2xl font-display font-black text-base text-navy transition-all disabled:opacity-40"
                >
                  {editId ? "Update Course" : "Add Course"}
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
