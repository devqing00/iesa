"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import NotificationBell from "@/components/dashboard/NotificationBell";
import GlobalSearch from "@/components/dashboard/GlobalSearch";
import UrgentBar from "@/components/dashboard/UrgentBar";
import { getTimeGreeting } from "@/lib/greeting";

function SessionSelector() {
  const { currentSession, allSessions, switchSession, isLoading } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!currentSession || allSessions.length <= 1) return null;

  const isViewingPast = !currentSession.isActive;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-[2px] transition-all ${
          isViewingPast
            ? "bg-sunny-light border-sunny text-navy"
            : "bg-ghost border-cloud text-slate hover:border-navy hover:text-navy"
        }`}
        aria-label="Switch academic session"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
        </svg>
        {currentSession.name}
        {isViewingPast && (
          <span className="text-[9px] text-sunny font-black uppercase">(Past)</span>
        )}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-snow border-[3px] border-navy rounded-xl shadow-[4px_4px_0_0_#000] overflow-hidden z-50">
          <div className="px-3 pt-2.5 pb-1.5">
            <p className="text-[9px] font-bold text-slate uppercase tracking-wider">Academic Sessions</p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {allSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  switchSession(s.id);
                  setOpen(false);
                }}
                disabled={isLoading}
                className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors flex items-center justify-between ${
                  currentSession.id === s.id
                    ? "bg-lime-light text-navy font-bold"
                    : "text-navy hover:bg-ghost"
                }`}
              >
                <span>{s.name}</span>
                <span className="flex items-center gap-1">
                  {s.isActive && (
                    <span className="text-[9px] font-bold text-teal uppercase">Active</span>
                  )}
                  {currentSession.id === s.id && (
                    <svg className="w-3.5 h-3.5 text-lime-dark" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardHeader({ title = "Dashboard" }: { title?: string }) {
  const { userProfile } = useAuth();

  return (
    <div className="sticky top-0 z-30">
      <div className="bg-snow border-b-[3px] border-navy px-4 md:px-6 lg:px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">{title}</p>
            <h1 className="font-display font-black text-xl sm:text-2xl text-navy">
              {getTimeGreeting()}{userProfile?.firstName ? `, ${userProfile.firstName}` : ""}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SessionSelector />
          <GlobalSearch />
          <NotificationBell />
          {userProfile && (
            <Link
              href="/dashboard/profile"
              className="hidden sm:flex items-center gap-3 pl-4 border-l-[3px] border-navy/10 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-xl bg-lavender-light border-[3px] border-navy flex items-center justify-center overflow-hidden">
                {userProfile.profilePictureUrl ? (
                  <img
                    src={userProfile.profilePictureUrl}
                    alt={`${userProfile.firstName} ${userProfile.lastName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-navy font-black text-xs">
                    {userProfile.firstName?.[0]}{userProfile.lastName?.[0]}
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-sm text-navy">{userProfile.firstName} {userProfile.lastName}</p>
                <p className="text-xs text-slate font-medium">
                  {(() => {
                    const lvl = userProfile.level || userProfile.currentLevel;
                    return lvl ? `${String(lvl).replace(/L$/i, "")} Level` : "Student";
                  })()}
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>
      </div>
      <UrgentBar />
    </div>
  );
}
