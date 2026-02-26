"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-ghost flex items-center justify-center p-6 overflow-hidden">
      {/* Decorative sparkles */}
      <svg className="fixed top-[12%] left-[8%] w-5 h-5 text-coral/20 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[40%] right-[8%] w-7 h-7 text-navy/8 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed bottom-[20%] left-[14%] w-4 h-4 text-lime/25 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000] overflow-hidden">
          {/* Coral accent header */}
          <div className="bg-coral border-b-[4px] border-navy px-8 py-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-snow border-[3px] border-navy rounded-2xl flex items-center justify-center shadow-[3px_3px_0_0_#000] shrink-0">
              <svg className="w-6 h-6 text-coral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50">IESA Platform</div>
              <div className="font-display font-black text-lg text-navy">Unexpected Error</div>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-8 text-center space-y-6">
            <div>
              <h1 className="font-display font-black text-2xl text-navy mb-2">Something went wrong</h1>
              <p className="text-slate font-display font-normal text-sm leading-relaxed">
                An unexpected error occurred. Please try again or contact support if the problem persists.
              </p>
            </div>

            {process.env.NODE_ENV === "development" && (
              <div className="bg-navy border-[3px] border-lime rounded-2xl p-4 text-left shadow-[4px_4px_0_0_#C8F31D]">
                <p className="font-display font-bold text-[10px] uppercase tracking-[0.12em] text-lime mb-2">Dev — Error Details</p>
                <p className="text-xs text-snow/70 font-mono break-all leading-relaxed">
                  {error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="bg-lime border-[4px] border-navy press-4 press-navy px-6 py-3 rounded-2xl font-display font-bold text-sm text-navy"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="bg-snow border-[4px] border-navy press-4 press-black px-6 py-3 rounded-2xl font-display font-bold text-sm text-navy"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
