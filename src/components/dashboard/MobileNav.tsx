"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { usePermissions } from "@/context/PermissionsContext";
import { useDM } from "@/context/DMContext";
import { useNotificationCount } from "@/hooks/useNotificationCount";
import { isExternalStudent, EXTERNAL_HIDDEN_HREFS, hasAdminAccess, isRouteAllowedForExternal } from "@/lib/studentAccess";

interface MobileNavLink {
  name: string;
  href: string;
  icon: React.ReactNode;
  color?: string;
  anyPermission?: string[];
  badge?: number;
  group?: "academics" | "community" | "leadership";
}

export default function MobileNav() {
  const STUDENT_MORE_GROUPS_KEY = "iesa:student-mobile-more-groups";
  const pathname = usePathname();
  const { signOut, userProfile } = useAuth();
  const { currentSession, allSessions } = useSession();
  const { hasPermission, permissions } = usePermissions();
  const { totalUnread } = useDM();
  const { unreadCount: notifUnread } = useNotificationCount();
  const [showMore, setShowMore] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<"academics" | "community" | "leadership", boolean>>(() => {
    const fallback = { academics: true, community: false, leadership: false };
    if (typeof window === "undefined") return fallback;

    try {
      const saved = localStorage.getItem(STUDENT_MORE_GROUPS_KEY);
      if (!saved) return fallback;

      const parsed = JSON.parse(saved) as Partial<Record<"academics" | "community" | "leadership", boolean>>;
      return {
        academics: typeof parsed.academics === "boolean" ? parsed.academics : fallback.academics,
        community: typeof parsed.community === "boolean" ? parsed.community : fallback.community,
        leadership: typeof parsed.leadership === "boolean" ? parsed.leadership : fallback.leadership,
      };
    } catch {
      return fallback;
    }
  });
  const activeSession = allSessions.find(s => s.isActive) ?? currentSession;
  const external = isExternalStudent(userProfile?.department);

  useEffect(() => {
    try {
      localStorage.setItem(STUDENT_MORE_GROUPS_KEY, JSON.stringify(openGroups));
    } catch {
      // ignore storage write failures
    }
  }, [openGroups]);

  const isVisible = (link: MobileNavLink) => {
    if (link.href === "/dashboard/freshers" && userProfile?.role === "admin") return false;
    // Hide IPE-only links for external students
    if (external && EXTERNAL_HIDDEN_HREFS.has(link.href)) return false;
    if (external && link.href.startsWith("/dashboard") && !isRouteAllowedForExternal(link.href)) return false;
    if (!link.anyPermission) return true;
    return link.anyPermission.some((p) => hasPermission(p));
  };

  const mainLinks = [
    {
      name: "Home",
      href: "/dashboard",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6ZM15.75 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-2.25ZM6 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3H6ZM15.75 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3h-2.25Z" />
        </svg>
      ),
    },
    {
      name: "Events",
      href: "/dashboard/events",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Resources",
      href: "/dashboard/resources",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
        </svg>
      ),
    },
    {
      name: "Pay",
      href: "/dashboard/payments",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" />
          <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  const moreLinks: MobileNavLink[] = [
    {
      name: "Timetable",
      href: "/dashboard/timetable",
      color: "bg-lavender-light",
      group: "academics",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Growth Hub",
      href: "/dashboard/growth",
      color: "bg-teal-light",
      group: "academics",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M15.22 6.268a.75.75 0 0 1 .968-.431l5.942 2.28a.75.75 0 0 1 .431.97l-2.28 5.94a.75.75 0 1 1-1.4-.537l1.63-4.251-1.086.484a11.2 11.2 0 0 0-5.45 5.174.75.75 0 0 1-1.199.19L9 12.312l-6.22 6.22a.75.75 0 0 1-1.06-1.061l6.75-6.75a.75.75 0 0 1 1.06 0l3.606 3.606a12.695 12.695 0 0 1 5.68-4.974l1.086-.483-4.251-1.632a.75.75 0 0 1-.432-.969Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Hubs",
      href: "/dashboard/hubs",
      color: "bg-coral-light",
      group: "academics",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Teams",
      href: "/dashboard/teams",
      color: "bg-lavender-light",
      group: "community",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.583-.164 3.023 3.023 0 0 0-2.251 2.996Z" clipRule="evenodd" />
          <path fillRule="evenodd" d="M2.25 13.5a3 3 0 0 0 3 3h1.228a3.375 3.375 0 0 1-.978-2.375v-9.75a3.375 3.375 0 0 1 3-3.357H13.5a3 3 0 0 1 3 3v1.107a3.375 3.375 0 0 1 .878 2.618v6.007a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-1.25Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Freshers",
      href: "/dashboard/freshers",
      color: "bg-sunny-light",
      anyPermission: ["freshers:manage"],
      group: "leadership",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122Z" />
        </svg>
      ),
    },
    {
      name: "Class Rep",
      href: "/dashboard/class-rep",
      color: "bg-lavender-light",
      anyPermission: ["class_rep:view_cohort"],
      group: "leadership",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.173v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
          <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.711 47.87 47.87 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.87 47.87 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286a48.4 48.4 0 0 1 6.862 2.977l.895.474.896-.474c.26-.138.525-.27.79-.4Z" />
        </svg>
      ),
    },
    {
      name: "Team Head",
      href: "/dashboard/team-head",
      color: "bg-teal-light",
      anyPermission: ["team_head:view_members"],
      group: "leadership",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "TIMP Lead",
      href: "/dashboard/timp/manage",
      color: "bg-lime-light",
      anyPermission: ["timp:manage"],
      group: "leadership",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A18.034 18.034 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "IEPOD Admin",
      href: "/dashboard/iepod/manage",
      color: "bg-coral-light",
      anyPermission: ["iepod:manage", "iepod:view"],
      group: "leadership",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Profile",
      href: "/dashboard/profile",
      color: "bg-sunny-light",
      group: "community",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      color: "bg-cloud",
      group: "community",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "IESA AI",
      href: "/dashboard/iesa-ai",
      color: "bg-lime-light",
      group: "community",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Messages",
      href: "/dashboard/messages",
      color: "bg-lavender-light",
      badge: totalUnread,
      group: "community",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-2.234a4.75 4.75 0 0 1-1.087-3.275V10.66a4.795 4.795 0 0 1 0-7.893Z" />
          <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
        </svg>
      ),
    },
    {
      name: "Announcements",
      href: "/dashboard/announcements",
      color: "bg-cloud",
      badge: notifUnread,
      group: "community",
      icon: (
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  const moreSections: Array<{ key: NonNullable<MobileNavLink["group"]>; label: string }> = [
    { key: "academics", label: "Academics" },
    { key: "community", label: "Community" },
    { key: "leadership", label: "Leadership Tools" },
  ];

  const activeMoreGroup = moreLinks.find(
    (link) => link.href === pathname && link.group && isVisible(link)
  )?.group;

  const openActiveMoreSection = () => {
    if (!activeMoreGroup) return;
    setOpenGroups((prev) => {
      const currentlyOnlyActiveOpen =
        prev[activeMoreGroup] &&
        Object.entries(prev).every(([key, value]) => (key === activeMoreGroup ? value : !value));
      if (currentlyOnlyActiveOpen) return prev;

      return {
        academics: false,
        community: false,
        leadership: false,
        [activeMoreGroup]: true,
      };
    });
  };

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="md:hidden fixed inset-0 bg-navy/30 z-40" onClick={() => setShowMore(false)}>
          <div
            className="absolute bottom-20 left-3 right-3 bg-snow border-[3px] border-navy rounded-3xl shadow-[3px_3px_0_0_#000] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">
                More Options
              </p>
              <button
                onClick={() => setShowMore(false)}
                aria-label="Close more options"
                className="w-7 h-7 rounded-lg border-[2px] border-navy/20 flex items-center justify-center hover:bg-cloud transition-colors"
              >
                <svg aria-hidden="true" className="w-3.5 h-3.5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {moreSections.map((section) => {
                const links = moreLinks.filter(
                  (link) => link.group === section.key && isVisible(link)
                );
                if (links.length === 0) return null;

                const open = openGroups[section.key];
                return (
                  <div key={section.key} className="border-[2px] border-navy/10 rounded-2xl bg-ghost/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroups((prev) => {
                          const nextOpen = !prev[section.key];
                          return {
                            academics: false,
                            community: false,
                            leadership: false,
                            [section.key]: nextOpen,
                          };
                        })
                      }
                      className="w-full flex items-center justify-between px-3.5 py-3 text-left"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate">{section.label}</span>
                      <svg
                        aria-hidden="true"
                        className={`w-4 h-4 text-navy transition-transform ${open ? "rotate-180" : "rotate-0"}`}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 1 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {open && (
                      <div className="p-2 pt-0 grid grid-cols-2 gap-2">
                        {links.map((link) => {
                          const isActive = pathname === link.href;
                          return (
                            <Link
                              key={link.href}
                              href={link.href}
                              className={`relative flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm font-bold transition-all ${
                                isActive
                                  ? "bg-lime text-navy border-[3px] border-navy shadow-[3px_3px_0_0_#000]"
                                  : `${link.color} text-navy/70 hover:text-navy border-[2px] border-transparent hover:border-navy/10`
                              }`}
                              onClick={() => setShowMore(false)}
                            >
                              <span className={isActive ? "text-navy" : "text-navy/50"}>{link.icon}</span>
                              <span className="truncate">{link.name}</span>
                              {link.badge != null && link.badge > 0 && (
                                <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-coral text-snow text-[10px] font-black flex items-center justify-center">
                                  {link.badge > 9 ? "9+" : link.badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sign Out in More menu */}
            <div className="mt-3 pt-3 border-t-[2px] border-navy/10 space-y-2">
              {/* Session Badge */}
              <div className="flex items-center gap-3 rounded-2xl bg-navy border-[3px] border-ghost/20 p-3">
                <span className="relative flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-lime block" />
                  <span className="w-2 h-2 rounded-full bg-lime block absolute inset-0 animate-ping opacity-75" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-snow/50 leading-none mb-0.5">Active Session</p>
                  <p className="text-xs font-black text-snow truncate">
                    {activeSession?.name ?? "No active session"}
                  </p>
                </div>
              </div>

              {/* Switch to Admin — users with admin access (role or permissions) */}
              {userProfile && hasAdminAccess(userProfile.role, permissions) && (
                <Link
                  href="/admin/dashboard"
                  className="w-full flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm font-bold text-lavender hover:bg-lavender-light transition-all"
                  onClick={() => setShowMore(false)}
                >
                  <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 1.5a.75.75 0 0 1 .75.75V4.5a.75.75 0 0 1-1.5 0V2.25A.75.75 0 0 1 12 1.5ZM5.636 4.136a.75.75 0 0 1 1.06 0l1.592 1.591a.75.75 0 0 1-1.061 1.06l-1.591-1.59a.75.75 0 0 1 0-1.061Zm12.728 0a.75.75 0 0 1 0 1.06l-1.591 1.592a.75.75 0 0 1-1.06-1.061l1.59-1.591a.75.75 0 0 1 1.061 0Zm-6.816 4.496a.75.75 0 0 1 .82.311l5.228 7.917a.75.75 0 0 1-.777 1.148l-2.097-.43 1.045 3.9a.75.75 0 0 1-1.45.388l-1.044-3.899-1.601 1.42a.75.75 0 0 1-1.247-.606l.569-9.47a.75.75 0 0 1 .554-.679Z" clipRule="evenodd" />
                  </svg>
                  <span>Switch to Admin</span>
                </Link>
              )}

              <button
                onClick={() => {
                  setShowMore(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-3 rounded-2xl text-sm font-bold text-coral hover:bg-coral-light transition-all"
              >
                <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9a.75.75 0 0 1-1.5 0V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-snow border-t-[4px] border-navy">
        <div className="flex items-center justify-around py-2 px-2">
          {mainLinks.filter(isVisible).map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive
                    ? "text-navy bg-lime font-bold"
                    : "text-slate hover:text-navy"
                }`}
              >
                {link.icon}
                <span className="text-[10px] font-bold">{link.name}</span>
              </Link>
            );
          })}
          <button
            onClick={() => {
              const nextOpen = !showMore;
              if (nextOpen) openActiveMoreSection();
              setShowMore(nextOpen);
            }}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
              showMore ? "text-navy bg-lime font-bold" : "text-slate hover:text-navy"
            }`}
          >
            <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M4.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] font-bold">More</span>
            {(totalUnread > 0 || notifUnread > 0) && !showMore && (
              <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-coral border border-snow" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
