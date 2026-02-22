"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <span className="font-display font-bold text-xs text-slate uppercase tracking-wider flex items-center justify-center gap-2">
            <svg className="w-3.5 h-3.5 text-coral" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" /></svg> Admin Error
          </span>
          <h2 className="font-display font-black text-2xl md:text-3xl text-navy">Page Error</h2>
        </div>

        <p className="text-navy/60 font-display font-normal text-sm">
          This admin page encountered an error. Please try again.
        </p>

        {process.env.NODE_ENV === "development" && (
          <div className="card p-4 text-left">
            <p className="font-display font-bold text-xs uppercase tracking-wider text-coral mb-2">Error Details</p>
            <p className="text-sm text-navy/60 font-mono break-all">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button onClick={reset} className="px-6 py-2.5 bg-lime border-[3px] border-navy rounded-2xl font-display font-bold text-sm text-navy press-3 press-navy transition-all">
            Try Again
          </button>
          <a href="/admin/dashboard" className="px-6 py-2.5 bg-transparent border-[3px] border-navy rounded-2xl font-display font-bold text-sm text-navy hover:bg-navy hover:text-lime transition-all">
            Admin Home
          </a>
        </div>
      </div>
    </div>
  );
}
