"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

interface GeneratedDraft {
  title: string;
  content: string;
  tags?: string[];
  tone: string;
  timestamp: number;
}

interface AnnouncementAIDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  currentTitle?: string;
  initialContent?: string;
  currentContent?: string;
  targetAudience?: string;
  audience?: string;
  targetLevels?: string[];
  priority?: string;
  onAccept?: (result: { title: string; content: string }) => void;
  onApply?: (result: { title: string; content: string }) => void;
}

export default function AnnouncementAIDraftModal({
  isOpen,
  onClose,
  initialTitle,
  currentTitle,
  initialContent,
  currentContent,
  targetAudience = "all",
  audience,
  targetLevels = [],
  priority = "normal",
  onAccept,
  onApply,
}: AnnouncementAIDraftModalProps) {
  const { getAccessToken } = useAuth();

  const effectiveTitle = currentTitle ?? initialTitle ?? "";
  const effectiveContent = currentContent ?? initialContent ?? "";
  const effectiveAudience = audience ?? targetAudience;
  const dispatchApply = (res: { title: string; content: string }) => {
    if (onApply) onApply(res);
    else if (onAccept) onAccept(res);
  };

  // Input state
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [includePersonalization, setIncludePersonalization] = useState(true);
  const [refinementInstructions, setRefinementInstructions] = useState("");

  // Review & history state
  const [draftsHistory, setDraftsHistory] = useState<GeneratedDraft[]>([]);
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"config" | "review">("config");
  const [showOriginal, setShowOriginal] = useState(false);

  // Sync initial inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      setTopic(effectiveTitle || "");
      setContext(effectiveContent ? effectiveContent.replace(/<[^>]+>/g, " ").slice(0, 500).trim() : "");
      setRefinementInstructions("");
      // If we don't have drafts yet, stay on config; if we do, show review
      if (draftsHistory.length === 0) {
        setViewMode("config");
      }
    }
  }, [isOpen, effectiveTitle, effectiveContent]);

  if (!isOpen) return null;

  const handleGenerate = async (isRegenerating = false) => {
    const effectiveTopic = topic.trim() || (effectiveTitle ? effectiveTitle.trim() : "");
    if (!effectiveTopic && !context.trim() && !refinementInstructions.trim()) {
      toast.error("Please enter a subject, notes, or instructions for the AI.");
      return;
    }

    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/iesa-ai/draft"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: effectiveTopic || "Departmental Announcement",
          context: context.trim() || undefined,
          type: "announcement",
          tone,
          length,
          initial_title: effectiveTitle || undefined,
          initial_content: effectiveContent || undefined,
          target_audience: effectiveAudience,
          target_levels: targetLevels.length > 0 ? targetLevels : undefined,
          priority,
          include_personalization: includePersonalization,
          refinement_instructions: refinementInstructions.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate AI draft");
      }

      const data = await response.json();
      const generatedTitle = data.title || effectiveTopic || "Important Announcement";
      const generatedContent = data.content || "<p>Announcement update</p>";
      const tags = data.personalization_tags || [];

      const newDraft: GeneratedDraft = {
        title: generatedTitle,
        content: generatedContent,
        tags,
        tone,
        timestamp: Date.now(),
      };

      setDraftsHistory((prev) => [...prev, newDraft]);
      setActiveDraftIndex(draftsHistory.length);
      setViewMode("review");
      setRefinementInstructions("");
      toast.success(isRegenerating ? "New variation generated!" : "Draft generated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate draft. Please check your network and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const currentDraft = draftsHistory[activeDraftIndex];

  const handleApplyAll = () => {
    if (!currentDraft) return;
    dispatchApply({ title: currentDraft.title, content: currentDraft.content });
    onClose();
    toast.success("AI draft applied to announcement form!");
  };

  const handleApplyTitleOnly = () => {
    if (!currentDraft) return;
    dispatchApply({ title: currentDraft.title, content: effectiveContent });
    onClose();
    toast.success("AI Title applied!");
  };

  const handleApplyContentOnly = () => {
    if (!currentDraft) return;
    dispatchApply({ title: effectiveTitle, content: currentDraft.content });
    onClose();
    toast.success("AI Content applied!");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-xs" onClick={() => !isLoading && onClose()} />

      <div className="relative w-full max-w-2xl bg-snow rounded-3xl border-[3px] border-navy shadow-[6px_6px_0_0_#000] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b-[3px] border-navy bg-ghost">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-lime border-2 border-navy flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]">
              <svg className="w-5 h-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-navy leading-tight">
                AI Announcement Drafting Studio
              </h3>
              <p className="text-xs text-navy/60 font-medium">
                Draft, refine, and personalize without losing your manual work
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {draftsHistory.length > 0 && (
              <div className="flex items-center bg-snow border-2 border-navy rounded-xl overflow-hidden text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode("config")}
                  className={`px-3 py-1.5 transition-colors ${viewMode === "config" ? "bg-navy text-snow" : "text-navy hover:bg-ghost"}`}
                >
                  Configure
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("review")}
                  className={`px-3 py-1.5 transition-colors ${viewMode === "review" ? "bg-navy text-snow" : "text-navy hover:bg-ghost"}`}
                >
                  Review ({draftsHistory.length})
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              disabled={isLoading}
              className="p-1.5 rounded-xl hover:bg-cloud border-2 border-transparent hover:border-navy/20 transition-all text-navy/60 hover:text-navy"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {viewMode === "config" ? (
            <>
              {/* Initial context alert */}
              {(effectiveTitle || effectiveContent) && (
                <div className="p-3.5 rounded-2xl bg-sunny-light border-2 border-navy text-xs space-y-1">
                  <p className="font-bold text-navy flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-navy shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                    </svg>
                    Drafting based on your initial input:
                  </p>
                  <p className="text-navy/70 line-clamp-2 italic">
                    &quot;{effectiveTitle ? effectiveTitle : ""} {effectiveContent ? " — " + effectiveContent.replace(/<[^>]+>/g, " ").slice(0, 100) : ""}&quot;
                  </p>
                </div>
              )}

              {/* Topic / Subject */}
              <div>
                <label className="block text-sm font-bold text-navy mb-1.5">
                  Announcement Subject / Main Focus <span className="text-coral">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Second Semester timetable revision or dues payment deadline"
                  className="w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm font-bold text-navy placeholder:text-slate focus:outline-none transition-all"
                />
              </div>

              {/* Additional Context & Key Notes */}
              <div>
                <label className="block text-sm font-bold text-navy mb-1.5">
                  Key Points / Notes to Include <span className="text-slate font-normal">(optional)</span>
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Key details, dates, venue changes, consequences of missing deadline..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none transition-all resize-none"
                />
              </div>

              {/* Tone & Length */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-navy mb-1.5">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm font-bold text-navy focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="professional">Professional & Informative</option>
                    <option value="exciting">Exciting / Hype (Events/Programs)</option>
                    <option value="formal">Urgent & Formal (Deadlines/Compliance)</option>
                    <option value="friendly">Friendly & Warm</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-navy mb-1.5">Length</label>
                  <select
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm font-bold text-navy focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="short">Short & Punchy</option>
                    <option value="medium">Standard Announcement</option>
                    <option value="long">Comprehensive & Detailed</option>
                  </select>
                </div>
              </div>

              {/* Personalization Tag Toggle */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border-2 border-navy/20 bg-lime/10 cursor-pointer hover:border-navy transition-all">
                <input
                  type="checkbox"
                  checked={includePersonalization}
                  onChange={(e) => setIncludePersonalization(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-2 border-navy text-navy focus:ring-0"
                />
                <div>
                  <p className="text-xs font-bold text-navy">
                    Personalize for each student automatically
                  </p>
                  <p className="text-[11px] text-navy/70">
                    Instructs AI to weave in tags like <code className="bg-snow px-1 rounded border border-navy/20 font-bold">{"{{first_name}}"}</code> and <code className="bg-snow px-1 rounded border border-navy/20 font-bold">{"{{level}}"}</code> so each student feels personally addressed in emails!
                  </p>
                </div>
              </label>
            </>
          ) : (
            /* Review & Comparison View */
            <div className="space-y-5">
              {/* Draft Navigator if multiple */}
              {draftsHistory.length > 1 && (
                <div className="flex items-center justify-between bg-ghost p-2.5 rounded-2xl border-2 border-navy text-xs">
                  <span className="font-bold text-navy">
                    Draft Variation {activeDraftIndex + 1} of {draftsHistory.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={activeDraftIndex === 0}
                      onClick={() => setActiveDraftIndex((i) => Math.max(0, i - 1))}
                      className="px-2.5 py-1 rounded-lg border border-navy bg-snow font-bold disabled:opacity-30"
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      disabled={activeDraftIndex === draftsHistory.length - 1}
                      onClick={() => setActiveDraftIndex((i) => Math.min(draftsHistory.length - 1, i + 1))}
                      className="px-2.5 py-1 rounded-lg border border-navy bg-snow font-bold disabled:opacity-30"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {/* Proposed Title */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate">
                    AI Proposed Title
                  </label>
                  <span className="text-[10px] font-bold text-lime-dark bg-lime-light px-2 py-0.5 rounded-md border border-lime">
                    Ready to use
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-ghost border-[3px] border-navy text-navy font-display font-black text-lg leading-snug">
                  {currentDraft?.title}
                </div>
              </div>

              {/* Proposed Content */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate">
                    AI Proposed Content (Rich HTML Preview)
                  </label>
                  {currentDraft?.tags && currentDraft.tags.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate">Tags:</span>
                      {currentDraft.tags.map((t) => (
                        <span key={t} className="text-[10px] font-mono font-bold bg-lavender-light text-lavender px-1.5 py-0.5 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  className="p-4 rounded-2xl bg-snow border-[3px] border-navy max-h-64 overflow-y-auto prose prose-sm max-w-none text-navy/90 leading-relaxed [&_p]:mb-4 [&_p]:min-h-[1.5rem] [&_p:empty]:min-h-[1.5rem] [&_h2]:font-display [&_h2]:font-black [&_h2]:text-navy [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_hr]:border-0 [&_hr]:border-t-2 [&_hr]:border-navy/10 [&_hr]:my-5"
                  dangerouslySetInnerHTML={{ __html: currentDraft?.content || "" }}
                />
              </div>

              {/* Original Draft Toggle */}
              {(effectiveTitle || effectiveContent) && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowOriginal(!showOriginal)}
                    className="text-xs font-bold text-slate hover:text-navy flex items-center gap-1.5 transition-colors"
                  >
                    <svg className={`w-3.5 h-3.5 transition-transform ${showOriginal ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                    {showOriginal ? "Hide my original draft" : "Show my original draft to compare"}
                  </button>

                  {showOriginal && (
                    <div className="mt-2 p-3.5 rounded-2xl bg-ghost border-2 border-navy/20 text-xs space-y-2">
                      <p className="font-bold text-navy">Original Title: <span className="font-normal">{effectiveTitle || "—"}</span></p>
                      <div>
                        <p className="font-bold text-navy mb-1">Original Content:</p>
                        <div
                          className="text-navy/70 max-h-32 overflow-y-auto prose prose-sm max-w-none [&_p]:mb-3 [&_p]:min-h-[1.25rem] [&_p:empty]:min-h-[1.25rem] [&_hr]:border-0 [&_hr]:border-t-2 [&_hr]:border-navy/10 [&_hr]:my-4"
                          dangerouslySetInnerHTML={{ __html: effectiveContent || "—" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Refinement & Regeneration section */}
              <div className="p-4 rounded-2xl bg-ghost border-2 border-navy/20 space-y-3">
                <label className="block text-xs font-bold text-navy">
                  Want adjustments? Give quick feedback to regenerate:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={refinementInstructions}
                    onChange={(e) => setRefinementInstructions(e.target.value)}
                    placeholder="e.g. 'Make it shorter', 'Mention strict 5PM deadline', 'More upbeat'"
                    className="flex-1 px-3 py-2 rounded-xl bg-snow border-2 border-navy text-xs font-medium text-navy placeholder:text-slate focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerate(true)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy border-2 border-lime text-xs font-bold text-snow press-2 press-lime disabled:opacity-40 shrink-0"
                  >
                    {isLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-snow/30 border-t-snow rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    Regenerate
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t-[3px] border-navy flex flex-wrap items-center justify-between gap-3 bg-ghost">
          <button
            type="button"
            className="px-4 py-2 rounded-xl border-[2px] border-navy bg-cloud text-xs font-bold text-navy hover:bg-cloud-light transition-colors press-2 press-navy"
            onClick={onClose}
            disabled={isLoading}
          >
            Discard & Keep Original
          </button>

          {viewMode === "config" ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border-[3px] border-navy bg-navy px-6 py-2.5 text-sm font-bold text-snow hover:bg-navy/90 transition-colors press-3 press-black disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => handleGenerate(false)}
              disabled={isLoading || (!topic.trim() && !context.trim())}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-snow/30 border-t-snow rounded-full animate-spin" />
                  Generating Draft...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-lime" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate AI Draft
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleApplyTitleOnly}
                className="px-3 py-2 rounded-xl border-2 border-navy text-xs font-bold text-navy hover:bg-snow transition-colors"
                title="Only use the AI Title in the form"
              >
                Use Title Only
              </button>
              <button
                type="button"
                onClick={handleApplyContentOnly}
                className="px-3 py-2 rounded-xl border-2 border-navy text-xs font-bold text-navy hover:bg-snow transition-colors"
                title="Only use the AI Content in the form"
              >
                Use Content Only
              </button>
              <button
                type="button"
                onClick={handleApplyAll}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-lime border-[3px] border-navy text-xs font-display font-black text-navy press-3 press-navy"
              >
                <svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                Accept All Draft
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
