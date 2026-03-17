"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { usePermissions } from "@/context/PermissionsContext";
import { useDM } from "@/context/DMContext";
import { useNotificationCount } from "@/hooks/useNotificationCount";
import { prefetchRoute } from "@/hooks/useData";
import { isExternalStudent, EXTERNAL_HIDDEN_HREFS, hasAdminAccess, isRouteAllowedForExternal } from "@/lib/studentAccess";
import SignOutConfirmModal from "@/components/ui/SignOutConfirmModal";

/* ─── Nav Group Definitions ────────────────────────────────────── */

interface NavLink {
  name: string;
  href: string;
  icon: React.ReactNode;
  /** If set, link is only visible to users with at least one of these permissions or admin/exco role */
  anyPermission?: string[];
}

interface NavGroup {
  label: string;
  accentColor: string; // dot color for group header
  links: NavLink[];
}

const navGroups: NavGroup[] = [
  {
    label: "Main",
    accentColor: "bg-lime",
    links: [
      {
        name: "Overview",
        href: "/dashboard",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6ZM15.75 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-2.25ZM6 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3H6ZM15.75 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3h-2.25Z" />
          </svg>
        ),
      },
      {
        name: "Events",
        href: "/dashboard/events",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        name: "Announcements",
        href: "/dashboard/announcements",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Academic",
    accentColor: "bg-lavender",
    links: [
      {
        name: "Resources",
        href: "/dashboard/resources",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
          </svg>
        ),
      },
      {
        name: "Timetable",
        href: "/dashboard/timetable",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        name: "Cohort Portal",
        href: "/dashboard/cohort",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        name: "Growth Hub",
        href: "/dashboard/growth",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M15.22 6.268a.75.75 0 0 1 .968-.431l5.942 2.28a.75.75 0 0 1 .431.97l-2.28 5.94a.75.75 0 1 1-1.4-.537l1.63-4.251-1.086.484a11.2 11.2 0 0 0-5.45 5.174.75.75 0 0 1-1.199.19L9 12.312l-6.22 6.22a.75.75 0 0 1-1.06-1.061l6.75-6.75a.75.75 0 0 1 1.06 0l3.606 3.606a12.695 12.695 0 0 1 5.68-4.974l1.086-.483-4.251-1.632a.75.75 0 0 1-.432-.969Z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        name: "Hubs",
        href: "/dashboard/hubs",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        name: "Teams",
        href: "/dashboard/teams",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.583-.164 3.023 3.023 0 0 0-2.251 2.996Z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M2.25 13.5a3 3 0 0 0 3 3h1.228a3.375 3.375 0 0 1-.978-2.375v-9.75a3.375 3.375 0 0 1 3-3.357H13.5a3 3 0 0 1 3 3v1.107a3.375 3.375 0 0 1 .878 2.618v6.007a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-1.25Z" clipRule="evenodd" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Leadership",
    accentColor: "bg-sunny",
    links: [
      {
        name: "Freshers",
        href: "/dashboard/freshers",
        anyPermission: ["freshers:manage"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122Z" />
          </svg>
        ),
      },
      {
        name: "Class Rep",
        href: "/dashboard/class-rep",
        anyPermission: ["class_rep:view_cohort"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.173v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
            <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.711 47.87 47.87 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.87 47.87 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286a48.4 48.4 0 0 1 6.862 2.977l.895.474.896-.474c.26-.138.525-.27.79-.4Z" />
          </svg>
        ),
      },
      {
        name: "Team Head",
        href: "/dashboard/team-head",
        anyPermission: ["team_head:view_members"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12a4.125 4.125 0 1 0 0-8.25 4.125 4.125 0 0 0 0 8.25Z" />
            <path d="M4.5 20.25a7.5 7.5 0 0 1 15 0 .75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75Z" />
            <path d="M9.186 2.25a.75.75 0 0 1 .632.346L12 5.972l2.182-3.376a.75.75 0 0 1 1.34.064l.87 2.61 2.747-.01a.75.75 0 0 1 .458 1.344l-2.214 1.716.85 2.618a.75.75 0 0 1-1.154.84L12 9.98l-5.079 3.797a.75.75 0 0 1-1.154-.84l.85-2.618-2.214-1.716a.75.75 0 0 1 .458-1.344l2.747.01.87-2.61a.75.75 0 0 1 .708-.51Z" />
          </svg>
        ),
      },
      {
        name: "TIMP Lead",
        href: "/dashboard/timp/manage",
        anyPermission: ["timp:manage"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.478 2.559a.75.75 0 0 1 .822-.12l16.5 7.5a.75.75 0 0 1 0 1.362l-16.5 7.5A.75.75 0 0 1 3.25 18v-4.2l7.5-1.8-7.5-1.8V3.18a.75.75 0 0 1 .228-.621Z" />
          </svg>
        ),
      },
      {
        name: "IEPOD Admin",
        href: "/dashboard/iepod/manage",
        anyPermission: ["iepod:manage", "iepod:view"],
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Personal",
    accentColor: "bg-coral",
    links: [
      {
        name: "Payments",
        href: "/dashboard/payments",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" />
            <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
          </svg>
        ),
      },

      {
        name: "Profile",
        href: "/dashboard/profile",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        name: "Settings",
        href: "/dashboard/settings",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        name: "IESA AI",
        href: "/dashboard/iesa-ai",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5Z" clipRule="evenodd" />
          </svg>
        ),
      },
      {
        name: "Messages",
        href: "/dashboard/messages",
        icon: (
          <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-2.234a4.75 4.75 0 0 1-1.087-3.275V10.66a4.795 4.795 0 0 1 0-7.893Z" />
            <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
          </svg>
        ),
      },
    ],
  },
];

/* ─── Sidebar Component ────────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut, userProfile } = useAuth();
  const { isExpanded, toggleSidebar, closeSidebar } = useSidebar();
  const { hasPermission, permissions, loaded: permissionsLoaded } = usePermissions();
  const { totalUnread } = useDM();
  const { unreadCount: notifUnread } = useNotificationCount();
  const [manualOpenGroup, setManualOpenGroup] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const external = isExternalStudent(userProfile?.department);
  const isClassRepOrAssistant = permissionsLoaded && hasPermission("class_rep:view_cohort");

  const visibleGroups = useMemo(
    () => navGroups
      .map((group) => ({
        ...group,
        links: group.links.filter((link) => {
          if (link.href === "/dashboard/freshers" && userProfile?.role === "admin") return false;
          if (link.href === "/dashboard/cohort" && !permissionsLoaded) return false;
          if (link.href === "/dashboard/cohort" && isClassRepOrAssistant) return false;
          if (external && EXTERNAL_HIDDEN_HREFS.has(link.href)) return false;
          if (external && link.href.startsWith("/dashboard") && !isRouteAllowedForExternal(link.href)) return false;
          if (!link.anyPermission) return true;
          return link.anyPermission.some((p) => hasPermission(p));
        }),
      }))
      .filter((group) => group.links.length > 0),
    [external, hasPermission, isClassRepOrAssistant, permissionsLoaded, userProfile?.role],
  );

  const activeGroupLabel = useMemo(
    () => visibleGroups.find((group) =>
      group.links.some((link) =>
        link.href === "/dashboard"
          ? pathname === "/dashboard"
          : pathname === link.href || pathname.startsWith(`${link.href}/`),
      ),
    )?.label ?? null,
    [pathname, visibleGroups],
  );
  const openGroup = manualOpenGroup ?? activeGroupLabel ?? visibleGroups[0]?.label ?? null;

  const handleConfirmSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setShowSignOutConfirm(false);
    }
  };

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
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center overflow-hidden">
              <Image src="/assets/images/logo.svg" alt="IESA Logo" width={28} height={28} className="object-contain" />
            </div>
            {isExpanded && (
              <div className="min-w-0 overflow-hidden">
                <h1 className="font-display font-black text-lg text-navy leading-tight">IESA</h1>
                <p className="text-[10px] font-bold text-slate tracking-wide uppercase">Student Portal</p>
              </div>
            )}
          </Link>
        </div>

        {/* Collapse/Expand Toggle — positioned on sidebar edge */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-[14px] top-[54px] w-7 h-7 rounded-full bg-snow border-[3px] border-navy flex items-center justify-center press-2 press-black hover:bg-ghost transition-all z-50"
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
        <nav aria-label="Dashboard navigation" className="flex-1 overflow-y-auto px-2.5 space-y-4 scrollbar-thin">
          {visibleGroups.map((group) => {
            const isOpen = openGroup === group.label;

            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => setManualOpenGroup(isOpen ? null : group.label)}
                  className={`w-full rounded-xl transition-colors ${isExpanded ? "px-2 pt-1 pb-1.5" : "py-1"}`}
                  aria-label={`${group.label} section`}
                >
                  {isExpanded ? (
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${group.accentColor}`} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">{group.label}</span>
                      <svg
                        className={`ml-auto w-3.5 h-3.5 text-slate transition-transform ${isOpen ? "rotate-180" : ""}`}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <span className={`w-5 h-[2px] rounded-full ${group.accentColor}`} />
                      <svg
                        className={`w-3 h-3 text-slate transition-transform ${isOpen ? "rotate-180" : ""}`}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>

                {isOpen && (
                  <div className="space-y-0.5">
                    {group.links.map((link) => {
                      const isActive =
                        link.href === "/dashboard"
                          ? pathname === "/dashboard"
                          : pathname === link.href || pathname.startsWith(`${link.href}/`);

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          title={!isExpanded ? link.name : undefined}
                          onMouseEnter={() => prefetchRoute(link.href)}
                          className={`relative flex items-center gap-3 rounded-xl transition-all text-sm ${
                            isExpanded ? "px-3 py-2.5" : "justify-center px-2 py-2.5"
                          } ${
                            isActive
                              ? "bg-lime text-navy font-bold border-[3px] border-navy shadow-[3px_3px_0_0_#000]"
                              : "text-navy/50 hover:bg-ghost hover:text-navy font-medium"
                          }`}
                        >
                          <span className={isActive ? "text-navy" : ""}>{link.icon}</span>
                          {isExpanded && <span className="truncate">{link.name}</span>}
                          {isExpanded && link.href === "/dashboard/messages" && totalUnread > 0 && (
                            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-coral text-snow text-[10px] font-black flex items-center justify-center">
                              {totalUnread > 9 ? "9+" : totalUnread}
                            </span>
                          )}
                          {!isExpanded && link.href === "/dashboard/messages" && totalUnread > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral border border-snow" />
                          )}
                          {isExpanded && link.href === "/dashboard/announcements" && notifUnread > 0 && (
                            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-coral text-snow text-[10px] font-black flex items-center justify-center">
                              {notifUnread > 9 ? "9+" : notifUnread}
                            </span>
                          )}
                          {!isExpanded && link.href === "/dashboard/announcements" && notifUnread > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral border border-snow" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Ecosystem Switch — show for users with admin access (role or permissions) */}
        {userProfile && hasAdminAccess(userProfile.role, permissions) && (
          <div className="p-2.5">
            <Link
              href="/admin/dashboard"
              title={!isExpanded ? "Switch to Admin" : undefined}
              className={`w-full flex items-center gap-3 rounded-xl text-lavender hover:bg-lavender-light border-[2px] border-transparent hover:border-lavender transition-all text-sm font-bold ${
                isExpanded ? "px-3 py-2.5" : "justify-center px-2 py-2.5"
              }`}
            >
              <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 1.5a.75.75 0 0 1 .75.75V4.5a.75.75 0 0 1-1.5 0V2.25A.75.75 0 0 1 12 1.5ZM5.636 4.136a.75.75 0 0 1 1.06 0l1.592 1.591a.75.75 0 0 1-1.061 1.06l-1.591-1.59a.75.75 0 0 1 0-1.061Zm12.728 0a.75.75 0 0 1 0 1.06l-1.591 1.592a.75.75 0 0 1-1.06-1.061l1.59-1.591a.75.75 0 0 1 1.061 0Zm-6.816 4.496a.75.75 0 0 1 .82.311l5.228 7.917a.75.75 0 0 1-.777 1.148l-2.097-.43 1.045 3.9a.75.75 0 0 1-1.45.388l-1.044-3.899-1.601 1.42a.75.75 0 0 1-1.247-.606l.569-9.47a.75.75 0 0 1 .554-.679Z" clipRule="evenodd" />
              </svg>
              {isExpanded && <span>Switch to Admin</span>}
            </Link>
          </div>
        )}

        {/* Sign Out */}
        <div className="p-2.5 mt-auto">
          <button
            onClick={() => setShowSignOutConfirm(true)}
            title={!isExpanded ? "Sign Out" : undefined}
            className={`w-full flex items-center gap-3 rounded-xl text-coral hover:bg-coral-light border-[2px] border-transparent hover:border-coral transition-all text-sm font-bold ${
              isExpanded ? "px-3 py-2.5" : "justify-center px-2 py-2.5"
            }`}
          >
            <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9a.75.75 0 0 1-1.5 0V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
            {isExpanded && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <SignOutConfirmModal
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={handleConfirmSignOut}
        isLoading={signingOut}
      />

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
