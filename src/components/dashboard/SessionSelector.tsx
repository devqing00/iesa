"use client";

import { useSession } from "@/context/SessionContext";
import { useState } from "react";

export default function SessionSelector() {
  const { allSessions, currentSession, switchSession, isLoading } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return <div className="h-10 w-40 bg-cloud rounded-xl border-[3px] border-navy animate-pulse" />;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-snow border-[3px] border-navy rounded-xl shadow-[3px_3px_0_0_#000] hover:shadow-[5px_5px_0_0_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all text-sm font-bold text-navy"
      >
        <span>{currentSession?.name || "Select Session"}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-snow border-[3px] border-navy rounded-2xl shadow-[6px_6px_0_0_#000] z-50 overflow-hidden">
          <div className="p-2 max-h-60 overflow-y-auto">
            {allSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => { switchSession(session.id); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${
                  currentSession?.id === session.id
                    ? "bg-lime text-navy font-bold"
                    : "text-navy/60 hover:bg-cloud font-medium"
                }`}
              >
                <span>{session.name}</span>
                {session.isActive && (
                  <span className="ml-2 text-[10px] font-bold text-teal uppercase">Active</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
