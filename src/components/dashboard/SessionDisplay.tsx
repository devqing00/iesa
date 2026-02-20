"use client";

import { useSession } from "@/context/SessionContext";

export default function SessionDisplay() {
  const { currentSession, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="bg-cloud rounded-2xl border-[3px] border-navy p-4 animate-pulse">
        <div className="h-4 w-32 bg-cloud rounded" />
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="bg-sunny-light rounded-2xl border-[3px] border-navy p-4">
        <p className="text-sm font-bold text-navy">No active session</p>
        <p className="text-xs text-slate font-medium mt-1">Contact admin to set up a session</p>
      </div>
    );
  }

  return (
    <div className="bg-snow rounded-2xl border-[3px] border-navy shadow-[4px_4px_0_0_#000] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-bold text-xs uppercase tracking-wider text-slate font-bold">Current Session</p>
          <p className="font-bold text-navy text-sm mt-1">{currentSession.name}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border-[2px] ${
          currentSession.isActive
            ? "bg-teal-light text-navy border-navy"
            : "bg-cloud text-slate border-cloud"
        }`}>
          {currentSession.isActive ? "Active" : "Ended"}
        </span>
      </div>
    </div>
  );
}
