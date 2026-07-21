"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

interface AIDraftButtonProps {
  onDraftGenerated: (content: string) => void;
  type?: "announcement" | "event" | "press";
  className?: string;
}

export default function AIDraftButton({
  onDraftGenerated,
  type = "announcement",
  className = "",
}: AIDraftButtonProps) {
  const { getAccessToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/v1/iesa-ai/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic,
          context,
          type,
          tone,
          length,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate draft");
      }

      const data = await response.json();
      onDraftGenerated(data.content);
      setIsOpen(false);
      toast.success("Draft generated successfully!");
    } catch (error) {
      console.error("AI Draft Error:", error);
      toast.error("Failed to generate draft. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-navy bg-lime border-[3px] border-navy rounded-xl hover:bg-lime/80 transition-colors press-3 press-navy ${className}`}
      >
        <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        Draft with AI
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/50" onClick={() => !isLoading && setIsOpen(false)} />
          <div className="relative w-full max-w-md bg-snow rounded-3xl border-[3px] border-navy shadow-[4px_4px_0_0_#000] overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="flex items-center gap-2 p-5 border-b-[3px] border-navy bg-ghost">
              <div className="w-8 h-8 rounded-xl bg-lime-light border-2 border-navy flex items-center justify-center">
                <svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="font-display font-black text-lg text-navy">
                Draft {type.charAt(0).toUpperCase() + type.slice(1)}
              </h3>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-bold text-navy mb-1.5">
                  Topic / Subject <span className="text-coral">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Upcoming dues deadline"
                  className="w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-navy mb-1.5">
                  Additional Context <span className="text-slate font-normal">(optional)</span>
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Key details to include, bullet points, specific dates..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-navy mb-1.5">
                    Tone
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy focus:outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="professional">Professional</option>
                    <option value="exciting">Exciting / Hype</option>
                    <option value="formal">Strictly Formal</option>
                    <option value="friendly">Friendly & Warm</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-navy mb-1.5">
                    Length
                  </label>
                  <select
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy focus:outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long & Detailed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-5 border-t-[3px] border-navy flex justify-end gap-3 bg-ghost mt-auto">
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl border-[3px] border-navy bg-cloud text-sm font-bold text-navy hover:bg-cloud-light transition-colors press-3 press-navy"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex justify-center items-center gap-2 rounded-xl border-[3px] border-navy bg-navy px-5 py-2.5 text-sm font-bold text-snow hover:bg-navy/90 transition-colors press-3 press-black disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleGenerate}
                disabled={isLoading || !topic.trim()}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-snow/30 border-t-snow rounded-full animate-spin" />
                    Drafting...
                  </>
                ) : (
                  <>
                    <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
