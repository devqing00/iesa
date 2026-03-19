"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { getApiUrl } from "@/lib/api";
import { withAuth } from "@/lib/withAuth";
import { buildMessagesHref } from "@/lib/messaging";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { toast } from "sonner";
import { resolveProfileImageUrl } from "@/lib/profileImage";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface HeadedUnit {
  unitSlug: string;
  unitLabel: string;
  isCustom: boolean;
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber?: string;
  level?: string;
  subTeam?: string | null;
  phone?: string;
  profilePhotoURL?: string;
  profilePictureUrl?: string;
  joinedAt?: string;
}

interface Notice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdByName: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo?: string;
  assignedToName: string;
  dueDate?: string;
  priority: string;
  status: string;
  createdByName: string;
  createdAt: string;
}

interface TeamApplicationItem {
  id: string;
  userName: string;
  userEmail: string;
  userLevel?: string | null;
  team: string;
  teamLabel: string;
  motivation: string;
  skills?: string | null;
  subTeam?: string | null;
  status: "pending" | "accepted" | "rejected" | "revoked";
  feedback?: string | null;
  createdAt: string;
}

type Tab = "overview" | "members" | "applications" | "noticeboard" | "tasks" | "analytics" | "announce";

/* ── Analytics types ────────────────────────────────────── */
interface MemberStat {
  userId: string;
  name: string;
  profilePhotoURL?: string;
  profilePictureUrl?: string;
  totalTasks: number;
  doneTasks: number;
  completionRate: number;
}

interface UnitAnalytics {
  unitSlug: string;
  unitLabel: string;
  memberCount: number;
  taskStats: {
    total: number;
    pending: number;
    in_progress: number;
    done: number;
    completionRate: number;
  };
  priorityBreakdown: Record<string, number>;
  overdueCount: number;
  noticeStats: { total: number; pinned: number };
  memberStats: MemberStat[];
  recentActivity: {
    tasks: Array<Record<string, unknown>>;
    notices: Array<Record<string, unknown>>;
  };
}

/* ═══════════════════════════════════════════════════════════
   Tab definitions
   ═══════════════════════════════════════════════════════════ */

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Overview",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6ZM15.75 3a3 3 0 0 0-3 3v2.25a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-2.25ZM6 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h2.25a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3H6ZM15.75 12.75a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3H18a3 3 0 0 0 3-3v-2.25a3 3 0 0 0-3-3h-2.25Z" />
      </svg>
    ),
  },
  {
    key: "members",
    label: "Members",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    key: "applications",
    label: "Applications",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M6.75 3.75A2.25 2.25 0 0 0 4.5 6v12a2.25 2.25 0 0 0 2.25 2.25h10.5A2.25 2.25 0 0 0 19.5 18V9.878a2.25 2.25 0 0 0-.659-1.591l-3.128-3.128a2.25 2.25 0 0 0-1.591-.659H6.75Zm6 2.56v2.94A1.5 1.5 0 0 0 14.25 10.75h2.94l-4.44-4.44ZM8.25 13a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H9A.75.75 0 0 1 8.25 13Zm0 3a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5H9A.75.75 0 0 1 8.25 16Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "noticeboard",
    label: "Noticeboard",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.881 4.345A23.112 23.112 0 0 1 8.25 6H7.5a5.25 5.25 0 0 0-.88 10.427 21.593 21.593 0 0 0 1.378 3.94c.464 1.004 1.674 1.32 2.582.796l.657-.379c.88-.508 1.165-1.593.772-2.468a17.116 17.116 0 0 1-.628-1.607c1.918.258 3.76.75 5.5 1.446A21.727 21.727 0 0 0 18 11.25c0-2.414-.393-4.735-1.119-6.905Z" />
      </svg>
    ),
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.672 0C8.539 3.297 7.502 4.603 7.502 6ZM3.75 9.375a1.875 1.875 0 0 1 1.875-1.875h9.75a1.875 1.875 0 0 1 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3.75 20.625V9.375Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z" />
      </svg>
    ),
  },
  {
    key: "announce",
    label: "Announce",
    icon: (
      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.25 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM2.25 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122Z" />
      </svg>
    ),
  },
];

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

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-cloud text-slate",
  normal: "bg-lime-light text-navy",
  high: "bg-sunny text-navy",
  urgent: "bg-coral text-snow",
};

const STATUS_STYLES: Record<string, { bg: string; dot: string; label: string }> = {
  pending: { bg: "bg-cloud", dot: "bg-slate", label: "Pending" },
  in_progress: { bg: "bg-sunny-light", dot: "bg-sunny", label: "In Progress" },
  done: { bg: "bg-teal-light", dot: "bg-teal", label: "Done" },
};

/* ═══════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════ */

export function TeamHeadPortal() {
  const { getAccessToken } = useAuth();
  const { hasPermission } = usePermissions();
  const { showHelp, openHelp, closeHelp } = useToolHelp("team-head-portal");
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── unit selector ───────────────────────────────────────── */
  const [headedUnits, setHeadedUnits] = useState<HeadedUnit[]>([]);
  const [activeUnit, setActiveUnit] = useState<HeadedUnit | null>(null);

  /* ── data state ──────────────────────────────────────────── */
  const [members, setMembers] = useState<Member[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [applications, setApplications] = useState<TeamApplicationItem[]>([]);
  const [appLoading, setAppLoading] = useState(false);
  const [appStatusFilter, setAppStatusFilter] = useState<string>("pending");
  const [memberSearch, setMemberSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState<string>("");

  /* ── analytics ────────────────────────────────────────────── */
  const [analytics, setAnalytics] = useState<UnitAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  /* ── form states ─────────────────────────────────────────── */
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Notice form
  const [nTitle, setNTitle] = useState("");
  const [nContent, setNContent] = useState("");
  const [nPinned, setNPinned] = useState(false);

  // Task form
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tAssignee, setTAssignee] = useState("");
  const [tDue, setTDue] = useState("");
  const [tPriority, setTPriority] = useState("normal");

  // Announce form
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annPriority, setAnnPriority] = useState("normal");

  /* ── API helper ──────────────────────────────────────────── */
  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/team-head${path}`), {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options?.headers || {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `API error ${res.status}`);
      }
      return res.json();
    },
    [getAccessToken],
  );

  /* ── data loaders ────────────────────────────────────────── */
  const loadMembers = useCallback(
    async (slug: string) => {
      const data = await apiFetch(`/${slug}/members`);
      setMembers(data.members);
    },
    [apiFetch],
  );

  const loadNotices = useCallback(
    async (slug: string) => {
      const data = await apiFetch(`/${slug}/noticeboard`);
      setNotices(data.posts);
    },
    [apiFetch],
  );

  const loadTasks = useCallback(
    async (slug: string) => {
      const qp = taskFilter ? `?status=${taskFilter}` : "";
      const data = await apiFetch(`/${slug}/tasks${qp}`);
      setTasks(data.tasks);
    },
    [apiFetch, taskFilter],
  );

  const loadAnalytics = useCallback(
    async (slug: string) => {
      setAnalyticsLoading(true);
      try {
        const data = await apiFetch(`/${slug}/analytics`);
        setAnalytics(data);
      } catch {
        /* swallow */
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [apiFetch],
  );

  const loadApplications = useCallback(
    async (slug: string) => {
      setAppLoading(true);
      try {
        const token = await getAccessToken();
        const query = new URLSearchParams({ unit: slug, limit: "100" });
        if (appStatusFilter && appStatusFilter !== "all") {
          query.set("status", appStatusFilter);
        }
        const res = await fetch(
          getApiUrl(`/api/v1/team-applications/?${query.toString()}`),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (!res.ok) throw new Error("Failed to load applications");
        const data = await res.json();
        setApplications(Array.isArray(data?.items) ? data.items : []);
      } finally {
        setAppLoading(false);
      }
    },
    [appStatusFilter, getAccessToken],
  );

  /* ── initial load ────────────────────────────────────────── */
  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const units: HeadedUnit[] = await apiFetch("/my-teams");
        setHeadedUnits(units);
        if (units.length > 0) {
          setActiveUnit(units[0]);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── load data when unit or tab changes ──────────────────── */
  useEffect(() => {
    if (!activeUnit || loading) return;
    const slug = activeUnit.unitSlug;
    if (tab === "overview" || tab === "members") loadMembers(slug).catch(() => {});
    if (tab === "applications") loadApplications(slug).catch(() => {});
    if (tab === "overview" || tab === "noticeboard") loadNotices(slug).catch(() => {});
    if (tab === "overview" || tab === "tasks") loadTasks(slug).catch(() => {});
    if (tab === "analytics") loadAnalytics(slug).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUnit, tab]);

  /* ── reload tasks when filter changes ────────────────────── */
  useEffect(() => {
    if (!activeUnit || tab !== "tasks") return;
    loadTasks(activeUnit.unitSlug).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskFilter]);

  useEffect(() => {
    if (!activeUnit || tab !== "applications") return;
    loadApplications(activeUnit.unitSlug).catch(() => {});
  }, [activeUnit, tab, appStatusFilter, loadApplications]);

  /* ── actions ─────────────────────────────────────────────── */
  async function createNotice() {
    if (!activeUnit) return;
    setFormLoading(true);
    try {
      await apiFetch(`/${activeUnit.unitSlug}/noticeboard`, {
        method: "POST",
        body: JSON.stringify({ title: nTitle, content: nContent, isPinned: nPinned }),
      });
      setNTitle("");
      setNContent("");
      setNPinned(false);
      setShowNoticeForm(false);
      await loadNotices(activeUnit.unitSlug);
      toast.success("Notice created");
    } catch {
      toast.error("Failed to create notice");
    } finally {
      setFormLoading(false);
    }
  }

  async function deleteNotice(id: string) {
    if (!activeUnit) return;
    await apiFetch(`/${activeUnit.unitSlug}/noticeboard/${id}`, { method: "DELETE" });
    await loadNotices(activeUnit.unitSlug);
  }

  async function togglePinNotice(id: string, currentPinned: boolean) {
    if (!activeUnit) return;
    await apiFetch(`/${activeUnit.unitSlug}/noticeboard/${id}`, {
      method: "PUT",
      body: JSON.stringify({ isPinned: !currentPinned }),
    });
    await loadNotices(activeUnit.unitSlug);
  }

  async function createTask() {
    if (!activeUnit) return;
    setFormLoading(true);
    try {
      await apiFetch(`/${activeUnit.unitSlug}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: tTitle,
          description: tDesc,
          assignedTo: tAssignee || null,
          dueDate: tDue || null,
          priority: tPriority,
        }),
      });
      setTTitle("");
      setTDesc("");
      setTAssignee("");
      setTDue("");
      setTPriority("normal");
      setShowTaskForm(false);
      await loadTasks(activeUnit.unitSlug);
      toast.success("Task created");
    } catch {
      toast.error("Failed to create task");
    } finally {
      setFormLoading(false);
    }
  }

  async function updateTaskStatus(taskId: string, status: string) {
    if (!activeUnit) return;
    await apiFetch(`/${activeUnit.unitSlug}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadTasks(activeUnit.unitSlug);
  }

  async function deleteTask(id: string) {
    if (!activeUnit) return;
    await apiFetch(`/${activeUnit.unitSlug}/tasks/${id}`, { method: "DELETE" });
    await loadTasks(activeUnit.unitSlug);
  }

  async function sendAnnouncement() {
    if (!activeUnit) return;
    setFormLoading(true);
    try {
      const data = await apiFetch(`/${activeUnit.unitSlug}/announce`, {
        method: "POST",
        body: JSON.stringify({ title: annTitle, content: annContent, priority: annPriority }),
      });
      setAnnTitle("");
      setAnnContent("");
      setAnnPriority("normal");
      toast.success(data.message || "Announcement sent!");
    } catch {
      toast.error("Failed to send announcement");
    } finally {
      setFormLoading(false);
    }
  }

  async function reviewApplication(applicationId: string, status: "accepted" | "rejected") {
    if (!activeUnit) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(
        getApiUrl(`/api/v1/team-applications/${applicationId}/review`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) {
        throw new Error("Review failed");
      }
      toast.success(`Application ${status === "accepted" ? "accepted" : "rejected"}`);
      await loadApplications(activeUnit.unitSlug);
    } catch {
      toast.error("Could not review application");
    }
  }

  /* ── permission gates ────────────────────────────────────── */
  const canViewMembers = hasPermission("team_head:view_members");
  const canManageNoticeboard = hasPermission("team_head:manage_noticeboard");
  const canManageTasks = hasPermission("team_head:manage_tasks");
  const canAnnounce = hasPermission("team_head:announce");

  /* ── filtered members ────────────────────────────────────── */
  const filteredMembers = members.filter((m) => {
    if (!memberSearch) return true;
    const q = memberSearch.toLowerCase();
    return (
      m.firstName.toLowerCase().includes(q) ||
      m.lastName.toLowerCase().includes(q) ||
      (m.matricNumber || "").toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */

  if (!canViewMembers && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-snow border-4 border-navy rounded-3xl p-10 shadow-[8px_8px_0_0_#000] text-center max-w-md">
          <h2 className="font-display font-black text-display-md text-navy mb-2">Access Denied</h2>
          <p className="text-slate">You need a Team Head role to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-lime border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-coral-light border-4 border-navy rounded-3xl p-10 shadow-[8px_8px_0_0_#000] text-center max-w-md">
          <h2 className="font-display font-black text-display-md text-navy mb-2">Error</h2>
          <p className="text-navy">{error}</p>
        </div>
      </div>
    );
  }

  if (headedUnits.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-sunny-light border-4 border-navy rounded-3xl p-10 shadow-[8px_8px_0_0_#000] text-center max-w-md">
          <h2 className="font-display font-black text-display-md text-navy mb-2">No Teams</h2>
          <p className="text-slate">You don&apos;t head any teams this session.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ░░░ Header ░░░ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-label text-slate">TEAM HEAD PORTAL</p>
          <h1 className="font-display font-black text-display-lg text-navy">
            <span className="brush-highlight">{activeUnit?.unitLabel}</span> Dashboard
          </h1>
          <p className="text-sm text-navy-muted mt-1">Team operations, applications, tasks, and member coordination.</p>
        </div>
        <HelpButton onClick={openHelp} />

        {/* Unit selector (if heads > 1 unit) */}
        {headedUnits.length > 1 && (
          <select
            value={activeUnit?.unitSlug || ""}
            onChange={(e) => {
              const u = headedUnits.find((h) => h.unitSlug === e.target.value) || null;
              setActiveUnit(u);
            }}
            aria-label="Select team"
            className="bg-snow border-[3px] border-navy rounded-2xl px-3 py-2 font-bold text-sm text-navy shadow-[3px_3px_0_0_#000]"
          >
            {headedUnits.map((u) => (
              <option key={u.unitSlug} value={u.unitSlug}>
                {u.unitLabel}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ░░░ Tabs ░░░ */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border-[3px] ${
              tab === t.key
                ? "bg-lime text-navy border-navy shadow-[3px_3px_0_0_#000]"
                : "bg-snow text-slate border-transparent hover:border-navy hover:text-navy"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ░░░ Tab Content ░░░ */}

      {/* ── OVERVIEW ──────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-teal border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <p className="text-label-sm text-navy-muted">MEMBERS</p>
              <p className="font-display font-black text-display-md text-navy">{members.length}</p>
            </div>
            <div className="bg-lavender border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <p className="text-label-sm text-navy-muted">NOTICES</p>
              <p className="font-display font-black text-display-md text-navy">{notices.length}</p>
            </div>
            <div className="bg-sunny border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <p className="text-label-sm text-navy-muted">PENDING TASKS</p>
              <p className="font-display font-black text-display-md text-navy">
                {tasks.filter((t) => t.status !== "done").length}
              </p>
            </div>
          </div>

          {/* Recent notices */}
          {notices.length > 0 && (
            <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <h3 className="font-display font-black text-lg text-navy mb-4">Latest Notices</h3>
              <div className="space-y-3">
                {notices.slice(0, 3).map((n) => (
                  <div key={n.id} className="flex items-start gap-3 py-2 border-b border-cloud last:border-0">
                    {n.isPinned && (
                      <span className="inline-block bg-coral text-snow text-label-sm px-2 py-0.5 rounded-lg font-bold mt-0.5">
                        PINNED
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-navy truncate">{n.title}</p>
                      <p className="text-sm text-slate truncate">{n.content}</p>
                    </div>
                    <span className="text-xs text-slate whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent tasks */}
          {tasks.length > 0 && (
            <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
              <h3 className="font-display font-black text-lg text-navy mb-4">Active Tasks</h3>
              <div className="space-y-3">
                {tasks
                  .filter((t) => t.status !== "done")
                  .slice(0, 5)
                  .map((t) => {
                    const s = STATUS_STYLES[t.status] || STATUS_STYLES.pending;
                    return (
                      <div key={t.id} className="flex items-center gap-3 py-2 border-b border-cloud last:border-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-navy truncate">{t.title}</p>
                          <p className="text-xs text-slate">
                            {t.assignedToName} · {t.dueDate ? formatDate(t.dueDate) : "No due date"}
                          </p>
                        </div>
                        <span className={`text-label-sm px-2 py-0.5 rounded-lg font-bold ${PRIORITY_STYLES[t.priority]}`}>
                          {t.priority.toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MEMBERS ───────────────────────────────────────── */}
      {tab === "members" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search members..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="flex-1 bg-snow border-[3px] border-navy rounded-2xl px-4 py-2.5 text-sm text-navy placeholder:text-slate/60 shadow-[3px_3px_0_0_#000]"
            />
            <span className="text-sm font-bold text-slate self-center">{filteredMembers.length} member(s)</span>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="bg-ghost border-4 border-navy rounded-3xl p-10 text-center shadow-[8px_8px_0_0_#000]">
              <p className="text-slate">{members.length === 0 ? "No members yet." : "No members match your search."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMembers.map((m) => (
                <div
                  key={m.id}
                  className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000] flex items-start gap-4"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl bg-lime border-[3px] border-navy flex items-center justify-center font-display font-black text-navy text-lg shrink-0 overflow-hidden">
                    {resolveProfileImageUrl(m) ? (
                      <Image
                        src={resolveProfileImageUrl(m)!}
                        alt=""
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      `${m.firstName?.[0] || ""}${m.lastName?.[0] || ""}`
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-navy truncate">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-slate truncate">{m.email}</p>
                    {m.matricNumber && (
                      <p className="text-xs text-slate">{m.matricNumber}</p>
                    )}
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {m.level && (
                        <span className="text-label-sm bg-lavender-light text-navy px-2 py-0.5 rounded-lg font-bold">
                          {m.level}
                        </span>
                      )}
                      {m.subTeam && (
                        <span className="text-label-sm bg-sunny-light text-navy px-2 py-0.5 rounded-lg font-bold">
                          {m.subTeam}
                        </span>
                      )}
                      <Link
                        href={buildMessagesHref({
                          userId: m.id,
                          userName: `${m.firstName} ${m.lastName}`,
                          userEmail: m.email,
                          context: "team_head_members",
                          contextId: activeUnit?.unitSlug,
                          contextLabel: activeUnit?.unitLabel,
                        })}
                        className="text-label-sm bg-lime border-2 border-navy px-2 py-0.5 rounded-lg font-bold text-navy press-1 press-navy"
                      >
                        Message
                      </Link>
                      {m.joinedAt && (
                        <span className="text-label-sm text-slate">Joined {formatDate(m.joinedAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── APPLICATIONS ───────────────────────────────────── */}
      {tab === "applications" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "accepted", label: "Accepted" },
              { key: "rejected", label: "Rejected" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setAppStatusFilter(opt.key)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                  appStatusFilter === opt.key
                    ? "bg-lime text-navy border-navy"
                    : "bg-snow text-slate border-transparent hover:border-navy hover:text-navy"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {appLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
            </div>
          ) : applications.length === 0 ? (
            <div className="bg-ghost border-4 border-navy rounded-3xl p-10 text-center shadow-[8px_8px_0_0_#000]">
              <p className="text-slate">No applications found for this filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <article
                  key={app.id}
                  className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-display font-black text-navy">
                          {app.userName}
                        </h4>
                        <span className="text-label-sm bg-lavender-light text-navy px-2 py-0.5 rounded-lg font-bold">
                          {app.userLevel || "—"}
                        </span>
                        <span className={`text-label-sm px-2 py-0.5 rounded-lg font-bold ${
                          app.status === "pending"
                            ? "bg-sunny-light text-navy"
                            : app.status === "accepted"
                              ? "bg-teal-light text-teal"
                              : "bg-coral-light text-coral"
                        }`}>
                          {app.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate mt-1">{app.userEmail}</p>
                      {app.subTeam && (
                        <p className="text-xs text-navy mt-2">
                          <span className="font-bold">Sub-team:</span> {app.subTeam}
                        </p>
                      )}
                      <p className="text-sm text-navy mt-2.5 whitespace-pre-line">{app.motivation}</p>
                      {app.skills && (
                        <p className="text-xs text-slate mt-2"><span className="font-bold">Skills:</span> {app.skills}</p>
                      )}
                      {app.feedback && app.status !== "pending" && (
                        <p className="text-xs text-navy-muted mt-2"><span className="font-bold">Review note:</span> {app.feedback}</p>
                      )}
                      <p className="text-xs text-slate mt-2">Applied {timeAgo(app.createdAt)}</p>
                    </div>

                    {app.status === "pending" && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => reviewApplication(app.id, "accepted")}
                          className="bg-teal border-2 border-navy press-2 press-navy px-3 py-1.5 rounded-xl text-xs font-bold text-navy"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => reviewApplication(app.id, "rejected")}
                          className="bg-coral-light border-2 border-navy press-2 press-black px-3 py-1.5 rounded-xl text-xs font-bold text-navy"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NOTICEBOARD ───────────────────────────────────── */}
      {tab === "noticeboard" && (
        <div className="space-y-4">
          {canManageNoticeboard && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowNoticeForm((p) => !p)}
                className="bg-lime border-[3px] border-navy press-3 press-navy px-5 py-2.5 rounded-2xl font-bold text-sm text-navy"
              >
                {showNoticeForm ? "Cancel" : "+ New Post"}
              </button>
            </div>
          )}

          {/* Create form */}
          {showNoticeForm && (
            <div className="bg-lime-light border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
              <h3 className="font-display font-black text-lg text-navy">New Notice</h3>
              <input
                type="text"
                placeholder="Title"
                value={nTitle}
                onChange={(e) => setNTitle(e.target.value)}
                className="w-full bg-snow border-[3px] border-navy rounded-2xl px-4 py-2.5 text-sm text-navy"
              />
              <textarea
                placeholder="Content..."
                value={nContent}
                onChange={(e) => setNContent(e.target.value)}
                rows={4}
                className="w-full bg-snow border-[3px] border-navy rounded-2xl px-4 py-2.5 text-sm text-navy resize-none"
              />
              <label className="flex items-center gap-2 text-sm font-bold text-navy cursor-pointer">
                <input
                  type="checkbox"
                  checked={nPinned}
                  onChange={(e) => setNPinned(e.target.checked)}
                  title="Pin this notice"
                  className="w-5 h-5 accent-lime"
                />
                Pin this notice
              </label>
              <button
                onClick={createNotice}
                disabled={formLoading || !nTitle.trim() || !nContent.trim()}
                className="bg-navy border-[3px] border-lime press-3 press-lime px-6 py-2.5 rounded-2xl font-bold text-sm text-lime disabled:opacity-50"
              >
                {formLoading ? "Posting..." : "Post Notice"}
              </button>
            </div>
          )}

          {/* Notices list */}
          {notices.length === 0 ? (
            <div className="bg-ghost border-4 border-navy rounded-3xl p-10 text-center shadow-[8px_8px_0_0_#000]">
              <p className="text-slate">No notices yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notices.map((n) => (
                <div
                  key={n.id}
                  className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {n.isPinned && (
                          <span className="bg-coral text-snow text-label-sm px-2 py-0.5 rounded-lg font-bold">PINNED</span>
                        )}
                        <h4 className="font-display font-black text-navy truncate">{n.title}</h4>
                      </div>
                      <p className="text-sm text-navy whitespace-pre-line">{n.content}</p>
                      <p className="text-xs text-slate mt-2">
                        {n.createdByName} · {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {canManageNoticeboard && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => togglePinNotice(n.id, n.isPinned)}
                          className="text-xs font-bold text-slate hover:text-navy"
                          title={n.isPinned ? "Unpin" : "Pin"}
                        >
                          {n.isPinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={() => deleteNotice(n.id)}
                          className="text-xs font-bold text-coral hover:text-coral/80"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TASKS ─────────────────────────────────────────── */}
      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Status filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "", label: "All" },
                { key: "pending", label: "Pending" },
                { key: "in_progress", label: "In Progress" },
                { key: "done", label: "Done" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTaskFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                    taskFilter === f.key
                      ? "bg-lime text-navy border-navy"
                      : "bg-snow text-slate border-transparent hover:border-navy hover:text-navy"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {canManageTasks && (
              <button
                onClick={() => setShowTaskForm((p) => !p)}
                className="bg-lime border-[3px] border-navy press-3 press-navy px-5 py-2.5 rounded-2xl font-bold text-sm text-navy"
              >
                {showTaskForm ? "Cancel" : "+ New Task"}
              </button>
            )}
          </div>

          {/* Create form */}
          {showTaskForm && (
            <div className="bg-lime-light border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
              <h3 className="font-display font-black text-lg text-navy">New Task</h3>
              <input
                type="text"
                placeholder="Task title"
                value={tTitle}
                onChange={(e) => setTTitle(e.target.value)}
                className="w-full bg-snow border-[3px] border-navy rounded-2xl px-4 py-2.5 text-sm text-navy"
              />
              <textarea
                placeholder="Description (optional)"
                value={tDesc}
                onChange={(e) => setTDesc(e.target.value)}
                rows={3}
                className="w-full bg-snow border-[3px] border-navy rounded-2xl px-4 py-2.5 text-sm text-navy resize-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-label-sm text-navy mb-1 block">Assign To</label>
                  <select
                    value={tAssignee}
                    onChange={(e) => setTAssignee(e.target.value)}
                    aria-label="Assign to member"
                    className="w-full bg-snow border-[3px] border-navy rounded-2xl px-3 py-2 text-sm text-navy"
                  >
                    <option value="">Everyone</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-label-sm text-navy mb-1 block">Due Date</label>
                  <input
                    type="date"
                    value={tDue}
                    onChange={(e) => setTDue(e.target.value)}
                    aria-label="Due date"
                    className="w-full bg-snow border-[3px] border-navy rounded-2xl px-3 py-2 text-sm text-navy"
                  />
                </div>
                <div>
                  <label className="text-label-sm text-navy mb-1 block">Priority</label>
                  <select
                    value={tPriority}
                    onChange={(e) => setTPriority(e.target.value)}
                    aria-label="Task priority"
                    className="w-full bg-snow border-[3px] border-navy rounded-2xl px-3 py-2 text-sm text-navy"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <button
                onClick={createTask}
                disabled={formLoading || !tTitle.trim()}
                className="bg-navy border-[3px] border-lime press-3 press-lime px-6 py-2.5 rounded-2xl font-bold text-sm text-lime disabled:opacity-50"
              >
                {formLoading ? "Creating..." : "Create Task"}
              </button>
            </div>
          )}

          {/* Tasks list */}
          {tasks.length === 0 ? (
            <div className="bg-ghost border-4 border-navy rounded-3xl p-10 text-center shadow-[8px_8px_0_0_#000]">
              <p className="text-slate">No tasks yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((t) => {
                const s = STATUS_STYLES[t.status] || STATUS_STYLES.pending;
                return (
                  <div
                    key={t.id}
                    className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[5px_5px_0_0_#000]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 text-label-sm px-2 py-0.5 rounded-lg font-bold ${s.bg}`}>
                            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                          <span className={`text-label-sm px-2 py-0.5 rounded-lg font-bold ${PRIORITY_STYLES[t.priority]}`}>
                            {t.priority.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="font-display font-black text-navy">{t.title}</h4>
                        {t.description && <p className="text-sm text-slate mt-1">{t.description}</p>}
                        <p className="text-xs text-slate mt-2">
                          Assigned: {t.assignedToName} · {t.dueDate ? `Due: ${formatDate(t.dueDate)}` : "No due date"} · {timeAgo(t.createdAt)}
                        </p>
                        {t.assignedTo && (
                          <div className="mt-2">
                            <Link
                              href={buildMessagesHref({
                                userId: t.assignedTo,
                                userName: t.assignedToName,
                                context: "team_head_task",
                                contextId: t.id,
                                contextLabel: t.title,
                              })}
                              className="inline-flex text-[10px] font-bold bg-lime border-2 border-navy px-2.5 py-1 rounded-lg text-navy press-1 press-navy"
                            >
                              Message assignee
                            </Link>
                          </div>
                        )}
                      </div>

                      {canManageTasks && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <select
                            value={t.status}
                            onChange={(e) => updateTaskStatus(t.id, e.target.value)}
                            aria-label="Change task status"
                            className="text-xs bg-snow border-2 border-navy rounded-xl px-2 py-1 font-bold text-navy"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                          <button
                            onClick={() => deleteTask(t.id)}
                            className="text-xs font-bold text-coral hover:text-coral/80 text-right"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS ─────────────────────────────────────── */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {analyticsLoading && !analytics ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-lime border-t-transparent rounded-full animate-spin" />
            </div>
          ) : analytics ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-teal border-4 border-navy rounded-3xl p-5 shadow-[8px_8px_0_0_#000]">
                  <p className="text-label-sm text-navy/60">MEMBERS</p>
                  <p className="font-display font-black text-display-md text-navy">{analytics.memberCount}</p>
                </div>
                <div className="bg-lime border-4 border-navy rounded-3xl p-5 shadow-[8px_8px_0_0_#000]">
                  <p className="text-label-sm text-navy/60">TOTAL TASKS</p>
                  <p className="font-display font-black text-display-md text-navy">{analytics.taskStats.total}</p>
                </div>
                <div className="bg-sunny border-4 border-navy rounded-3xl p-5 shadow-[8px_8px_0_0_#000]">
                  <p className="text-label-sm text-navy/60">COMPLETION</p>
                  <p className="font-display font-black text-display-md text-navy">{analytics.taskStats.completionRate.toFixed(0)}%</p>
                </div>
                <div className="bg-coral border-4 border-navy rounded-3xl p-5 shadow-[8px_8px_0_0_#000]">
                  <p className="text-label-sm text-navy/60">OVERDUE</p>
                  <p className="font-display font-black text-display-md text-navy">{analytics.overdueCount}</p>
                </div>
              </div>

              {/* Task status breakdown */}
              <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                <h3 className="font-display font-black text-lg text-navy mb-4">Task Status Breakdown</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { label: "Pending", value: analytics.taskStats.pending, color: "bg-cloud" },
                    { label: "In Progress", value: analytics.taskStats.in_progress, color: "bg-sunny-light" },
                    { label: "Done", value: analytics.taskStats.done, color: "bg-teal-light" },
                  ].map((s) => (
                    <div key={s.label} className={`${s.color} rounded-2xl p-4 text-center`}>
                      <p className="font-display font-black text-display-sm text-navy">{s.value}</p>
                      <p className="text-xs font-bold text-slate mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
                {/* Progress bar */}
                {analytics.taskStats.total > 0 && (
                  <div className="h-4 bg-cloud rounded-full overflow-hidden flex">
                    {analytics.taskStats.done > 0 && (
                      <div
                        className="bg-teal h-full transition-all"
                        style={{ width: `${(analytics.taskStats.done / analytics.taskStats.total) * 100}%` }}
                      />
                    )}
                    {analytics.taskStats.in_progress > 0 && (
                      <div
                        className="bg-sunny h-full transition-all"
                        style={{ width: `${(analytics.taskStats.in_progress / analytics.taskStats.total) * 100}%` }}
                      />
                    )}
                    {analytics.taskStats.pending > 0 && (
                      <div
                        className="bg-slate/30 h-full transition-all"
                        style={{ width: `${(analytics.taskStats.pending / analytics.taskStats.total) * 100}%` }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Priority breakdown */}
              {Object.keys(analytics.priorityBreakdown).length > 0 && (
                <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                  <h3 className="font-display font-black text-lg text-navy mb-4">Priority Breakdown</h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(analytics.priorityBreakdown).map(([priority, count]) => (
                      <div
                        key={priority}
                        className={`${PRIORITY_STYLES[priority] || "bg-cloud text-slate"} px-4 py-2 rounded-xl text-sm font-bold`}
                      >
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}: {count as number}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notice stats */}
              <div className="bg-lavender-light border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                <h3 className="font-display font-black text-lg text-navy mb-3">Noticeboard Stats</h3>
                <div className="flex gap-6">
                  <div>
                    <p className="font-display font-black text-display-sm text-navy">{analytics.noticeStats.total}</p>
                    <p className="text-xs font-bold text-slate">Total Notices</p>
                  </div>
                  <div>
                    <p className="font-display font-black text-display-sm text-navy">{analytics.noticeStats.pinned}</p>
                    <p className="text-xs font-bold text-slate">Pinned</p>
                  </div>
                </div>
              </div>

              {/* Member completion leaderboard */}
              {analytics.memberStats.length > 0 && (
                <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                  <h3 className="font-display font-black text-lg text-navy mb-4">Member Activity</h3>
                  <div className="space-y-3">
                    {analytics.memberStats.map((ms, idx) => (
                      <div key={ms.userId} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate w-6 text-center">{idx + 1}</span>
                        {resolveProfileImageUrl(ms) ? (
                          <Image
                            src={resolveProfileImageUrl(ms)!}
                            alt=""
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full object-cover border-2 border-navy"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-lime border-2 border-navy flex items-center justify-center text-xs font-bold text-navy">
                            {ms.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-navy truncate">{ms.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex-1 h-2 bg-cloud rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal rounded-full transition-all"
                                style={{ width: `${ms.completionRate}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate whitespace-nowrap">
                              {ms.doneTasks}/{ms.totalTasks}
                            </span>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                          ms.completionRate >= 80 ? "bg-teal-light text-teal" :
                          ms.completionRate >= 50 ? "bg-sunny-light text-navy" :
                          "bg-coral-light text-coral"
                        }`}>
                          {ms.completionRate.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-snow border-4 border-navy rounded-3xl p-10 shadow-[8px_8px_0_0_#000] text-center">
              <p className="text-slate">No analytics data available.</p>
            </div>
          )}
        </div>
      )}

      {/* ── ANNOUNCE ──────────────────────────────────────── */}
      {tab === "announce" && canAnnounce && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] space-y-4">
            <h3 className="font-display font-black text-lg text-navy">
              Send Announcement to {activeUnit?.unitLabel} Members
            </h3>
            <p className="text-sm text-slate">
              This will create an announcement and notify all {members.length} member(s) of your team.
            </p>
            <input
              type="text"
              placeholder="Announcement title"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              className="w-full bg-snow border-[3px] border-navy rounded-2xl px-4 py-2.5 text-sm text-navy"
            />
            <textarea
              placeholder="Announcement content..."
              value={annContent}
              onChange={(e) => setAnnContent(e.target.value)}
              rows={5}
              className="w-full bg-snow border-[3px] border-navy rounded-2xl px-4 py-2.5 text-sm text-navy resize-none"
            />
            <div>
              <label className="text-label-sm text-navy mb-1 block">PRIORITY</label>
              <div className="flex gap-2">
                {["low", "normal", "urgent"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setAnnPriority(p)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                      annPriority === p
                        ? "bg-lime text-navy border-navy"
                        : "bg-snow text-slate border-transparent hover:border-navy"
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={sendAnnouncement}
              disabled={formLoading || !annTitle.trim() || annContent.trim().length < 10}
              className="bg-navy border-[3px] border-lime press-4 press-lime px-6 py-3 rounded-2xl font-bold text-sm text-lime disabled:opacity-50"
            >
              {formLoading ? "Sending..." : "Send Announcement"}
            </button>
          </div>
        </div>
      )}

      <ToolHelpModal toolId="team-head-portal" isOpen={showHelp} onClose={closeHelp} />
    </div>
  );
}

export default withAuth(TeamHeadPortal, { requiredPermission: "team_head:view_members" });
