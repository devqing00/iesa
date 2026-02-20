"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <span className="font-display font-bold text-xs text-slate uppercase tracking-wider flex items-center justify-center gap-2">
            <svg className="w-3 h-3 text-coral" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z"/></svg> Dashboard Error
          </span>
          <h2 className="font-display font-black text-2xl text-navy">Page Error</h2>
        </div>

        <p className="font-display font-normal text-sm text-navy/60">
          This page encountered an error. Your other dashboard features should
          still work.
        </p>

        {process.env.NODE_ENV === "development" && (
          <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 text-left shadow-[4px_4px_0_0_#000]">
            <p className="font-display font-bold text-xs text-coral uppercase tracking-wider mb-2">Error Details</p>
            <p className="text-sm text-navy/60 font-mono break-all">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button onClick={reset} className="bg-transparent border-[3px] border-navy px-5 py-2.5 rounded-xl font-display font-black text-sm text-navy hover:bg-navy hover:text-lime transition-all">
            Try Again
          </button>
          <a href="/dashboard" className="bg-transparent border-[3px] border-navy px-5 py-2.5 rounded-xl font-display font-black text-sm text-navy hover:bg-navy hover:text-lime transition-all">
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
