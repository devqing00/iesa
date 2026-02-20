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
    <div className="min-h-screen bg-ghost flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <span className="font-display font-bold text-xs uppercase tracking-wider text-slate flex items-center justify-center gap-2">
            <span>✦</span> Error
          </span>
          <h1 className="font-display font-black text-2xl md:text-3xl text-navy">Something went wrong</h1>
        </div>

        <p className="text-navy/60 font-display font-normal">
          An unexpected error occurred. Please try again or contact support if the
          problem persists.
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
          <button onClick={reset} className="btn-outline">
            Try Again
          </button>
          <Link href="/" className="btn-outline">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
