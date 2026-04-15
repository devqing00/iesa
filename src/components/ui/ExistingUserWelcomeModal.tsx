"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ExistingUserWelcomeModalProps {
  onContinue: () => void;
}

export function ExistingUserWelcomeModal({ onContinue }: ExistingUserWelcomeModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" role="presentation">
      <button
        type="button"
        aria-label="Close welcome modal"
        className="absolute inset-0 bg-navy/70 backdrop-blur-sm"
        onClick={onContinue}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome back"
        className="relative w-full max-w-lg bg-snow border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000] overflow-hidden"
      >
        <div className="bg-teal border-b-[4px] border-navy px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Welcome Back</p>
          <h2 className="font-display font-black text-2xl text-navy leading-tight mt-1">
            Great to see you again
          </h2>
        </div>

        <div className="px-6 py-6 space-y-4">
          <p className="text-sm text-slate leading-relaxed">
            Your account is already set up. We have a separate quick welcome for returning users so the full onboarding flow is only shown to new users who still need to complete their setup.
          </p>

          <div className="bg-ghost border-[2px] border-cloud rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-navy-muted">You can now continue to your dashboard.</p>
          </div>
        </div>

        <div className="px-6 pb-6 flex items-center justify-end">
          <button
            type="button"
            onClick={onContinue}
            className="bg-lime border-[4px] border-navy rounded-2xl px-6 py-3 text-base font-display font-black text-navy press-4 press-navy"
          >
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
