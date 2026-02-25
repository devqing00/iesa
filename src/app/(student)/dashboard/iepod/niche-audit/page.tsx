"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { toast } from "sonner";
import {
  getMyNicheAudit,
  createNicheAudit,
  updateNicheAudit,
  listSocieties,
} from "@/lib/api";
import type { NicheAudit, Society } from "@/lib/api";

const STEPS = [
  { key: "focus", title: "Focus Problem", desc: "What engineering problem do you want to explore?" },
  { key: "audience", title: "Target Audience", desc: "Who are you solving this problem for?" },
  { key: "constraints", title: "Constraints", desc: "What limitations or boundaries exist?" },
  { key: "approach", title: "Proposed Approach", desc: "How would you begin tackling this?" },
  { key: "skills", title: "Relevant Skills", desc: "What do you bring to the table?" },
  { key: "extras", title: "Final Details", desc: "Inspiration and society alignment" },
];

const SKILL_SUGGESTIONS = [
  "Python", "MATLAB", "Data Analysis", "CAD/SolidWorks",
  "Project Management", "Operations Research", "Statistics",
  "Technical Writing", "Public Speaking", "Excel/VBA",
  "Supply Chain", "Quality Control", "Ergonomics",
  "Machine Learning", "Sustainability", "3D Printing",
];

export default function NicheAuditPage() {
  const { user } = useAuth();
  const [audit, setAudit] = useState<NicheAudit | null>(null);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [focusProblem, setFocusProblem] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [constraints, setConstraints] = useState("");
  const [proposedApproach, setProposedApproach] = useState("");
  const [relevantSkills, setRelevantSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");
  const [relatedSociety, setRelatedSociety] = useState("");
  const [inspirations, setInspirations] = useState("");

  const [editMode, setEditMode] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [auditData, societyData] = await Promise.allSettled([
        getMyNicheAudit(),
        listSocieties(),
      ]);
      if (auditData.status === "fulfilled" && auditData.value) {
        setAudit(auditData.value);
        populateForm(auditData.value);
      }
      if (societyData.status === "fulfilled") setSocieties(societyData.value);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  function populateForm(a: NicheAudit) {
    setFocusProblem(a.focusProblem);
    setTargetAudience(a.targetAudience);
    setConstraints(a.constraints);
    setProposedApproach(a.proposedApproach);
    setRelevantSkills(a.relevantSkills);
    setRelatedSociety(a.relatedSociety || "");
    setInspirations(a.inspirations || "");
  }

  async function handleSubmit() {
    if (!focusProblem.trim() || !targetAudience.trim() || !constraints.trim() || !proposedApproach.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        focusProblem,
        targetAudience,
        constraints,
        proposedApproach,
        relevantSkills: relevantSkills.length > 0 ? relevantSkills : undefined,
        relatedSociety: relatedSociety || undefined,
        inspirations: inspirations || undefined,
      };

      if (audit) {
        const updated = await updateNicheAudit(data);
        setAudit(updated);
        setEditMode(false);
        toast.success("Niche audit updated!");
      } else {
        const created = await createNicheAudit(data);
        setAudit(created);
        toast.success("Niche audit submitted! +20 points 🎉");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSkill(skill: string) {
    if (relevantSkills.includes(skill)) {
      setRelevantSkills(relevantSkills.filter((s) => s !== skill));
    } else if (relevantSkills.length < 8) {
      setRelevantSkills([...relevantSkills, skill]);
    }
  }

  function addCustomSkill() {
    const trimmed = customSkill.trim();
    if (trimmed && !relevantSkills.includes(trimmed) && relevantSkills.length < 8) {
      setRelevantSkills([...relevantSkills, trimmed]);
      setCustomSkill("");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <DashboardHeader title="Niche Audit" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-snow border-[3px] border-cloud rounded-2xl p-8 animate-pulse">
            <div className="h-6 bg-cloud rounded w-1/3 mb-6" />
            <div className="h-4 bg-cloud rounded w-full mb-3" />
            <div className="h-4 bg-cloud rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  /* ── View mode: existing audit ─────────────────────── */
  if (audit && !editMode) {
    return (
      <div className="min-h-screen">
        <DashboardHeader title="Niche Audit" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard/iepod"
              className="text-lavender font-bold text-sm hover:underline"
            >
              &larr; Back to IEPOD
            </Link>
            <button
              onClick={() => setEditMode(true)}
              className="bg-lime border-[3px] border-navy press-4 press-navy px-5 py-2 rounded-xl font-display font-black text-sm text-navy transition-all"
            >
              Edit Audit
            </button>
          </div>

          <div className="bg-teal-light border-[3px] border-teal rounded-xl px-4 py-2 inline-block">
            <span className="font-bold text-teal text-xs">Completed</span>
          </div>

          {/* Display cards */}
          <div className="space-y-4">
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
              <h3 className="font-display font-black text-base text-navy mb-2">Focus Problem</h3>
              <p className="text-navy/80 text-sm">{audit.focusProblem}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                <h3 className="font-display font-black text-base text-navy mb-2">Target Audience</h3>
                <p className="text-navy/80 text-sm">{audit.targetAudience}</p>
              </div>
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                <h3 className="font-display font-black text-base text-navy mb-2">Constraints</h3>
                <p className="text-navy/80 text-sm">{audit.constraints}</p>
              </div>
            </div>

            <div className="bg-lavender border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] rotate-[-0.5deg]">
              <h3 className="font-display font-black text-base text-navy mb-2">Proposed Approach</h3>
              <p className="text-navy/80 text-sm">{audit.proposedApproach}</p>
            </div>

            {audit.relevantSkills.length > 0 && (
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                <h3 className="font-display font-black text-base text-navy mb-3">Relevant Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {audit.relevantSkills.map((s) => (
                    <span key={s} className="bg-lime-light border-[2px] border-navy/20 text-navy font-bold text-xs px-3 py-1 rounded-xl">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(audit.relatedSociety || audit.inspirations) && (
              <div className="grid md:grid-cols-2 gap-4">
                {audit.relatedSociety && (
                  <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                    <h3 className="font-display font-black text-base text-navy mb-2">Related Society</h3>
                    <p className="text-navy/80 text-sm">{audit.relatedSociety}</p>
                  </div>
                )}
                {audit.inspirations && (
                  <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                    <h3 className="font-display font-black text-base text-navy mb-2">Inspirations</h3>
                    <p className="text-navy/80 text-sm">{audit.inspirations}</p>
                  </div>
                )}
              </div>
            )}

            <p className="text-slate text-xs text-right">
              Last updated: {new Date(audit.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form mode: wizard steps ───────────────────────── */
  const isEditingExisting = audit && editMode;

  return (
    <div className="min-h-screen">
      <DashboardHeader title={isEditingExisting ? "Edit Niche Audit" : "Niche Audit"} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link
          href="/dashboard/iepod"
          className="text-lavender font-bold text-sm hover:underline inline-block"
        >
          &larr; Back to IEPOD
        </Link>

        {/* Step indicator */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                i === step
                  ? "bg-navy text-lime"
                  : i < step
                  ? "bg-teal-light text-teal"
                  : "bg-cloud text-slate"
              }`}
            >
              <span className="font-display font-black">{i < step ? "✓" : `0${i + 1}`}</span>
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000]">
          <h3 className="font-display font-black text-xl text-navy mb-2">{STEPS[step].title}</h3>
          <p className="text-slate text-sm mb-6">{STEPS[step].desc}</p>

          {/* Step 0: Focus Problem */}
          {step === 0 && (
            <div>
              <textarea
                value={focusProblem}
                onChange={(e) => setFocusProblem(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="Describe an industrial/systems engineering problem that interests you. Be specific about the domain, scale, and potential impact..."
                className="w-full border-[3px] border-navy rounded-xl px-4 py-3 font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none"
              />
              <p className="text-slate text-xs mt-2">{focusProblem.length}/2000 characters</p>
            </div>
          )}

          {/* Step 1: Target Audience */}
          {step === 1 && (
            <div>
              <textarea
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                rows={5}
                maxLength={1500}
                placeholder="Who would benefit from a solution? Think about stakeholders, end users, and communities affected..."
                className="w-full border-[3px] border-navy rounded-xl px-4 py-3 font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none"
              />
              <p className="text-slate text-xs mt-2">{targetAudience.length}/1500 characters</p>
            </div>
          )}

          {/* Step 2: Constraints */}
          {step === 2 && (
            <div>
              <textarea
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                rows={5}
                maxLength={1500}
                placeholder="What are the limitations? Consider budget, technology, time, regulations, geographical, social factors..."
                className="w-full border-[3px] border-navy rounded-xl px-4 py-3 font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none"
              />
              <p className="text-slate text-xs mt-2">{constraints.length}/1500 characters</p>
            </div>
          )}

          {/* Step 3: Proposed Approach */}
          {step === 3 && (
            <div>
              <textarea
                value={proposedApproach}
                onChange={(e) => setProposedApproach(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="How would you begin tackling this problem? Think about methodology, frameworks, tools, research methods..."
                className="w-full border-[3px] border-navy rounded-xl px-4 py-3 font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none"
              />
              <p className="text-slate text-xs mt-2">{proposedApproach.length}/2000 characters</p>
            </div>
          )}

          {/* Step 4: Skills */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {SKILL_SUGGESTIONS.map((skill) => {
                  const selected = relevantSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1.5 rounded-xl border-[2px] text-xs font-bold transition-all ${
                        selected
                          ? "bg-lime border-navy text-navy"
                          : "bg-snow border-cloud text-slate hover:border-navy"
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSkill())}
                  placeholder="Add custom skill..."
                  className="flex-1 border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime"
                />
                <button
                  type="button"
                  onClick={addCustomSkill}
                  className="bg-navy text-lime font-bold text-xs px-4 rounded-xl"
                >
                  Add
                </button>
              </div>

              {relevantSkills.length > 0 && (
                <div>
                  <p className="text-label text-navy text-xs mb-2">Selected ({relevantSkills.length}/8):</p>
                  <div className="flex flex-wrap gap-2">
                    {relevantSkills.map((s) => (
                      <span
                        key={s}
                        className="bg-lime-light border-[2px] border-navy/20 text-navy font-bold text-xs px-3 py-1 rounded-xl flex items-center gap-1.5"
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() => setRelevantSkills(relevantSkills.filter((sk) => sk !== s))}
                          className="text-navy/40 hover:text-coral text-sm"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Extras */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="text-label text-navy text-xs mb-2 block">Related Society (optional)</label>
                <select
                  value={relatedSociety}
                  onChange={(e) => setRelatedSociety(e.target.value)}
                  className="w-full border-[3px] border-navy rounded-xl px-4 py-3 font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime"
                >
                  <option value="">None</option>
                  {societies.map((s) => (
                    <option key={s._id} value={s.shortName}>{s.name} ({s.shortName})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-label text-navy text-xs mb-2 block">Inspirations (optional)</label>
                <textarea
                  value={inspirations}
                  onChange={(e) => setInspirations(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Papers, projects, TED talks, or experiences that inspired your focus..."
                  className="w-full border-[3px] border-navy rounded-xl px-4 py-3 font-medium text-navy bg-snow focus:outline-none focus:ring-2 focus:ring-lime resize-none"
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              type="button"
              onClick={() => {
                if (step > 0) setStep(step - 1);
                else if (isEditingExisting) setEditMode(false);
              }}
              className="bg-transparent border-[3px] border-navy px-5 py-2 rounded-xl font-display font-bold text-sm text-navy hover:bg-navy hover:text-lime transition-all"
            >
              {step === 0 ? (isEditingExisting ? "Cancel" : "Back") : "Previous"}
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="bg-navy border-[3px] border-navy px-5 py-2 rounded-xl font-display font-bold text-sm text-lime press-3 press-navy"
              >
                Next &rarr;
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-lime border-[4px] border-navy press-5 press-navy px-8 py-3 rounded-2xl font-display font-black text-base text-navy transition-all disabled:opacity-50"
              >
                {submitting
                  ? "Saving..."
                  : isEditingExisting
                  ? "Update Audit"
                  : "Submit Audit"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
