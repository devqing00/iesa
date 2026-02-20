"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

/* ─── Types ────────────────────────────────────── */

interface AuditLogEntry {
  id: string;
  action: string;
  actor: { id: string; email: string };
  resource: { type: string; id?: string };
  sessionId?: string;
  details: Record<string, unknown>;
  metadata: { ipAddress?: string; userAgent?: string };
  timestamp: string;
}

/* ─── Helpers ───────────────────────────────────── */

const ACTION_COLORS: Record<string, string> = {
  created: "bg-teal-light text-teal border-[2px] border-teal",
  updated: "bg-lavender-light text-lavender border-[2px] border-lavender",
  activated: "bg-lime-light text-navy border-[2px] border-navy",
  deleted: "bg-coral-light text-coral border-[2px] border-coral",
  changed: "bg-sunny-light text-navy border-[2px] border-navy",
  assigned: "bg-teal-light text-teal border-[2px] border-teal",
  revoked: "bg-coral-light text-coral border-[2px] border-coral",
};

function getActionColor(action: string): string {
  const suffix = action.split(".")[1] ?? "";
  for (const [key, cls] of Object.entries(ACTION_COLORS)) {
    if (suffix.includes(key)) return cls;
  }
  return "bg-ghost text-navy border-[2px] border-cloud";
}

function formatAction(action: string): string {
  return action.replace(/\./g, " › ").replace(/_/g, " ");
}

function formatTimestamp(ts: string): { date: string; time: string } {
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

const RESOURCE_TYPES = ["", "user", "session", "payment", "enrollment", "event", "announcement", "grade", "role"];

const ACTION_TYPES = [
  "",
  "user.created", "user.deleted", "user.role_changed",
  "session.created", "session.updated", "session.activated", "session.deleted",
  "payment.created", "payment.approved", "payment.deleted",
  "enrollment.created", "enrollment.updated", "enrollment.deleted",
  "event.created", "event.updated", "event.deleted",
  "announcement.created", "announcement.updated", "announcement.deleted",
  "grade.created", "grade.updated", "grade.deleted",
  "role.assigned", "role.revoked",
];

const LIMIT = 25;

/* ─── Component ─────────────────────────────────── */

export default function AuditLogsPage() {
  const { getAccessToken } = useAuth();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0); // page = skip index

  /* Filters */
  const [actionFilter, setActionFilter] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [actorSearch, setActorSearch] = useState("");
  const [actorQuery, setActorQuery] = useState("");

  /* Expanded row */
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async (skip: number) => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({
        limit: String(LIMIT),
        skip: String(skip),
      });
      if (actionFilter) params.set("action", actionFilter);
      if (resourceTypeFilter) params.set("resource_type", resourceTypeFilter);

      const res = await fetch(getApiUrl(`/api/v1/audit-logs/?${params}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        if (res.status === 403) {
          toast.error("You don't have permission to view audit logs");
        } else {
          toast.error("Failed to load audit logs");
        }
        return;
      }

      const data: AuditLogEntry[] = await res.json();
      setLogs(data);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, actionFilter, resourceTypeFilter]);

  useEffect(() => {
    setPage(0);
  }, [actionFilter, resourceTypeFilter]);

  useEffect(() => {
    fetchLogs(page * LIMIT);
  }, [fetchLogs, page]);

  /* Client-side filter for actor email search */
  const displayedLogs = actorQuery
    ? logs.filter((l) => l.actor.email.toLowerCase().includes(actorQuery.toLowerCase()))
    : logs;

  /* Export CSV */
  const exportCSV = () => {
    const headers = ["Timestamp", "Actor Email", "Action", "Resource Type", "Resource ID", "Details"];
    const rows = logs.map((l) => [
      new Date(l.timestamp).toISOString(),
      l.actor.email,
      l.action,
      l.resource.type,
      l.resource.id ?? "",
      JSON.stringify(l.details),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSkip = page * LIMIT;
  const hasNext = logs.length === LIMIT;
  const hasPrev = page > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-label uppercase tracking-wider text-slate mb-1">Admin › System</p>
          <h1 className="font-display font-black text-display-lg text-navy leading-tight">
            Audit <span className="brush-highlight">Logs</span>
          </h1>
          <p className="text-slate mt-2 font-normal">
            Immutable trail of all administrative actions across the platform.
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="shrink-0 bg-lime border-[4px] border-navy shadow-[5px_5px_0_0_#0F0F2D] px-5 py-3 rounded-2xl font-display text-navy text-sm hover:shadow-[8px_8px_0_0_#0F0F2D] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "This page", value: logs.length, color: "bg-lavender-light border-lavender" },
          { label: "Offset", value: currentSkip, color: "bg-lime-light border-navy" },
          { label: "Action filter", value: actionFilter || "All", color: "bg-sunny-light border-navy" },
          { label: "Resource filter", value: resourceTypeFilter || "All", color: "bg-teal-light border-teal" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border-[3px] p-4 ${s.color}`}>
            <p className="text-label text-slate uppercase tracking-wider text-xs">{s.label}</p>
            <p className="font-display font-black text-2xl text-navy truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
        <p className="font-display font-black text-lg text-navy mb-4">Filter Logs</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Actor search */}
          <div>
            <label className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Actor Email</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by email…"
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setActorQuery(actorSearch)}
                className="flex-1 bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 font-normal text-navy placeholder:text-slate text-sm focus:outline-none focus:border-lime"
              />
              <button
                onClick={() => setActorQuery(actorSearch)}
                className="bg-navy text-lime border-[3px] border-navy rounded-xl px-3 py-2 text-sm font-display hover:bg-navy-light transition-colors"
              >
                Go
              </button>
            </div>
          </div>

          {/* Resource type */}
          <div>
            <label className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Resource Type</label>
            <select
              value={resourceTypeFilter}
              onChange={(e) => setResourceTypeFilter(e.target.value)}
              className="w-full bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 font-normal text-navy text-sm focus:outline-none focus:border-lime appearance-none"
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>{t || "All resource types"}</option>
              ))}
            </select>
          </div>

          {/* Action */}
          <div>
            <label className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 font-normal text-navy text-sm focus:outline-none focus:border-lime appearance-none"
            >
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>{a ? formatAction(a) : "All actions"}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear filters */}
        {(actionFilter || resourceTypeFilter || actorQuery) && (
          <button
            onClick={() => { setActionFilter(""); setResourceTypeFilter(""); setActorSearch(""); setActorQuery(""); }}
            className="mt-4 text-sm text-coral font-display hover:underline"
          >
            ✕ Clear all filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-[4px] border-navy border-t-lime rounded-full animate-spin" />
          </div>
        ) : displayedLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <svg className="w-12 h-12 text-cloud" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
            </svg>
            <p className="font-display font-black text-xl text-navy">No logs found</p>
            <p className="text-slate text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-[4px] border-navy bg-ghost">
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Timestamp</th>
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Actor</th>
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Action</th>
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Resource</th>
                  <th className="text-left px-5 py-4 font-display font-black text-navy text-xs uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody>
                {displayedLogs.map((log, idx) => {
                  const { date, time } = formatTimestamp(log.timestamp);
                  const isExpanded = expandedId === log.id;
                  return (
                    <>
                      <tr
                        key={log.id}
                        className={`border-b-[2px] border-cloud cursor-pointer transition-colors ${
                          isExpanded ? "bg-lime-light" : idx % 2 === 0 ? "bg-snow hover:bg-ghost" : "bg-ghost hover:bg-lime-light/40"
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        {/* Timestamp */}
                        <td className="px-5 py-3 whitespace-nowrap">
                          <p className="font-display font-black text-navy text-xs">{date}</p>
                          <p className="text-slate text-xs font-normal">{time}</p>
                        </td>

                        {/* Actor */}
                        <td className="px-5 py-3">
                          <p className="text-navy font-normal truncate max-w-[180px]">{log.actor.email}</p>
                          <p className="text-slate text-xs font-normal truncate max-w-[180px]">{log.actor.id}</p>
                        </td>

                        {/* Action badge */}
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`inline-block px-3 py-1 rounded-lg text-xs font-display font-black ${getActionColor(log.action)}`}>
                            {formatAction(log.action)}
                          </span>
                        </td>

                        {/* Resource */}
                        <td className="px-5 py-3">
                          <p className="text-navy font-display font-black text-xs uppercase tracking-wider">{log.resource.type}</p>
                          {log.resource.id && (
                            <p className="text-slate text-xs font-normal truncate max-w-[120px]">{log.resource.id}</p>
                          )}
                        </td>

                        {/* Details preview */}
                        <td className="px-5 py-3">
                          <span className="text-slate text-xs font-normal">
                            {Object.keys(log.details).length > 0
                              ? Object.keys(log.details).slice(0, 2).join(", ") + (Object.keys(log.details).length > 2 ? "…" : "")
                              : "—"}
                          </span>
                          <svg
                            className={`inline-block ml-2 w-3 h-3 text-slate transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr key={`${log.id}-detail`} className="bg-lime-light border-b-[2px] border-cloud">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                              {/* Details */}
                              <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[4px_4px_0_0_#000]">
                                <p className="font-display font-black text-navy uppercase tracking-wider mb-2 text-xs">Details</p>
                                {Object.keys(log.details).length === 0 ? (
                                  <p className="text-slate">No details recorded</p>
                                ) : (
                                  <dl className="space-y-1">
                                    {Object.entries(log.details).map(([k, v]) => (
                                      <div key={k} className="flex gap-2">
                                        <dt className="text-slate shrink-0 capitalize">{k}:</dt>
                                        <dd className="text-navy font-normal truncate">{String(v)}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                )}
                              </div>

                              {/* Metadata */}
                              <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[4px_4px_0_0_#000]">
                                <p className="font-display font-black text-navy uppercase tracking-wider mb-2 text-xs">Metadata</p>
                                <dl className="space-y-1">
                                  <div className="flex gap-2">
                                    <dt className="text-slate shrink-0">IP:</dt>
                                    <dd className="text-navy font-normal">{log.metadata.ipAddress ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-slate mb-1">User Agent:</dt>
                                    <dd className="text-navy font-normal break-all">{log.metadata.userAgent ?? "—"}</dd>
                                  </div>
                                </dl>
                              </div>

                              {/* IDs */}
                              <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[4px_4px_0_0_#000]">
                                <p className="font-display font-black text-navy uppercase tracking-wider mb-2 text-xs">References</p>
                                <dl className="space-y-1">
                                  <div className="flex gap-2">
                                    <dt className="text-slate shrink-0">Log ID:</dt>
                                    <dd className="text-navy font-normal font-mono truncate">{log.id}</dd>
                                  </div>
                                  <div className="flex gap-2">
                                    <dt className="text-slate shrink-0">Session:</dt>
                                    <dd className="text-navy font-normal font-mono truncate">{log.sessionId ?? "—"}</dd>
                                  </div>
                                  <div className="flex gap-2">
                                    <dt className="text-slate shrink-0">Actor ID:</dt>
                                    <dd className="text-navy font-normal font-mono truncate">{log.actor.id}</dd>
                                  </div>
                                </dl>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-between">
          <p className="text-slate text-sm font-normal">
            Showing {currentSkip + 1}–{currentSkip + displayedLogs.length}
            {actorQuery && <span className="ml-1 text-coral">(filtered by actor)</span>}
          </p>
          <div className="flex gap-3">
            <button
              disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)}
              className="bg-snow border-[3px] border-navy rounded-xl px-4 py-2 font-display text-sm text-navy shadow-[4px_4px_0_0_#000] hover:shadow-[6px_6px_0_0_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0_0_#000] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              ← Previous
            </button>
            <button
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="bg-lime border-[3px] border-navy rounded-xl px-4 py-2 font-display text-sm text-navy shadow-[4px_4px_0_0_#0F0F2D] hover:shadow-[6px_6px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0_0_#0F0F2D] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
