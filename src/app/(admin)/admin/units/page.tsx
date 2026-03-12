"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { toast } from "sonner";
import { throwApiError, getErrorMessage } from "@/lib/adminApiError";
import Image from "next/image";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ── Types ────────────────────────────────────── */

interface UnitMember {
  id: string;
  roleId: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber?: string;
  level?: string;
  profilePhotoURL?: string;
  joinedAt?: string;
}

interface UnitHead {
  id?: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber?: string;
  profilePhotoURL?: string;
}

interface UnitOverview {
  unit: string;
  unitLabel: string;
  head: UnitHead | null;
  members: UnitMember[];
  memberCount: number;
  maxMembers: number;
  isOpen: boolean;
  pendingApplications: number;
}

interface UnitConfig {
  id: string;
  slug: string;
  label: string;
  description: string;
  colorKey: string;
  head: UnitHead | null;
  isStatic: boolean;
}

interface Application {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userLevel?: string;
  unit: string;
  unitLabel: string;
  motivation: string;
  skills?: string;
  status: string;
  feedback?: string;
  reviewerName?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber?: string;
  level?: string;
  profilePhotoURL?: string;
  role: string;
}

interface UnitNotice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  authorName?: string;
  createdAt: string;
}

interface UnitTask {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "done";
  priority: "low" | "normal" | "high" | "urgent";
  assignedTo?: string;
  dueDate?: string;
  createdByName?: string;
  createdAt: string;
}

interface UnitTaskSummary {
  total: number;
  pending: number;
  in_progress: number;
  done: number;
  completionRate: number;
}

interface UnitContent {
  unitSlug: string;
  unitLabel: string;
  noticeboard: UnitNotice[];
  tasks: UnitTask[];
  taskSummary: UnitTaskSummary;
}

/* ─── Helpers ──────────────────────────────────── */

const COLOR_OPTIONS = [
  { key: "lime",     label: "Lime",     dot: "bg-lime"     },
  { key: "lavender", label: "Lavender", dot: "bg-lavender" },
  { key: "coral",    label: "Coral",    dot: "bg-coral"    },
  { key: "teal",     label: "Teal",     dot: "bg-teal"     },
  { key: "sunny",    label: "Sunny",    dot: "bg-sunny"    },
  { key: "slate",    label: "Slate",    dot: "bg-slate"    },
];

const TEAM_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  press:              { bg: "bg-coral-light/60",    border: "border-coral",    badge: "bg-coral"    },
  ics:                { bg: "bg-lavender-light/60", border: "border-lavender", badge: "bg-lavender" },
  industrial_visit:   { bg: "bg-teal-light/60",     border: "border-teal",     badge: "bg-teal"     },
  conference:         { bg: "bg-sunny-light/60",    border: "border-sunny",    badge: "bg-sunny"    },
  logistics:          { bg: "bg-lime-light/60",     border: "border-lime",     badge: "bg-lime"     },
  welfare:            { bg: "bg-teal-light/60",     border: "border-teal",     badge: "bg-teal"     },
  alumni_relations:   { bg: "bg-lavender-light/60", border: "border-lavender", badge: "bg-lavender" },
  dinner_award:       { bg: "bg-coral-light/60",    border: "border-coral",    badge: "bg-coral"    },
  lime:     { bg: "bg-lime-light/60",     border: "border-lime",     badge: "bg-lime"     },
  lavender: { bg: "bg-lavender-light/60", border: "border-lavender", badge: "bg-lavender" },
  coral:    { bg: "bg-coral-light/60",    border: "border-coral",    badge: "bg-coral"    },
  teal:     { bg: "bg-teal-light/60",     border: "border-teal",     badge: "bg-teal"     },
  sunny:    { bg: "bg-sunny-light/60",    border: "border-sunny",    badge: "bg-sunny"    },
  slate:    { bg: "bg-ghost",             border: "border-cloud",    badge: "bg-slate"    },
};

function getTeamColors(slug: string, colorKey?: string) {
  return TEAM_COLORS[slug] || (colorKey ? TEAM_COLORS[colorKey] : null) || TEAM_COLORS.slate;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/* ─── Component ────────────────────────────────── */

type Tab = "overview" | "applications" | "content";

function TeamsPage() {
  const { getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-teams");

  const [tab, setTab] = useState<Tab>("overview");
  const [units, setUnits] = useState<UnitOverview[]>([]);
  const [unitConfigs, setUnitConfigs] = useState<UnitConfig[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [appTotal, setAppTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [appLoading, setAppLoading] = useState(false);

  const [filterUnit, setFilterUnit] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");

  // Settings modal
  const [settingsUnit, setSettingsUnit] = useState<UnitOverview | null>(null);
  const [settingsMaxMembers, setSettingsMaxMembers] = useState(0);
  const [settingsIsOpen, setSettingsIsOpen] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Review modal
  const [reviewApp, setReviewApp] = useState<Application | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"accepted" | "rejected">("accepted");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Revoke confirm
  const [revokeConfirm, setRevokeConfirm] = useState<{ isOpen: boolean; member: UnitMember | null; unit: UnitOverview | null }>({ isOpen: false, member: null, unit: null });
  const [revoking, setRevoking] = useState(false);

  // Expanded unit cards
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  // Content tab state
  const [unitContents, setUnitContents] = useState<Record<string, UnitContent>>({});
  const [contentLoading, setContentLoading] = useState<Record<string, boolean>>({});
  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set());

  // Create unit modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ label: "", description: "", colorKey: "teal" });
  const [creating, setCreating] = useState(false);

  // Edit unit modal
  const [editingUnit, setEditingUnit] = useState<UnitConfig | null>(null);
  const [editForm, setEditForm] = useState({ label: "", description: "", colorKey: "teal" });
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [deleteConfirmUnit, setDeleteConfirmUnit] = useState<UnitConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Set Head modal
  const [setHeadUnit, setSetHeadUnit] = useState<UnitConfig | null>(null);
  const [headSearch, setHeadSearch] = useState("");
  const [headSearchResults, setHeadSearchResults] = useState<UserSearchResult[]>([]);
  const [headSearching, setHeadSearching] = useState(false);
  const [assigningHead, setAssigningHead] = useState(false);
  const [removingHead, setRemovingHead] = useState(false);
  const headSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Data fetching ───────────────── */

  const fetchOverview = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl("/api/v1/team-applications/overview"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) await throwApiError(res, "load teams overview");
      setUnits(await res.json());
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load teams overview"));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  const fetchUnitConfigs = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl("/api/v1/teams/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) await throwApiError(res, "load team configs");
      setUnitConfigs(await res.json());
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load team configurations"));
    }
  }, [getAccessToken]);

  const fetchApplications = useCallback(async () => {
    setAppLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const params = new URLSearchParams();
      if (filterUnit) params.set("unit", filterUnit);
      if (filterStatus) params.set("status", filterStatus);
      params.set("limit", "50");
      const res = await fetch(getApiUrl(`/api/v1/team-applications/?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) await throwApiError(res, "load applications");
      const data = await res.json();
      setApplications(data.items || []);
      setAppTotal(data.total || 0);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load applications"));
    } finally {
      setAppLoading(false);
    }
  }, [getAccessToken, filterUnit, filterStatus]);

  const fetchUnitContent = useCallback(async (unitSlug: string) => {
    if (unitContents[unitSlug] || contentLoading[unitSlug]) return;
    setContentLoading((prev) => ({ ...prev, [unitSlug]: true }));
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl(`/api/v1/team-head/${unitSlug}/admin-content`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Silently skip units where head content isn't available
        setUnitContents((prev) => ({
          ...prev,
          [unitSlug]: { unitSlug, unitLabel: unitSlug, noticeboard: [], tasks: [], taskSummary: { total: 0, pending: 0, in_progress: 0, done: 0, completionRate: 0 } },
        }));
        return;
      }
      const data = await res.json();
      setUnitContents((prev) => ({ ...prev, [unitSlug]: data }));
    } catch {
      // Silently ignore
    } finally {
      setContentLoading((prev) => ({ ...prev, [unitSlug]: false }));
    }
  }, [getAccessToken, unitContents, contentLoading]);

  useEffect(() => { fetchOverview(); fetchUnitConfigs(); }, [fetchOverview, fetchUnitConfigs]);
  useEffect(() => { if (tab === "applications") fetchApplications(); }, [tab, fetchApplications]);

  /* ── Settings ───────────────────── */

  const openSettings = (unit: UnitOverview) => {
    setSettingsUnit(unit);
    setSettingsMaxMembers(unit.maxMembers);
    setSettingsIsOpen(unit.isOpen);
  };

  const saveSettings = async () => {
    if (!settingsUnit) return;
    setSavingSettings(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl(`/api/v1/team-applications/settings/${settingsUnit.unit}`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ maxMembers: settingsMaxMembers, isOpen: settingsIsOpen }),
      });
      if (!res.ok) await throwApiError(res, "update settings");
      toast.success("Settings updated");
      setSettingsUnit(null);
      fetchOverview();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update settings"));
    } finally {
      setSavingSettings(false);
    }
  };

  /* ── Review ─────────────────────── */

  const handleReview = async () => {
    if (!reviewApp) return;
    setReviewing(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl(`/api/v1/team-applications/${reviewApp.id}/review`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewStatus, feedback: reviewFeedback || null }),
      });
      if (!res.ok) await throwApiError(res, "review application");
      toast.success(`Application ${reviewStatus}`);
      setReviewApp(null);
      setReviewFeedback("");
      fetchApplications();
      fetchOverview();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to review application"));
    } finally {
      setReviewing(false);
    }
  };

  /* ── Revoke ─────────────────────── */

  const handleRevoke = async () => {
    const { member, unit } = revokeConfirm;
    if (!member || !unit) return;
    setRevoking(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const params = new URLSearchParams({ unit: unit.unit, status: "accepted", search: member.email, limit: "1" });
      const searchRes = await fetch(getApiUrl(`/api/v1/team-applications/?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const searchData = await searchRes.json();
      const app = searchData.items?.[0];
      if (!app) { toast.error("Could not find the member's application"); return; }
      const res = await fetch(getApiUrl(`/api/v1/team-applications/${app.id}/revoke`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) await throwApiError(res, "revoke membership");
      toast.success(`Removed ${member.firstName} from ${unit.unitLabel}`);
      setRevokeConfirm({ isOpen: false, member: null, unit: null });
      fetchOverview();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to revoke membership"));
    } finally {
      setRevoking(false);
    }
  };

  /* ── Create unit ────────────────── */

  const handleCreateUnit = async () => {
    if (!createForm.label.trim()) return;
    setCreating(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl("/api/v1/teams/"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) await throwApiError(res, "create team");
      toast.success(`Team "${createForm.label}" created`);
      setShowCreateModal(false);
      setCreateForm({ label: "", description: "", colorKey: "teal" });
      fetchUnitConfigs();
      fetchOverview();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create team"));
    } finally {
      setCreating(false);
    }
  };

  /* ── Edit unit ──────────────────── */

  const openEditModal = (config: UnitConfig) => {
    setEditingUnit(config);
    setEditForm({ label: config.label, description: config.description, colorKey: config.colorKey });
  };

  const handleEditUnit = async () => {
    if (!editingUnit) return;
    setEditSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl(`/api/v1/teams/${editingUnit.id}`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) await throwApiError(res, "update team");
      toast.success("Team updated");
      setEditingUnit(null);
      fetchUnitConfigs();
      fetchOverview();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update team"));
    } finally {
      setEditSaving(false);
    }
  };

  /* ── Delete unit ────────────────── */

  const handleDeleteUnit = async () => {
    if (!deleteConfirmUnit) return;
    setDeleting(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl(`/api/v1/teams/${deleteConfirmUnit.id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) await throwApiError(res, "delete team");
      toast.success(`Team "${deleteConfirmUnit.label}" deleted`);
      setDeleteConfirmUnit(null);
      fetchUnitConfigs();
      fetchOverview();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete team"));
    } finally {
      setDeleting(false);
    }
  };

  /* ── Head search ────────────────── */

  const searchHeads = useCallback(async (q: string) => {
    if (q.length < 2) { setHeadSearchResults([]); return; }
    setHeadSearching(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl(`/api/v1/teams/user-search?q=${encodeURIComponent(q)}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) await throwApiError(res, "search users");
      setHeadSearchResults(await res.json());
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to search users"));
    } finally {
      setHeadSearching(false);
    }
  }, [getAccessToken]);

  const handleHeadSearchChange = (q: string) => {
    setHeadSearch(q);
    if (headSearchTimeout.current) clearTimeout(headSearchTimeout.current);
    headSearchTimeout.current = setTimeout(() => searchHeads(q), 350);
  };

  /* ── Assign head ────────────────── */

  const handleSetHead = async (u: UserSearchResult) => {
    if (!setHeadUnit) return;
    setAssigningHead(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl(`/api/v1/teams/${setHeadUnit.id}/set-head`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id }),
      });
      if (!res.ok) await throwApiError(res, "assign head");
      toast.success(`${u.firstName} ${u.lastName} assigned as head`);
      setSetHeadUnit(null);
      setHeadSearch("");
      setHeadSearchResults([]);
      fetchUnitConfigs();
      fetchOverview();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to assign head"));
    } finally {
      setAssigningHead(false);
    }
  };

  /* ── Remove head ────────────────── */

  const handleRemoveHead = async (config: UnitConfig) => {
    setRemovingHead(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl(`/api/v1/teams/${config.id}/head`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) await throwApiError(res, "remove head");
      toast.success("Head removed");
      fetchUnitConfigs();
      fetchOverview();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove head"));
    } finally {
      setRemovingHead(false);
    }
  };

  /* ── Toggle expanded ────────────── */

  const toggleExpanded = (unit: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unit)) next.delete(unit); else next.add(unit);
      return next;
    });
  };

  /* ── Merge overview + configs ─────── */

  const mergedUnits = (() => {
    const configMap = new Map(unitConfigs.map((c) => [c.slug, c]));
    const fromOverview = units.map((u) => ({
      slug: u.unit, unitLabel: u.unitLabel, head: u.head, members: u.members,
      memberCount: u.memberCount, maxMembers: u.maxMembers, isOpen: u.isOpen,
      pendingApplications: u.pendingApplications, config: configMap.get(u.unit) || null, isStatic: true,
    }));
    const overviewSlugs = new Set(units.map((u) => u.unit));
    const customOnly = unitConfigs
      .filter((c) => !c.isStatic && !overviewSlugs.has(c.slug))
      .map((c) => ({
        slug: c.slug, unitLabel: c.label, head: c.head, members: [], memberCount: 0,
        maxMembers: 0, isOpen: true, pendingApplications: 0, config: c, isStatic: false,
      }));
    return [...fromOverview, ...customOnly];
  })();

  /* ── Render ─────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-navy border-t-transparent" />
      </div>
    );
  }

  const totalPending = units.reduce((s, u) => s + u.pendingApplications, 0);

  return (
    <div className="max-w-7xl mx-auto">
      <ToolHelpModal toolId="admin-teams" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-black text-display-lg text-navy">
          <span className="brush-highlight">Teams</span>
        </h1>
        <p className="text-slate mt-2">Manage team heads, members, applications, and capacity.</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("overview")}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm border-[3px] transition-all ${tab === "overview" ? "bg-navy text-snow border-lime" : "bg-snow text-navy border-navy/20 hover:border-navy/40"}`}
        >Overview</button>
        <button
          onClick={() => setTab("applications")}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm border-[3px] transition-all flex items-center gap-2 ${tab === "applications" ? "bg-navy text-snow border-lime" : "bg-snow text-navy border-navy/20 hover:border-navy/40"}`}
        >
          Applications
          {totalPending > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-coral text-snow text-xs font-bold min-w-[20px]">{totalPending}</span>
          )}
        </button>
        <button
          onClick={() => setTab("content")}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm border-[3px] transition-all ${tab === "content" ? "bg-navy text-snow border-lime" : "bg-snow text-navy border-navy/20 hover:border-navy/40"}`}
        >Content</button>
      </div>

      {/* ── Overview Tab ─────────────── */}
      {tab === "overview" && (
        <>
          <div className="flex justify-end mb-5">
            <PermissionGate permission="team:manage">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-lime border-[4px] border-navy px-5 py-2.5 rounded-2xl font-display font-black text-base text-navy press-4 press-navy"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                </svg>
                New Team
              </button>
            </PermissionGate>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {mergedUnits.map((unit) => {
              const colors = getTeamColors(unit.slug, unit.config?.colorKey);
              const isExpanded = expandedUnits.has(unit.slug);
              const config = unit.config;

              return (
                <div key={unit.slug} className={`${colors.bg} border-[4px] ${colors.border} rounded-3xl overflow-hidden shadow-[6px_6px_0_0_#000]`}>
                  <div className="p-5 pb-3">
                    {/* Card header row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 pr-2">
                        <h3 className="font-display font-black text-lg text-navy">{unit.unitLabel}</h3>
                        {config?.description && (
                          <p className="text-xs text-slate mt-0.5 line-clamp-1">{config.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {!unit.isStatic && (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-navy/10 text-navy text-[10px] font-bold uppercase tracking-wider">Custom</span>
                          )}
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${unit.isOpen ? "bg-teal/20 text-teal" : "bg-coral/20 text-coral"}`}>
                            {unit.isOpen ? "Open" : "Closed"}
                          </span>
                          {unit.pendingApplications > 0 && (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-coral/20 text-coral text-[10px] font-bold">{unit.pendingApplications} pending</span>
                          )}
                        </div>
                      </div>

                      {/* Card actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <PermissionGate permission="team:manage">
                          {config && (
                            <button onClick={() => openEditModal(config)} className="p-1.5 rounded-lg hover:bg-navy/10 transition-colors" title="Edit team">
                              <svg className="w-4 h-4 text-navy" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                                <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => { const ov = units.find((u) => u.unit === unit.slug); if (ov) openSettings(ov); }}
                            className="p-1.5 rounded-lg hover:bg-navy/10 transition-colors" title="Team settings"
                          >
                            <svg className="w-4 h-4 text-navy" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {!unit.isStatic && config && (
                            <button onClick={() => setDeleteConfirmUnit(config)} className="p-1.5 rounded-lg hover:bg-coral/20 transition-colors" title="Delete team">
                              <svg className="w-4 h-4 text-coral" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </PermissionGate>
                      </div>
                    </div>

                    {/* Head section */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-navy/60">Head</p>
                        <PermissionGate permission="team:manage">
                          <div className="flex items-center gap-2">
                            {unit.head && config && (
                              <button onClick={() => handleRemoveHead(config)} disabled={removingHead} className="text-[10px] font-bold text-coral hover:underline">Remove</button>
                            )}
                            {config && (
                              <button
                                onClick={() => { setSetHeadUnit(config); setHeadSearch(""); setHeadSearchResults([]); }}
                                className="text-[10px] font-bold text-navy hover:underline"
                              >
                                {unit.head ? "Change" : "Assign head"}
                              </button>
                            )}
                          </div>
                        </PermissionGate>
                      </div>
                      {unit.head ? (
                        <div className="flex items-center gap-2">
                          {unit.head.profilePhotoURL ? (
                            <Image src={unit.head.profilePhotoURL} alt="" width={28} height={28} className="w-7 h-7 rounded-full object-cover border-2 border-navy/20" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy">
                              {unit.head.firstName?.[0]}{unit.head.lastName?.[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-navy truncate">{unit.head.firstName} {unit.head.lastName}</p>
                            <p className="text-[10px] text-slate truncate">{unit.head.email}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate italic">No head assigned</p>
                      )}
                    </div>

                    {/* Member count */}
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-navy">
                        {unit.memberCount} member{unit.memberCount !== 1 ? "s" : ""}
                        {unit.maxMembers > 0 && <span className="text-slate font-normal"> / {unit.maxMembers} max</span>}
                      </p>
                      {unit.memberCount > 0 && (
                        <button onClick={() => toggleExpanded(unit.slug)} className="text-xs font-bold text-navy underline underline-offset-2 hover:text-navy/70">
                          {isExpanded ? "Hide" : "Show"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded members */}
                  {isExpanded && unit.members.length > 0 && (
                    <div className="border-t-[3px] border-navy/10 px-5 py-3 space-y-2 max-h-60 overflow-y-auto">
                      {unit.members.map((m) => {
                        const ov = units.find((u) => u.unit === unit.slug);
                        return (
                          <div key={m.id} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {m.profilePhotoURL ? (
                                <Image src={m.profilePhotoURL} alt="" width={24} height={24} className="w-6 h-6 rounded-full object-cover border border-navy/20" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center text-[9px] font-bold text-navy">
                                  {m.firstName?.[0]}{m.lastName?.[0]}
                                </div>
                              )}
                              <p className="text-xs font-bold text-navy truncate">
                                {m.firstName} {m.lastName}
                                {m.level && <span className="font-normal text-slate ml-1">({m.level})</span>}
                              </p>
                            </div>
                            <PermissionGate permission="team:manage">
                              <button
                                onClick={() => ov && setRevokeConfirm({ isOpen: true, member: m, unit: ov })}
                                className="shrink-0 p-1 rounded hover:bg-coral/20 transition-colors" title="Remove member"
                              >
                                <svg className="w-4 h-4 text-coral" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </PermissionGate>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {mergedUnits.length === 0 && (
              <div className="col-span-full text-center py-16">
<p className="text-slate font-medium">No teams available</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Applications Tab ─────────── */}
      {tab === "applications" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-5">
            <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} aria-label="Filter by team"
              className="px-3 py-2 rounded-xl border-[3px] border-navy/20 bg-snow text-sm font-medium text-navy focus:border-navy outline-none">
              <option value="">All Teams</option>
              {units.map((u) => <option key={u.unit} value={u.unit}>{u.unitLabel}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filter by status"
              className="px-3 py-2 rounded-xl border-[3px] border-navy/20 bg-snow text-sm font-medium text-navy focus:border-navy outline-none">
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="revoked">Revoked</option>
              <option value="">All Statuses</option>
            </select>
          </div>

          {appLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-navy border-t-transparent" />
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-16 bg-snow border-[3px] border-navy/10 rounded-2xl">
              <p className="text-slate font-medium">No applications found</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate uppercase tracking-wider">{appTotal} application{appTotal !== 1 ? "s" : ""}</p>
              {applications.map((app) => {
                const colors = TEAM_COLORS[app.unit] || TEAM_COLORS.slate;
                const statusColors: Record<string, string> = {
                  pending: "bg-sunny/20 text-navy",
                  accepted: "bg-teal/20 text-teal",
                  rejected: "bg-coral/20 text-coral",
                  revoked: "bg-slate/20 text-slate",
                };
                return (
                  <div key={app.id} className="bg-snow border-[3px] border-navy/10 rounded-2xl p-4 hover:border-navy/20 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-navy">{app.userName}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[app.status] || ""}`}>{app.status}</span>
                        </div>
                        <p className="text-xs text-slate">{app.userEmail}{app.userLevel ? ` · ${app.userLevel}` : ""}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-navy ${colors.bg}`}>{app.unitLabel}</span>
                          <span className="text-[11px] text-slate">{formatDate(app.createdAt)}</span>
                        </div>
                      </div>
                      {app.status === "pending" && (
                        <PermissionGate permission="team:review">
                          <button
                            onClick={() => { setReviewApp(app); setReviewStatus("accepted"); setReviewFeedback(""); }}
                            className="shrink-0 bg-lime border-[3px] border-navy px-4 py-2 rounded-xl font-bold text-sm text-navy press-3 press-navy"
                          >Review</button>
                        </PermissionGate>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-navy/80 line-clamp-2">{app.motivation}</p>
                    {app.feedback && (
                      <p className="mt-1.5 text-xs text-slate italic">
                        Feedback: {app.feedback}{app.reviewerName && <span> — {app.reviewerName}</span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Content Tab ──────────────── */}
      {tab === "content" && (
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate uppercase tracking-wider">
            Noticeboard posts &amp; tasks across all teams — viewable by admins with review access.
          </p>
          {mergedUnits.length === 0 ? (
            <div className="text-center py-16 bg-snow border-[3px] border-navy/10 rounded-2xl">
              <p className="text-slate font-medium">No teams available</p>
            </div>
          ) : (
            mergedUnits.map((unit) => {
              const colors = getTeamColors(unit.slug, unit.config?.colorKey);
              const isOpen = expandedContent.has(unit.slug);
              const content = unitContents[unit.slug];
              const isLoading = contentLoading[unit.slug];

              const toggleContent = () => {
                setExpandedContent((prev) => {
                  const next = new Set(prev);
                  if (next.has(unit.slug)) {
                    next.delete(unit.slug);
                  } else {
                    next.add(unit.slug);
                    fetchUnitContent(unit.slug);
                  }
                  return next;
                });
              };

              const taskStatusColor: Record<string, string> = {
                pending: "bg-sunny/20 text-navy",
                in_progress: "bg-lavender/20 text-navy",
                done: "bg-teal/20 text-teal",
              };
              const priorityColor: Record<string, string> = {
                low: "bg-cloud text-slate",
                normal: "bg-ghost text-slate",
                high: "bg-sunny/20 text-navy",
                urgent: "bg-coral/20 text-coral",
              };

              return (
                <div key={unit.slug} className={`${colors.bg} border-[4px] ${colors.border} rounded-2xl overflow-hidden`}>
                  {/* Header row */}
                  <button
                    onClick={toggleContent}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-navy/5 transition-colors text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-display font-black text-base text-navy">{unit.unitLabel}</p>
                        <p className="text-xs text-slate mt-0.5">
                          {unit.memberCount} member{unit.memberCount !== 1 ? "s" : ""}
                          {content && ` · ${content.taskSummary.total} task${content.taskSummary.total !== 1 ? "s" : ""} · ${content.noticeboard.length} notice${content.noticeboard.length !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {content && content.taskSummary.total > 0 && (
                        <div className="hidden sm:flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-teal/20 text-teal text-[10px] font-bold">
                            {content.taskSummary.completionRate}% done
                          </span>
                          {content.taskSummary.pending > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-sunny/20 text-navy text-[10px] font-bold">
                              {content.taskSummary.pending} pending
                            </span>
                          )}
                        </div>
                      )}
                      <svg
                        className={`w-5 h-5 text-navy transition-transform ${isOpen ? "rotate-180" : ""}`}
                        viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="border-t-[3px] border-navy/10">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-10">
                          <div className="animate-spin rounded-full h-7 w-7 border-[3px] border-navy border-t-transparent" />
                        </div>
                      ) : !content ? (
                        <div className="px-5 py-8 text-center text-slate text-sm">Could not load content.</div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-navy/10">

                          {/* Noticeboard */}
                          <div className="px-5 py-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate mb-3">
                              Noticeboard ({content.noticeboard.length})
                            </p>
                            {content.noticeboard.length === 0 ? (
                              <p className="text-sm text-slate italic">No posts yet.</p>
                            ) : (
                              <div className="space-y-2.5">
                                {content.noticeboard.slice(0, 5).map((notice) => (
                                  <div key={notice.id} className="bg-snow/60 rounded-xl p-3 border border-navy/10">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <p className="text-sm font-bold text-navy leading-snug line-clamp-1">{notice.title}</p>
                                      {notice.isPinned && (
                                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-navy text-snow text-[9px] font-bold uppercase tracking-wider">Pinned</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate line-clamp-2">{notice.content}</p>
                                    <p className="text-[10px] text-slate/70 mt-1.5">{formatDate(notice.createdAt)}{notice.authorName && ` · ${notice.authorName}`}</p>
                                  </div>
                                ))}
                                {content.noticeboard.length > 5 && (
                                  <p className="text-xs text-slate text-center pt-1">+{content.noticeboard.length - 5} more</p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Tasks */}
                          <div className="px-5 py-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate">
                                Tasks ({content.taskSummary.total})
                              </p>
                              {content.taskSummary.total > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <div className="h-1.5 rounded-full bg-cloud overflow-hidden w-16">
                                    <div
                                      className="h-full bg-teal rounded-full transition-all"
                                      style={{ width: `${content.taskSummary.completionRate}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-teal">{content.taskSummary.completionRate}%</span>
                                </div>
                              )}
                            </div>
                            {content.taskSummary.total > 0 && (
                              <div className="flex items-center gap-1.5 mb-3">
                                <span className="px-2 py-0.5 rounded-full bg-sunny/20 text-navy text-[10px] font-bold">{content.taskSummary.pending} pending</span>
                                <span className="px-2 py-0.5 rounded-full bg-lavender/20 text-navy text-[10px] font-bold">{content.taskSummary.in_progress} in progress</span>
                                <span className="px-2 py-0.5 rounded-full bg-teal/20 text-teal text-[10px] font-bold">{content.taskSummary.done} done</span>
                              </div>
                            )}
                            {content.tasks.length === 0 ? (
                              <p className="text-sm text-slate italic">No tasks yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {content.tasks.slice(0, 6).map((task) => (
                                  <div key={task.id} className="bg-snow/60 rounded-xl p-3 border border-navy/10">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <p className="text-sm font-bold text-navy leading-snug line-clamp-1">{task.title}</p>
                                      <div className="shrink-0 flex items-center gap-1">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${priorityColor[task.priority] || "bg-ghost text-slate"}`}>{task.priority}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${taskStatusColor[task.status] || ""}`}>{task.status.replace("_", " ")}</span>
                                      </div>
                                    </div>
                                    {task.description && <p className="text-xs text-slate line-clamp-1">{task.description}</p>}
                                    <p className="text-[10px] text-slate/70 mt-1">
                                      {formatDate(task.createdAt)}{task.createdByName && ` · by ${task.createdByName}`}
                                      {task.dueDate && <span className="text-coral"> · due {task.dueDate.slice(0, 10)}</span>}
                                    </p>
                                  </div>
                                ))}
                                {content.tasks.length > 6 && (
                                  <p className="text-xs text-slate text-center pt-1">+{content.tasks.length - 6} more</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ══════════════ Modals ══════════════ */}

      {/* Settings */}
      <Modal isOpen={!!settingsUnit} onClose={() => setSettingsUnit(null)} title={`${settingsUnit?.unitLabel} Settings`}>
        {settingsUnit && (
          <div className="space-y-5 p-1">
            <div>
              <label className="block text-sm font-bold text-navy mb-1">Max Members</label>
              <p className="text-xs text-slate mb-2">Set to 0 for unlimited.</p>
              <input type="number" min={0} max={500} value={settingsMaxMembers} onChange={(e) => setSettingsMaxMembers(Number(e.target.value))}
                aria-label="Maximum members" className="w-full px-4 py-2.5 rounded-xl border-[3px] border-navy/20 bg-snow text-navy font-medium focus:border-navy outline-none" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setSettingsIsOpen(!settingsIsOpen)} title={settingsIsOpen ? "Close applications" : "Open applications"}
                className={`relative w-12 h-7 rounded-full transition-colors border-[2px] ${settingsIsOpen ? "bg-teal border-teal" : "bg-cloud border-navy/20"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-snow shadow transition-transform ${settingsIsOpen ? "translate-x-5" : ""}`} />
              </button>
              <span className="text-sm font-bold text-navy">{settingsIsOpen ? "Accepting applications" : "Applications closed"}</span>
            </div>
            <button onClick={saveSettings} disabled={savingSettings}
              className="w-full bg-lime border-[4px] border-navy px-6 py-3 rounded-2xl font-display font-black text-navy press-5 press-navy disabled:opacity-50">
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </Modal>

      {/* Create Team */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setCreateForm({ label: "", description: "", colorKey: "teal" }); }} title="Create New Team">
        <div className="space-y-4 p-1">
          <div>
            <label className="block text-sm font-bold text-navy mb-1">Name <span className="text-coral">*</span></label>
            <input type="text" value={createForm.label} onChange={(e) => setCreateForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Entrepreneurship Team" maxLength={80}
              className="w-full px-4 py-2.5 rounded-xl border-[3px] border-navy/20 bg-snow text-navy font-medium focus:border-navy outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-navy mb-1">Description <span className="text-slate font-normal">(optional)</span></label>
            <textarea value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this team's purpose..." rows={3} maxLength={500}
              className="w-full px-4 py-2.5 rounded-xl border-[3px] border-navy/20 bg-snow text-navy text-sm focus:border-navy outline-none resize-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-navy mb-2">Colour Theme</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c.key} onClick={() => setCreateForm((f) => ({ ...f, colorKey: c.key }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-[2px] text-xs font-bold transition-all ${createForm.colorKey === c.key ? "border-lime bg-navy text-snow" : "border-navy/20 text-navy hover:border-navy/40"}`}>
                  <span className={`w-3 h-3 rounded-full ${c.dot}`} />{c.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleCreateUnit} disabled={creating || !createForm.label.trim()}
            className="w-full bg-lime border-[4px] border-navy px-6 py-3 rounded-2xl font-display font-black text-navy press-5 press-navy disabled:opacity-50">
            {creating ? "Creating..." : "Create Team"}
          </button>
        </div>
      </Modal>

      {/* Edit Team */}
      <Modal isOpen={!!editingUnit} onClose={() => setEditingUnit(null)} title={`Edit: ${editingUnit?.label}`}>
        <div className="space-y-4 p-1">
          <div>
            <label className="block text-sm font-bold text-navy mb-1">Name <span className="text-coral">*</span></label>
            <input type="text" value={editForm.label} onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))} maxLength={80}
              className="w-full px-4 py-2.5 rounded-xl border-[3px] border-navy/20 bg-snow text-navy font-medium focus:border-navy outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-navy mb-1">Description</label>
            <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={3} maxLength={500}
              className="w-full px-4 py-2.5 rounded-xl border-[3px] border-navy/20 bg-snow text-navy text-sm focus:border-navy outline-none resize-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-navy mb-2">Colour Theme</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c.key} onClick={() => setEditForm((f) => ({ ...f, colorKey: c.key }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-[2px] text-xs font-bold transition-all ${editForm.colorKey === c.key ? "border-lime bg-navy text-snow" : "border-navy/20 text-navy hover:border-navy/40"}`}>
                  <span className={`w-3 h-3 rounded-full ${c.dot}`} />{c.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleEditUnit} disabled={editSaving || !editForm.label.trim()}
            className="w-full bg-lime border-[4px] border-navy px-6 py-3 rounded-2xl font-display font-black text-navy press-5 press-navy disabled:opacity-50">
            {editSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteConfirmUnit}
        onClose={() => setDeleteConfirmUnit(null)}
        onConfirm={handleDeleteUnit}
        title="Delete Team"
        message={`Delete "${deleteConfirmUnit?.label}"? This cannot be undone. Teams with active members cannot be deleted.`}
        confirmLabel={deleting ? "Deleting..." : "Delete Team"}
        variant="danger"
      />

      {/* Set Head */}
      <Modal isOpen={!!setHeadUnit} onClose={() => { setSetHeadUnit(null); setHeadSearch(""); setHeadSearchResults([]); }} title={`Assign Head — ${setHeadUnit?.label}`}>
        <div className="space-y-4 p-1">
          <div>
            <label className="block text-sm font-bold text-navy mb-1">Search for a user</label>
            <div className="relative">
              <input type="text" value={headSearch} onChange={(e) => handleHeadSearchChange(e.target.value)}
                placeholder="Name, email, or matric number..."
                className="w-full px-4 py-2.5 rounded-xl border-[3px] border-navy/20 bg-snow text-navy font-medium focus:border-navy outline-none pr-10" />
              {headSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-[2px] border-navy border-t-transparent" />
                </div>
              )}
            </div>
          </div>
          {headSearchResults.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {headSearchResults.map((u) => (
                <button key={u.id} onClick={() => handleSetHead(u)} disabled={assigningHead}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-[2px] border-navy/10 hover:border-navy hover:bg-ghost text-left transition-all disabled:opacity-50">
                  {u.profilePhotoURL ? (
                    <Image src={u.profilePhotoURL} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover border-2 border-navy/20 shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-xs font-bold text-navy shrink-0">
                      {u.firstName?.[0]}{u.lastName?.[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-navy truncate">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-slate truncate">{u.email}{u.matricNumber && ` · ${u.matricNumber}`}{u.level && ` · ${u.level}`}</p>
                  </div>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${u.role === "admin" ? "bg-lime/30 text-navy" : u.role === "exco" ? "bg-lavender/30 text-navy" : "bg-ghost text-slate"}`}>
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          ) : headSearch.length >= 2 && !headSearching ? (
            <p className="text-sm text-slate text-center py-4">No users found matching &quot;{headSearch}&quot;</p>
          ) : headSearch.length < 2 ? (
            <p className="text-xs text-slate">Type at least 2 characters to search</p>
          ) : null}
        </div>
      </Modal>

      {/* Review */}
      <Modal isOpen={!!reviewApp} onClose={() => setReviewApp(null)} title="Review Application">
        {reviewApp && (
          <div className="space-y-4 p-1">
            <div>
              <p className="font-bold text-navy">{reviewApp.userName}</p>
              <p className="text-xs text-slate">{reviewApp.userEmail}{reviewApp.userLevel ? ` · ${reviewApp.userLevel}` : ""}</p>
              <p className="text-xs font-bold text-navy/60 mt-1">{reviewApp.unitLabel}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-navy/60 mb-1">Motivation</p>
              <p className="text-sm text-navy/80 bg-ghost rounded-xl p-3">{reviewApp.motivation}</p>
            </div>
            {reviewApp.skills && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-navy/60 mb-1">Skills</p>
                <p className="text-sm text-navy/80 bg-ghost rounded-xl p-3">{reviewApp.skills}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-navy mb-1">Decision</label>
              <div className="flex gap-2">
                <button onClick={() => setReviewStatus("accepted")}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm border-[3px] transition-all ${reviewStatus === "accepted" ? "bg-teal text-navy border-navy" : "bg-snow text-navy border-navy/20 hover:border-navy/40"}`}>Accept</button>
                <button onClick={() => setReviewStatus("rejected")}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm border-[3px] transition-all ${reviewStatus === "rejected" ? "bg-coral text-snow border-navy" : "bg-snow text-navy border-navy/20 hover:border-navy/40"}`}>Reject</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-navy mb-1">Feedback <span className="text-slate font-normal">(optional)</span></label>
              <textarea value={reviewFeedback} onChange={(e) => setReviewFeedback(e.target.value)} maxLength={500} rows={3}
                placeholder="Add feedback for the applicant..."
                className="w-full px-4 py-2.5 rounded-xl border-[3px] border-navy/20 bg-snow text-navy text-sm focus:border-navy outline-none resize-none" />
            </div>
            <button onClick={handleReview} disabled={reviewing}
              className={`w-full border-[4px] border-navy px-6 py-3 rounded-2xl font-display font-black press-5 press-navy disabled:opacity-50 ${reviewStatus === "accepted" ? "bg-teal text-navy" : "bg-coral text-snow"}`}>
              {reviewing ? "Processing..." : reviewStatus === "accepted" ? "Accept Application" : "Reject Application"}
            </button>
          </div>
        )}
      </Modal>

      {/* Revoke */}
      <ConfirmModal
        isOpen={revokeConfirm.isOpen}
        onClose={() => setRevokeConfirm({ isOpen: false, member: null, unit: null })}
        onConfirm={handleRevoke}
        title="Remove Member"
        message={`Remove ${revokeConfirm.member?.firstName} ${revokeConfirm.member?.lastName} from ${revokeConfirm.unit?.unitLabel}? Their role will be deactivated and they will be notified.`}
        confirmLabel={revoking ? "Removing..." : "Remove"}
        variant="danger"
      />
    </div>
  );
}

export default withAuth(TeamsPage, { requiredPermission: "team:review" });
