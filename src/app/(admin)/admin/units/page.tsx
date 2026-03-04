"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { withAuth } from "@/lib/withAuth";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { toast } from "sonner";
import Image from "next/image";

/* ─── Types ────────────────────────────────────── */

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
  id: string;
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

/* ─── Helpers ──────────────────────────────────── */

const UNIT_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  press:               { bg: "bg-coral-light",    border: "border-coral",    badge: "bg-coral"    },
  ics:                 { bg: "bg-lavender-light", border: "border-lavender", badge: "bg-lavender" },
  committee_academic:  { bg: "bg-lavender-light", border: "border-lavender", badge: "bg-lavender" },
  committee_welfare:   { bg: "bg-teal-light",     border: "border-teal",     badge: "bg-teal"     },
  committee_sports:    { bg: "bg-sunny-light",    border: "border-sunny",    badge: "bg-sunny"    },
  committee_socials:   { bg: "bg-lime-light",     border: "border-lime",     badge: "bg-lime"     },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ─── Component ────────────────────────────────── */

type Tab = "overview" | "applications";

function UnitsPage() {
  const { getAccessToken } = useAuth();

  const [tab, setTab] = useState<Tab>("overview");
  const [units, setUnits] = useState<UnitOverview[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [appTotal, setAppTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [appLoading, setAppLoading] = useState(false);

  // Filters
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
  const [revokeConfirm, setRevokeConfirm] = useState<{ isOpen: boolean; member: UnitMember | null; unit: UnitOverview | null }>({
    isOpen: false,
    member: null,
    unit: null,
  });
  const [revoking, setRevoking] = useState(false);

  // Expanded unit cards
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  /* ── Fetch overview ─────────────── */
  const fetchOverview = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(getApiUrl("/api/v1/unit-applications/overview"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch units overview");
      const data = await res.json();
      setUnits(data);
    } catch {
      toast.error("Failed to load units overview");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  /* ── Fetch applications ─────────── */
  const fetchApplications = useCallback(async () => {
    setAppLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const params = new URLSearchParams();
      if (filterUnit) params.set("unit", filterUnit);
      if (filterStatus) params.set("status", filterStatus);
      params.set("limit", "50");
      const res = await fetch(getApiUrl(`/api/v1/unit-applications/?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch applications");
      const data = await res.json();
      setApplications(data.items || []);
      setAppTotal(data.total || 0);
    } catch {
      toast.error("Failed to load applications");
    } finally {
      setAppLoading(false);
    }
  }, [getAccessToken, filterUnit, filterStatus]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (tab === "applications") fetchApplications();
  }, [tab, fetchApplications]);

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
      const res = await fetch(getApiUrl(`/api/v1/unit-applications/settings/${settingsUnit.unit}`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ maxMembers: settingsMaxMembers, isOpen: settingsIsOpen }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update settings");
      }
      toast.success("Settings updated");
      setSettingsUnit(null);
      fetchOverview();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update settings");
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
      const res = await fetch(getApiUrl(`/api/v1/unit-applications/${reviewApp.id}/review`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewStatus, feedback: reviewFeedback || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Review failed");
      }
      toast.success(`Application ${reviewStatus}`);
      setReviewApp(null);
      setReviewFeedback("");
      fetchApplications();
      fetchOverview();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Review failed");
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
      // Find the accepted application for this member in this unit
      const params = new URLSearchParams({ unit: unit.unit, status: "accepted", search: member.email, limit: "1" });
      const searchRes = await fetch(getApiUrl(`/api/v1/unit-applications/?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const searchData = await searchRes.json();
      const app = searchData.items?.[0];
      if (!app) {
        toast.error("Could not find the member's application");
        return;
      }

      const res = await fetch(getApiUrl(`/api/v1/unit-applications/${app.id}/revoke`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Revoke failed");
      }
      toast.success(`Removed ${member.firstName} from ${unit.unitLabel}`);
      setRevokeConfirm({ isOpen: false, member: null, unit: null });
      fetchOverview();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setRevoking(false);
    }
  };

  /* ── Toggle expanded ────────────── */
  const toggleExpanded = (unit: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unit)) next.delete(unit);
      else next.add(unit);
      return next;
    });
  };

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
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-black text-display-lg text-navy">
          Units & <span className="brush-highlight">Committees</span>
        </h1>
        <p className="text-slate mt-2">
          Manage committee heads, members, applications, and capacity.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("overview")}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm border-[3px] transition-all ${
            tab === "overview"
              ? "bg-navy text-snow border-navy"
              : "bg-snow text-navy border-navy/20 hover:border-navy/40"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("applications")}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm border-[3px] transition-all flex items-center gap-2 ${
            tab === "applications"
              ? "bg-navy text-snow border-navy"
              : "bg-snow text-navy border-navy/20 hover:border-navy/40"
          }`}
        >
          Applications
          {totalPending > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-coral text-snow text-xs font-bold min-w-[20px]">
              {totalPending}
            </span>
          )}
        </button>
      </div>

      {/* ── Overview Tab ─────────────── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {units.map((unit) => {
            const colors = UNIT_COLORS[unit.unit] || { bg: "bg-ghost", border: "border-cloud", badge: "bg-slate" };
            const isExpanded = expandedUnits.has(unit.unit);

            return (
              <div
                key={unit.unit}
                className={`${colors.bg} border-[4px] ${colors.border} rounded-3xl overflow-hidden shadow-[6px_6px_0_0_#000]`}
              >
                {/* Card Header */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display font-black text-lg text-navy">{unit.unitLabel}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          unit.isOpen ? "bg-teal/20 text-teal" : "bg-coral/20 text-coral"
                        }`}>
                          {unit.isOpen ? "Open" : "Closed"}
                        </span>
                        {unit.pendingApplications > 0 && (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-coral/20 text-coral text-[10px] font-bold">
                            {unit.pendingApplications} pending
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => openSettings(unit)}
                      className="p-1.5 rounded-lg hover:bg-navy/10 transition-colors"
                      title="Unit settings"
                    >
                      <svg className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Head */}
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-navy/60 mb-1">Head</p>
                    {unit.head ? (
                      <div className="flex items-center gap-2">
                        {unit.head.profilePhotoURL ? (
                          <Image
                            src={unit.head.profilePhotoURL}
                            alt=""
                            width={28}
                            height={28}
                            className="w-7 h-7 rounded-full object-cover border-2 border-navy/20"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy">
                            {unit.head.firstName?.[0]}{unit.head.lastName?.[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-navy truncate">
                            {unit.head.firstName} {unit.head.lastName}
                          </p>
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
                      {unit.maxMembers > 0 && (
                        <span className="text-slate font-normal"> / {unit.maxMembers} max</span>
                      )}
                    </p>
                    {unit.memberCount > 0 && (
                      <button
                        onClick={() => toggleExpanded(unit.unit)}
                        className="text-xs font-bold text-navy underline underline-offset-2 hover:text-navy/70"
                      >
                        {isExpanded ? "Hide" : "Show"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded members list */}
                {isExpanded && unit.members.length > 0 && (
                  <div className="border-t-[3px] border-navy/10 px-5 py-3 space-y-2 max-h-60 overflow-y-auto">
                    {unit.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {m.profilePhotoURL ? (
                            <Image
                              src={m.profilePhotoURL}
                              alt=""
                              width={24}
                              height={24}
                              className="w-6 h-6 rounded-full object-cover border border-navy/20"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center text-[9px] font-bold text-navy">
                              {m.firstName?.[0]}{m.lastName?.[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-navy truncate">
                              {m.firstName} {m.lastName}
                              {m.level && <span className="font-normal text-slate ml-1">({m.level})</span>}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setRevokeConfirm({ isOpen: true, member: m, unit })}
                          className="shrink-0 p-1 rounded hover:bg-coral/20 transition-colors"
                          title="Remove member"
                        >
                          <svg className="w-4 h-4 text-coral" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {units.length === 0 && (
            <div className="col-span-full text-center py-16">
              <p className="text-slate font-medium">No units available</p>
            </div>
          )}
        </div>
      )}

      {/* ── Applications Tab ─────────── */}
      {tab === "applications" && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              aria-label="Filter by unit"
              className="px-3 py-2 rounded-xl border-[3px] border-navy/20 bg-snow text-sm font-medium text-navy focus:border-navy outline-none"
            >
              <option value="">All Units</option>
              {units.map((u) => (
                <option key={u.unit} value={u.unit}>{u.unitLabel}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter by status"
              className="px-3 py-2 rounded-xl border-[3px] border-navy/20 bg-snow text-sm font-medium text-navy focus:border-navy outline-none"
            >
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="revoked">Revoked</option>
              <option value="">All Statuses</option>
            </select>
          </div>

          {/* App list */}
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
                const colors = UNIT_COLORS[app.unit] || { bg: "bg-ghost", badge: "bg-slate" };
                const statusColors: Record<string, string> = {
                  pending: "bg-sunny/20 text-navy",
                  accepted: "bg-teal/20 text-teal",
                  rejected: "bg-coral/20 text-coral",
                  revoked: "bg-slate/20 text-slate",
                };

                return (
                  <div
                    key={app.id}
                    className="bg-snow border-[3px] border-navy/10 rounded-2xl p-4 hover:border-navy/20 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-navy">{app.userName}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[app.status] || ""}`}>
                            {app.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate">{app.userEmail}{app.userLevel ? ` · ${app.userLevel}` : ""}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-navy ${colors.bg}`}>
                            {app.unitLabel}
                          </span>
                          <span className="text-[11px] text-slate">{formatDate(app.createdAt)}</span>
                        </div>
                      </div>
                      {app.status === "pending" && (
                        <button
                          onClick={() => {
                            setReviewApp(app);
                            setReviewStatus("accepted");
                            setReviewFeedback("");
                          }}
                          className="shrink-0 bg-lime border-[3px] border-navy px-4 py-2 rounded-xl font-bold text-sm text-navy press-3 press-navy"
                        >
                          Review
                        </button>
                      )}
                    </div>

                    {/* Motivation preview */}
                    <p className="mt-2 text-sm text-navy/80 line-clamp-2">{app.motivation}</p>

                    {app.feedback && (
                      <p className="mt-1.5 text-xs text-slate italic">
                        Feedback: {app.feedback}
                        {app.reviewerName && <span> — {app.reviewerName}</span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Settings Modal ────────────── */}
      <Modal isOpen={!!settingsUnit} onClose={() => setSettingsUnit(null)} title={`${settingsUnit?.unitLabel} Settings`}>
        {settingsUnit && (
          <div className="space-y-5 p-1">
            <div>
              <label className="block text-sm font-bold text-navy mb-1">Max Members</label>
              <p className="text-xs text-slate mb-2">Set to 0 for unlimited.</p>
              <input
                type="number"
                min={0}
                max={500}
                value={settingsMaxMembers}
                onChange={(e) => setSettingsMaxMembers(Number(e.target.value))}
                aria-label="Maximum members"
                className="w-full px-4 py-2.5 rounded-xl border-[3px] border-navy/20 bg-snow text-navy font-medium focus:border-navy outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSettingsIsOpen(!settingsIsOpen)}
                title={settingsIsOpen ? "Close applications" : "Open applications"}
                className={`relative w-12 h-7 rounded-full transition-colors border-[2px] ${
                  settingsIsOpen ? "bg-teal border-teal" : "bg-cloud border-navy/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-snow shadow transition-transform ${
                    settingsIsOpen ? "translate-x-5" : ""
                  }`}
                />
              </button>
              <span className="text-sm font-bold text-navy">
                {settingsIsOpen ? "Accepting applications" : "Applications closed"}
              </span>
            </div>
            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="w-full bg-lime border-[4px] border-navy px-6 py-3 rounded-2xl font-display font-black text-navy press-5 press-navy disabled:opacity-50"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </Modal>

      {/* ── Review Modal ──────────────── */}
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
                <button
                  onClick={() => setReviewStatus("accepted")}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm border-[3px] transition-all ${
                    reviewStatus === "accepted"
                      ? "bg-teal text-navy border-navy"
                      : "bg-snow text-navy border-navy/20 hover:border-navy/40"
                  }`}
                >
                  Accept
                </button>
                <button
                  onClick={() => setReviewStatus("rejected")}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm border-[3px] transition-all ${
                    reviewStatus === "rejected"
                      ? "bg-coral text-snow border-navy"
                      : "bg-snow text-navy border-navy/20 hover:border-navy/40"
                  }`}
                >
                  Reject
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-navy mb-1">Feedback (optional)</label>
              <textarea
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Add feedback for the applicant..."
                className="w-full px-4 py-2.5 rounded-xl border-[3px] border-navy/20 bg-snow text-navy text-sm focus:border-navy outline-none resize-none"
              />
            </div>
            <button
              onClick={handleReview}
              disabled={reviewing}
              className={`w-full border-[4px] border-navy px-6 py-3 rounded-2xl font-display font-black press-5 press-navy disabled:opacity-50 ${
                reviewStatus === "accepted" ? "bg-teal text-navy" : "bg-coral text-snow"
              }`}
            >
              {reviewing ? "Processing..." : reviewStatus === "accepted" ? "Accept Application" : "Reject Application"}
            </button>
          </div>
        )}
      </Modal>

      {/* ── Revoke Confirm ────────────── */}
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

export default withAuth(UnitsPage, { requiredPermission: "unit_application:review" });
