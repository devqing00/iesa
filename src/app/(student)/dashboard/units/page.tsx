"use client";

import Link from "next/link";
import React, { useState, useEffect, useCallback } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { usePermissions } from "@/context/PermissionsContext";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ── Types ─────────────────────────────────────────────── */

interface Membership {
  unitSlug: string;
  unitLabel: string;
  head: { userId: string; firstName: string; lastName: string; email: string; profilePhotoURL?: string } | null;
  memberCount: number;
  joinedAt?: string;
}

interface MemberNotice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdByName: string;
  createdAt: string;
}

interface MemberTask {
  id: string;
  title: string;
  description: string;
  assignedTo?: string;
  dueDate?: string;
  priority: string;
  status: string;
  createdByName: string;
  createdAt: string;
}

interface MemberUnitData {
  unitSlug: string;
  unitLabel: string;
  notices: MemberNotice[];
  tasks: MemberTask[];
}

/* ── Helpers ───────────────────────────────────────────── */

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return "";
  const now = Date.now();
  const then = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  pending: { dot: "bg-slate", label: "Pending" },
  in_progress: { dot: "bg-sunny", label: "In Progress" },
  done: { dot: "bg-teal", label: "Done" },
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-cloud text-slate",
  normal: "bg-lime-light text-navy",
  high: "bg-sunny text-navy",
  urgent: "bg-coral text-snow",
};

const UNIT_ACCENTS: Record<string, { bg: string; light: string }> = {
  press: { bg: "bg-coral", light: "bg-coral-light" },
  ics: { bg: "bg-lavender", light: "bg-lavender-light" },
  committee_academic: { bg: "bg-lavender", light: "bg-lavender-light" },
  committee_welfare: { bg: "bg-teal", light: "bg-teal-light" },
  committee_sports: { bg: "bg-lime", light: "bg-lime-light" },
  committee_socials: { bg: "bg-sunny", light: "bg-sunny-light" },
};

/* ── Static nav cards ──────────────────────────────────── */

const STATIC_CARDS = [
  {
    name: "Press",
    description: "The IESA Press ecosystem — write, edit, and publish articles for the association.",
    href: "/dashboard/press",
    accent: "bg-lavender",
    accentLight: "bg-lavender-light",
    rotation: "rotate-[-0.6deg]",
    anyPermission: ["press:access", "press:create", "press:edit", "press:publish"],
    icon: (
      <svg className="w-8 h-8 text-navy" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 0 0 3 3h15a3 3 0 0 1-3-3V4.875C17.25 3.839 16.41 3 15.375 3H4.125ZM12 9.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H12Zm-.75-2.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1-.75-.75ZM6 12.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5H6Zm-.75 3.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75ZM6 6.75a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75v-3A.75.75 0 0 0 9 6.75H6Z" clipRule="evenodd" />
        <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 0 1-3 0V6.75Z" />
      </svg>
    ),
  },
  {
    name: "Applications",
    description: "Apply for unit roles within IESA — press, committee positions, and more.",
    href: "/dashboard/applications",
    accent: "bg-coral",
    accentLight: "bg-coral-light",
    rotation: "rotate-[0.5deg]",
    anyPermission: null as string[] | null,
    icon: (
      <svg className="w-8 h-8 text-navy" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.583-.164 3.023 3.023 0 0 0-2.251 2.996Z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M2.25 13.5a3 3 0 0 0 3 3h1.228a3.375 3.375 0 0 1-.978-2.375v-9.75a3.375 3.375 0 0 1 3-3.357H13.5a3 3 0 0 1 3 3v1.107a3.375 3.375 0 0 1 .878 2.618v6.007a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-1.25Z" clipRule="evenodd" />
      </svg>
    ),
  },
];

/* ═══════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════ */

export default function UnitsPage() {
  const { hasPermission } = usePermissions();
  const { getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("units");

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [unitData, setUnitData] = useState<MemberUnitData[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(true);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);

  /* ── API helper ──────────────────────────────────────────── */
  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/unit-head${path}`), {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options?.headers || {}),
        },
      });
      if (!res.ok) return null;
      return res.json();
    },
    [getAccessToken],
  );

  /* ── Load memberships + unit data ────────────────────────── */
  useEffect(() => {
    async function load() {
      setLoadingMemberships(true);
      try {
        const data = await apiFetch("/my-memberships");
        const list: Membership[] = data || [];
        setMemberships(list);

        // Load member-view for each unit
        const views = await Promise.all(
          list.map(async (m) => {
            const view = await apiFetch(`/${m.unitSlug}/member-view`);
            return view as MemberUnitData | null;
          }),
        );
        setUnitData(views.filter(Boolean) as MemberUnitData[]);
      } catch {
        /* silently fail */
      } finally {
        setLoadingMemberships(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Update task status ──────────────────────────────────── */
  async function updateTaskStatus(unitSlug: string, taskId: string, status: string) {
    setUpdatingTask(taskId);
    try {
      await apiFetch(`/${unitSlug}/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      // Refresh unit data
      const view = await apiFetch(`/${unitSlug}/member-view`);
      if (view) {
        setUnitData((prev) => prev.map((d) => (d.unitSlug === unitSlug ? view : d)));
      }
    } catch {
      /* swallow */
    } finally {
      setUpdatingTask(null);
    }
  }

  /* ── Visible static nav cards ────────────────────────────── */
  const visibleCards = STATIC_CARDS.filter((u) => {
    if (!u.anyPermission) return true;
    return u.anyPermission.some((p: string) => hasPermission(p));
  });

  /* ── Collect all pending/in-progress tasks across units ──── */
  const allActiveTasks: (MemberTask & { unitSlug: string; unitLabel: string })[] = [];
  for (const ud of unitData) {
    for (const t of ud.tasks) {
      if (t.status !== "done") {
        allActiveTasks.push({ ...t, unitSlug: ud.unitSlug, unitLabel: ud.unitLabel });
      }
    }
  }

  /* ── Collect recent notices across units ─────────────────── */
  const allNotices: (MemberNotice & { unitSlug: string; unitLabel: string })[] = [];
  for (const ud of unitData) {
    for (const n of ud.notices) {
      allNotices.push({ ...n, unitSlug: ud.unitSlug, unitLabel: ud.unitLabel });
    }
  }
  allNotices.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <>
      <DashboardHeader />
      <ToolHelpModal toolId="units" isOpen={showHelp} onClose={closeHelp} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-display-lg text-navy">
              <span className="brush-highlight">Units</span>
            </h1>
            <p className="mt-2 text-slate text-body">
              IESA operational units — apply for roles or manage your unit work.
            </p>
          </div>
          <HelpButton onClick={openHelp} />
        </div>

        {/* ── My Memberships ──────────────────────────────── */}
        {memberships.length > 0 && (
          <section>
            <h2 className="font-display font-black text-xl text-navy mb-4">My Units</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {memberships.map((m) => {
                const accent = UNIT_ACCENTS[m.unitSlug] || { bg: "bg-teal", light: "bg-teal-light" };
                return (
                  <div
                    key={m.unitSlug}
                    className={`${accent.light} border-[3px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000]`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`w-3 h-3 rounded-full ${accent.bg}`} />
                      <h3 className="font-display font-black text-navy">{m.unitLabel}</h3>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <span className="bg-snow/80 text-navy font-bold px-2 py-1 rounded-lg">
                        {m.memberCount} member{m.memberCount !== 1 ? "s" : ""}
                      </span>
                      {m.head && (
                        <span className="bg-snow/80 text-navy font-bold px-2 py-1 rounded-lg">
                          Head: {m.head.firstName} {m.head.lastName}
                        </span>
                      )}
                      {m.joinedAt && (
                        <span className="text-slate">Joined {formatDate(m.joinedAt)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Active Tasks ────────────────────────────────── */}
        {allActiveTasks.length > 0 && (
          <section>
            <h2 className="font-display font-black text-xl text-navy mb-4">
              My Tasks <span className="text-sm font-bold text-slate ml-2">{allActiveTasks.length} active</span>
            </h2>
            <div className="space-y-3">
              {allActiveTasks.map((t) => {
                const s = STATUS_STYLES[t.status] || STATUS_STYLES.pending;
                const isUpdating = updatingTask === t.id;
                return (
                  <div
                    key={t.id}
                    className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-label-sm bg-ghost text-slate px-2 py-0.5 rounded-lg font-bold">
                            {t.unitLabel}
                          </span>
                          <span className={`text-label-sm px-2 py-0.5 rounded-lg font-bold ${PRIORITY_STYLES[t.priority]}`}>
                            {t.priority.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="font-display font-black text-navy">{t.title}</h4>
                        {t.description && <p className="text-sm text-slate mt-1">{t.description}</p>}
                        <p className="text-xs text-slate mt-2">
                          {t.dueDate ? `Due: ${formatDate(t.dueDate)}` : "No due date"} · {timeAgo(t.createdAt)}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center gap-1.5 text-label-sm px-2 py-0.5 rounded-lg font-bold bg-ghost`}>
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                        <select
                          value={t.status}
                          disabled={isUpdating}
                          onChange={(e) => updateTaskStatus(t.unitSlug, t.id, e.target.value)}
                          aria-label="Update task status"
                          className="text-xs bg-snow border-2 border-navy rounded-xl px-2 py-1 font-bold text-navy mt-1 disabled:opacity-50"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Noticeboard ─────────────────────────────────── */}
        {allNotices.length > 0 && (
          <section>
            <h2 className="font-display font-black text-xl text-navy mb-4">Unit Notices</h2>
            <div className="space-y-3">
              {allNotices.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-label-sm bg-ghost text-slate px-2 py-0.5 rounded-lg font-bold">
                          {n.unitLabel}
                        </span>
                        {n.isPinned && (
                          <span className="bg-coral text-snow text-label-sm px-2 py-0.5 rounded-lg font-bold">
                            PINNED
                          </span>
                        )}
                      </div>
                      <h4 className="font-display font-black text-navy">{n.title}</h4>
                      <p className="text-sm text-navy mt-1 whitespace-pre-line line-clamp-3">{n.content}</p>
                      <p className="text-xs text-slate mt-2">
                        {n.createdByName} · {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Loading indicator for memberships ───────────── */}
        {loadingMemberships && memberships.length === 0 && (
          <div className="flex items-center gap-3 py-6">
            <div className="w-5 h-5 border-[3px] border-lime border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate">Loading your unit memberships...</span>
          </div>
        )}

        {/* ── Quick‑access cards ──────────────────────────── */}
        <section>
          <h2 className="font-display font-black text-xl text-navy mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {visibleCards.map((unit) => (
              <Link
                key={unit.name}
                href={unit.href}
                className={`group bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] ${unit.rotation} hover:rotate-0 transition-transform`}
              >
                <div className={`w-14 h-14 ${unit.accentLight} rounded-2xl flex items-center justify-center mb-4 border-[3px] border-navy group-hover:scale-105 transition-transform`}>
                  {unit.icon}
                </div>
                <h3 className="font-display font-black text-xl text-navy mb-1">{unit.name}</h3>
                <p className="text-sm text-slate leading-relaxed">{unit.description}</p>
                <div className="mt-4 flex items-center gap-2 text-navy font-display font-bold text-sm">
                  Open
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>

          {visibleCards.length === 0 && memberships.length === 0 && !loadingMemberships && (
            <div className="bg-snow border-[3px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
              <p className="font-display font-black text-xl text-navy mb-2">No units available</p>
              <p className="text-sm text-slate">You don&apos;t have access to any units yet. Apply or check back later.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
