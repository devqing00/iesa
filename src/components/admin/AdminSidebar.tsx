"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { useSession } from "@/context/SessionContext";

/* ─── Admin Nav Group Definitions ──────────────────────────────── */

interface NavLink {
  name: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  accentColor: string;
  links: NavLink[];
}

const navGroups: NavGroup[] = [
  {
    label: "Main",
    accentColor: "bg-coral",
    links: [
      {
        name: "Dashboard",
        href: "/admin/dashboard",
        icon: (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6ZM15.75 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-2.25ZM6 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3H6ZM15.75 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3h-2.25Z" />
          </svg>
        ),
      },
      {
        name: "Users",
        href: "/admin/users",
        icon: (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
            <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
          </svg>
        ),
      },
      {
        name: "Sessions",
        href: "/admin/sessions",
        icon: (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Management",
    accentColor: "bg-teal",
    links: [
      {
        name: "Announcements",
        href: "/admin/announcements",
        icon: (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.881 4.345A23.112 23.112 0 0 1 8.25 6H7.5a5.25 5.25 0 0 0-.88 10.427 21.593 21.593 0 0 0 1.378 3.94c.464 1.004 1.674 1.32 2.582.796l.657-.379c.88-.508 1.165-1.593.772-2.468a17.116 17.116 0 0 1-.628-1.607c1.918.258 3.76.75 5.5 1.446A21.727 21.727 0 0 0 18 11.25c0-2.414-.393-4.735-1.119-6.905ZM18.26 3.74a23.22 23.22 0 0 1 1.24 7.51 23.22 23.22 0 0 1-1.24 7.51c-.055.161.044.348.206.404a.75.75 0 0 0 .974-.518 24.725 24.725 0 0 0 0-14.792.75.75 0 0 0-.974-.518.348.348 0 0 0-.206.404Z" />
          </svg>
        ),
      },
      {
        name: "Events",
        href: "/admin/events",
        icon: (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" clipRule="evenodd" />
            <path d="M14.625 13.5a1.125 1.125 0 0 0-1.125 1.125v4.5c0 .621.504 1.125 1.125 1.125h4.5c.621 0 1.125-.504 1.125-1.125v-4.5c0-.621-.504-1.125-1.125-1.125h-4.5Z" />
          </svg>
        ),
      },
      {
        name: "Enrollments",
        href: "/admin/enrollments",
        icon: (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25a3.75 3.75 0 0 0-3-3.75H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" />
            <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
          </svg>
        ),
      },
      {
        name: "Resources",
        href: "/admin/resources",
        icon: (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "System",
    accentColor: "bg-lavender",
    links: [
      {
        name: "Payments",
        href: "/admin/payments",
        icon: (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" />
            <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        name: "Roles",
        href: "/admin/roles",
        icon: (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        name: "Audit Logs",
        href: "/admin/audit-logs",
        icon: (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M9 1.5H5.625c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5Zm6.75 12a.75.75 0 0 0-1.5 0v2.25H12a.75.75 0 0 0 0 1.5h2.25v2.25a.75.75 0 0 0 1.5 0v-2.25H18a.75.75 0 0 0 0-1.5h-2.25V13.5Z" clipRule="evenodd" />
            <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
          </svg>
        ),
      },
    ],
  },
];

/* ─── Admin Sidebar Component ──────────────────────────────────── */

export default function AdminSidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { isExpanded, toggleSidebar, closeSidebar } = useSidebar();
  const { currentSession, allSessions } = useSession();
  const activeSession = allSessions.find(s => s.isActive) ?? currentSession;

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`hidden md:flex md:flex-col fixed left-0 top-0 h-screen z-40 bg-snow border-r-[4px] border-navy transition-all duration-300 ease-in-out ${
          isExpanded ? "w-[260px]" : "w-[72px]"
        }`}
      >
        {/* Logo Area */}
        <div className="p-4 pb-3 flex items-center gap-3">
          <Link href="/admin/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center overflow-hidden">
              <Image src="/assets/images/logo-light.svg" alt="IESA Logo" width={28} height={28} className="object-contain" />
            </div>
            {isExpanded && (
              <div className="min-w-0 overflow-hidden">
                <h1 className="font-display font-black text-lg text-navy leading-tight">IESA</h1>
                <p className="text-[10px] font-bold text-slate tracking-wide uppercase">Admin Portal</p>
              </div>
            )}
          </Link>
        </div>

        {/* Collapse/Expand Toggle — positioned on sidebar edge */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-[14px] top-[54px] w-7 h-7 rounded-full bg-snow border-[3px] border-navy flex items-center justify-center shadow-[2px_2px_0_0_#000] hover:bg-lime hover:shadow-[3px_3px_0_0_#000] transition-all z-50"
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <svg
            className={`w-3.5 h-3.5 text-navy transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Navigation Groups */}
        <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-2.5 space-y-4 scrollbar-thin">
          {navGroups.map((group) => (
            <div key={group.label}>
              {/* Group Header */}
              {isExpanded ? (
                <div className="flex items-center gap-2 px-2 pt-1 pb-1.5">
                  <span className={`w-2 h-2 rounded-full ${group.accentColor}`} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">
                    {group.label}
                  </span>
                </div>
              ) : (
                <div className="flex justify-center py-1">
                  <span className={`w-5 h-[2px] rounded-full ${group.accentColor}`} />
                </div>
              )}

              {/* Group Links */}
              <div className="space-y-0.5">
                {group.links.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      title={!isExpanded ? link.name : undefined}
                      className={`flex items-center gap-3 rounded-xl transition-all text-sm ${
                        isExpanded ? "px-3 py-2.5" : "justify-center px-2 py-2.5"
                      } ${
                        isActive
                          ? "bg-lime text-navy font-bold border-[3px] border-navy shadow-[3px_3px_0_0_#000]"
                          : "text-navy/50 hover:bg-ghost hover:text-navy font-medium"
                      }`}
                    >
                      <span className={isActive ? "text-navy" : ""}>{link.icon}</span>
                      {isExpanded && <span className="truncate">{link.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Session Badge */}
        <div className="px-2.5 pb-1">
          {isExpanded ? (
            <Link
              href="/admin/sessions"
              className="flex items-center gap-3 rounded-2xl bg-navy border-[3px] border-lime p-3 hover:shadow-[3px_3px_0_0_#C8F31D] hover:-translate-y-px transition-all group"
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
              <svg className="w-3.5 h-3.5 text-lime/40 group-hover:text-lime transition-colors shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
              </svg>
            </Link>
          ) : (
            <Link
              href="/admin/sessions"
              title={activeSession?.name ?? "No active session"}
              className="flex justify-center py-2"
            >
              <span className="relative">
                <span className={`w-3 h-3 rounded-full block ${activeSession ? "bg-lime" : "bg-slate"}`} />
                {activeSession && <span className="w-3 h-3 rounded-full bg-lime block absolute inset-0 animate-ping opacity-60" />}
              </span>
            </Link>
          )}
        </div>

        {/* Ecosystem Switch — go to student dashboard */}
        <div className="p-2.5">
          <Link
            href="/dashboard"
            title={!isExpanded ? "Switch to Student" : undefined}
            className={`w-full flex items-center gap-3 rounded-xl text-teal hover:bg-teal-light border-[2px] border-transparent hover:border-teal transition-all text-sm font-bold ${
              isExpanded ? "px-3 py-2.5" : "justify-center px-2 py-2.5"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.174v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
              <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.711 47.87 47.87 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.87 47.87 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286a48.4 48.4 0 0 1 6.463 2.806l.203.107a2.25 2.25 0 0 0 2.12 0l.203-.107Z" />
              <path d="M6.75 14.771V16.5a.75.75 0 0 0 .375.65 48.34 48.34 0 0 1 3.27 2.012 38.7 38.7 0 0 0-.61-3.225.75.75 0 0 0-.449-.547 47.818 47.818 0 0 0-2.586-1.118Z" />
            </svg>
            {isExpanded && <span>Switch to Student</span>}
          </Link>
        </div>

        {/* Sign Out */}
        <div className="p-2.5 mt-auto">
          <button
            onClick={signOut}
            title={!isExpanded ? "Sign Out" : undefined}
            className={`w-full flex items-center gap-3 rounded-xl text-coral hover:bg-coral-light border-[2px] border-transparent hover:border-coral transition-all text-sm font-bold ${
              isExpanded ? "px-3 py-2.5" : "justify-center px-2 py-2.5"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9a.75.75 0 0 1-1.5 0V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
            {isExpanded && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Overlay backdrop — tablet only (md but not lg+) */}
      {isExpanded && (
        <div
          className="hidden md:block lg:hidden fixed inset-0 bg-navy/30 z-35 transition-opacity"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
    </>
  );
}
