"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface GenderCompletionModalProps {
  onSubmit: (gender: "male" | "female") => Promise<void>;
}

export function GenderCompletionModal({ onSubmit }: GenderCompletionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = async () => {
    if (!gender) {
      setError("Please select your gender.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(gender);
    } catch {
      setError("Could not save gender. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" role="presentation">
      <div className="absolute inset-0 bg-navy/70 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Complete your gender details"
        className="relative w-full max-w-md bg-snow border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000] overflow-hidden"
      >
        <div className="bg-lime border-b-[4px] border-navy px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">One Last Step</p>
          <h2 className="font-display font-black text-2xl text-navy leading-tight mt-1">
            Complete your profile
          </h2>
        </div>

        <div className="px-6 py-6 space-y-4">
          <p className="text-sm text-slate leading-relaxed">
            Please select your gender to complete your profile setup.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGender("male")}
              className={`rounded-2xl px-4 py-3 border-[3px] font-display font-bold text-sm transition-colors ${
                gender === "male"
                  ? "bg-teal-light border-navy text-navy"
                  : "bg-snow border-cloud text-slate hover:border-navy/30"
              }`}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => setGender("female")}
              className={`rounded-2xl px-4 py-3 border-[3px] font-display font-bold text-sm transition-colors ${
                gender === "female"
                  ? "bg-coral-light border-navy text-navy"
                  : "bg-snow border-cloud text-slate hover:border-navy/30"
              }`}
            >
              Female
            </button>
          </div>

          {error && (
            <div className="p-3 border-[2px] border-coral bg-coral-light text-coral text-xs rounded-xl font-medium">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex items-center justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-lime border-[4px] border-navy rounded-2xl px-6 py-3 text-base font-display font-black text-navy press-4 press-navy disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save and Continue"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
