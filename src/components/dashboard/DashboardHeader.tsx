"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { useDM } from "@/context/DMContext";
import NotificationBell from "@/components/dashboard/NotificationBell";
import GlobalSearch from "@/components/dashboard/GlobalSearch";
import UrgentBar from "@/components/dashboard/UrgentBar";
import { getTimeGreeting } from "@/lib/greeting";
import { resolveProfileImageUrl } from "@/lib/profileImage";
import { buildMessagesHref } from "@/lib/messaging";

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
        <svg aria-hidden="true" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
        </svg>
        {currentSession.name}
        {isViewingPast && (
          <span className="text-[9px] text-sunny font-black uppercase">(Past)</span>
        )}
        <svg aria-hidden="true" className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
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
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-lime-dark" viewBox="0 0 24 24" fill="currentColor">
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

export default function DashboardHeader({ title = "Dashboard", showGreeting = true }: { title?: string; showGreeting?: boolean }) {
  const { userProfile } = useAuth();
  const { totalUnread, isConnected } = useDM();
  const profileImageUrl = resolveProfileImageUrl(userProfile);

  return (
    <div className="sticky top-0 z-30">
      <div className="bg-snow border-b-[3px] border-navy px-4 md:px-6 lg:px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">{title}</p>
            {showGreeting && (
              <h1 className="font-display font-black text-xl sm:text-2xl text-navy">
                {getTimeGreeting()}{userProfile?.firstName ? `, ${userProfile.firstName}` : ""}
              </h1>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SessionSelector />
          <GlobalSearch />
          <NotificationBell />
          <Link
            href={buildMessagesHref({ context: "header" })}
            className="relative w-10 h-10 rounded-xl bg-ghost border-[3px] border-navy flex items-center justify-center hover:bg-cloud hover:border-navy transition-colors"
            aria-label={`Messages${totalUnread > 0 ? ` (${totalUnread} unread)` : ""}`}
          >
            <svg aria-hidden="true" className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-2.234a4.75 4.75 0 0 1-1.087-3.275V10.66a4.795 4.795 0 0 1 0-7.893Z" />
              <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
            </svg>
            {isConnected && (
              <span className="absolute bottom-0.5 left-0.5 w-2 h-2 rounded-full bg-teal border border-snow" />
            )}
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-coral border-[2px] border-snow rounded-full flex items-center justify-center">
                <span className="text-snow text-[10px] font-display font-black px-1">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              </span>
            )}
          </Link>
          {userProfile && (
            <Link
              href="/dashboard/profile"
              className="hidden sm:flex items-center gap-3 pl-4 border-l-[3px] border-navy/10 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-xl bg-lavender-light border-[3px] border-navy flex items-center justify-center overflow-hidden">
                {profileImageUrl ? (
                  <Image
                    src={profileImageUrl}
                    alt={`${userProfile.firstName} ${userProfile.lastName}`}
                    width={40}
                    height={40}
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
