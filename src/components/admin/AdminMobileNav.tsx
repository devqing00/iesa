"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { useState } from "react";

export default function AdminMobileNav() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { currentSession, allSessions } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const activeSession = allSessions.find(s => s.isActive) ?? currentSession;

  const mainLinks = [
    {
      name: "Dashboard",
      href: "/admin/dashboard",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6ZM15.75 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-2.25ZM6 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3H6ZM15.75 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3h-2.25Z" />
        </svg>
      ),
    },
    {
      name: "Users",
      href: "/admin/users",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
          <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
        </svg>
      ),
    },
    {
      name: "Events",
      href: "/admin/events",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Payments",
      href: "/admin/payments",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" />
          <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  const moreLinks = [
    {
      name: "Sessions",
      href: "/admin/sessions",
      color: "bg-teal-light",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Enrollments",
      href: "/admin/enrollments",
      color: "bg-lavender-light",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25a3.75 3.75 0 0 0-3-3.75H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" />
          <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
        </svg>
      ),
    },
    {
      name: "Roles",
      href: "/admin/roles",
      color: "bg-coral-light",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Announcements",
      href: "/admin/announcements",
      color: "bg-sunny-light",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.881 4.345A23.112 23.112 0 0 1 8.25 6H7.5a5.25 5.25 0 0 0-.88 10.427 21.593 21.593 0 0 0 1.378 3.94c.464 1.004 1.674 1.32 2.582.796l.657-.379c.88-.508 1.165-1.593.772-2.468a17.116 17.116 0 0 1-.628-1.607c1.918.258 3.76.75 5.5 1.446A21.727 21.727 0 0 0 18 11.25c0-2.414-.393-4.735-1.119-6.905ZM18.26 3.74a23.22 23.22 0 0 1 1.24 7.51 23.22 23.22 0 0 1-1.24 7.51c-.055.161.044.348.206.404a.75.75 0 0 0 .974-.518 24.725 24.725 0 0 0 0-14.792.75.75 0 0 0-.974-.518.348.348 0 0 0-.206.404Z" />
        </svg>
      ),
    },
    {
      name: "Resources",
      href: "/admin/resources",
      color: "bg-teal-light",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
        </svg>
      ),
    },
    {
      name: "Audit Logs",
      href: "/admin/audit-logs",
      color: "bg-ghost",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.583-.19 2.977 2.977 0 0 0-2.251 1.9v1.132Z" clipRule="evenodd" />
          <path fillRule="evenodd" d="M13.023 8.125A3.375 3.375 0 0 0 9.648 4.75H7.502c-.166 0-.33.01-.493.022A4.476 4.476 0 0 0 3 9.03v7.97a3 3 0 0 0 3 3h7.5a3 3 0 0 0 3-3v-7.5c0-.81-.288-1.553-.767-2.133l-.21-.242ZM10.5 10.5a.75.75 0 0 1 .75.75v.75h.75a.75.75 0 0 1 0 1.5h-.75v.75a.75.75 0 0 1-1.5 0v-.75h-.75a.75.75 0 0 1 0-1.5h.75v-.75a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-snow border-t-[4px] border-navy z-50">
        <div className="flex justify-around items-center py-2 px-2">
          {mainLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive ? "text-navy bg-lime font-bold" : "text-slate hover:text-navy"
                }`}
              >
                {link.icon}
                <span className="text-[10px] font-bold">{link.name}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
              isMenuOpen ? "text-navy bg-lime font-bold" : "text-slate hover:text-navy"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M4.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] font-bold">More</span>
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-navy/30 z-40" onClick={() => setIsMenuOpen(false)}>
          <div
            className="absolute bottom-20 left-3 right-3 bg-snow border-[4px] border-navy rounded-3xl p-4 shadow-[3px_3px_0_0_#000]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">
                More Options
              </p>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="w-7 h-7 rounded-lg border-[2px] border-navy/20 flex items-center justify-center hover:bg-cloud transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm font-bold transition-all ${
                      isActive
                        ? "bg-lime text-navy border-[3px] border-navy shadow-[3px_3px_0_0_#000]"
                        : `${link.color} text-navy/70 hover:text-navy border-[2px] border-transparent hover:border-navy/10`
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className={isActive ? "text-navy" : "text-navy/50"}>{link.icon}</span>
                    <span className="truncate">{link.name}</span>
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t-[2px] border-navy/10 space-y-2">
              {/* Session Badge */}
              <Link
                href="/admin/sessions"
 className="flex items-center gap-3 rounded-2xl bg-navy border-[3px] border-lime p-3 press-3 press-lime transition-all"
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="relative flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-lime block" />
                  <span className="w-2 h-2 rounded-full bg-lime block absolute inset-0 animate-ping opacity-75" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-lime/60 leading-none mb-0.5">Active Session</p>
                  <p className="text-xs font-black text-lime truncate">
                    {activeSession?.name ?? "No active session"}
                  </p>
                </div>
                <svg className="w-3.5 h-3.5 text-lime/40 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                </svg>
              </Link>

              {/* Switch to Student */}
              <Link
                href="/dashboard"
                className="w-full flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm font-bold text-teal hover:bg-teal-light transition-all"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.174v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
                  <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.711 47.87 47.87 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.87 47.87 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286a48.4 48.4 0 0 1 6.463 2.806l.203.107a2.25 2.25 0 0 0 2.12 0l.203-.107Z" />
                  <path d="M6.75 14.771V16.5a.75.75 0 0 0 .375.65 48.34 48.34 0 0 1 3.27 2.012 38.7 38.7 0 0 0-.61-3.225.75.75 0 0 0-.449-.547 47.818 47.818 0 0 0-2.586-1.118Z" />
                </svg>
                <span>Switch to Student</span>
              </Link>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm font-bold text-coral hover:bg-coral-light transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9a.75.75 0 0 1-1.5 0V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
