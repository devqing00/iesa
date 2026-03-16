"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { withAuth, PermissionGate } from "@/lib/withAuth";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { throwApiError, getErrorMessage } from "@/lib/adminApiError";

/* ── Types ────────────────────────────────────── */

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

function formatDetailKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stringifyDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

const RESOURCE_TYPES = ["", "user", "session", "payment", "enrollment", "event", "announcement", "role"];

const ACTION_TYPES = [
  "",
  "user.created", "user.deleted", "user.role_changed",
  "session.created", "session.updated", "session.activated", "session.deleted",
  "payment.created", "payment.approved", "payment.deleted",
  "enrollment.created", "enrollment.updated", "enrollment.deleted",
  "event.created", "event.updated", "event.deleted",
  "announcement.created", "announcement.updated", "announcement.deleted",
  "role.assigned", "role.revoked",
];

const LIMIT = 25;

/* ─── Component ─────────────────────────────────── */

function AuditLogsPage() {
  const { getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-audit-logs");

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [page, setPage] = useState(0); // page = skip index

  /* Filters */
  const [actionFilter, setActionFilter] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [actorSearch, setActorSearch] = useState("");
  const [actorQuery, setActorQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
      if (actorQuery) params.set("actor_email", actorQuery);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);

      const res = await fetch(getApiUrl(`/api/v1/audit-logs/?${params}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) await throwApiError(res, "load audit logs");

      const data: AuditLogEntry[] = await res.json();
      setLogs(data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load audit logs"));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, actionFilter, resourceTypeFilter, actorQuery, fromDate, toDate]);

  useEffect(() => {
    setPage(0);
  }, [actionFilter, resourceTypeFilter, actorQuery, fromDate, toDate]);

  useEffect(() => {
    fetchLogs(page * LIMIT);
  }, [fetchLogs, page]);

  /* Actor search is now server-side — displayedLogs = logs directly */
  const displayedLogs = logs;

  const actionOptions = useMemo(() => {
    const base = ACTION_TYPES.filter(Boolean);
    const dynamic = logs.map((entry) => entry.action).filter(Boolean);
    return ["", ...Array.from(new Set([...base, ...dynamic])).sort((a, b) => a.localeCompare(b))];
  }, [logs]);

  const resourceTypeOptions = useMemo(() => {
    const base = RESOURCE_TYPES.filter(Boolean);
    const dynamic = logs.map((entry) => entry.resource?.type).filter(Boolean) as string[];
    return ["", ...Array.from(new Set([...base, ...dynamic])).sort((a, b) => a.localeCompare(b))];
  }, [logs]);

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

  const exportPDF = async () => {
    setExportingPdf(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({
        limit: "1000",
      });
      if (actionFilter) params.set("action", actionFilter);
      if (resourceTypeFilter) params.set("resource_type", resourceTypeFilter);
      if (actorQuery) params.set("actor_email", actorQuery);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);

      const res = await fetch(getApiUrl(`/api/v1/audit-logs/export/pdf?${params}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) await throwApiError(res, "export audit logs PDF");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Audit logs PDF exported");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to export audit logs PDF"));
    } finally {
      setExportingPdf(false);
    }
  };

  const currentSkip = page * LIMIT;
  const hasNext = logs.length === LIMIT;
  const hasPrev = page > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <ToolHelpModal toolId="admin-audit-logs" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>
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
        <PermissionGate permission="audit:export">
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="shrink-0 bg-lime border-[3px] border-navy press-3 press-navy px-5 py-3 rounded-2xl font-display text-navy text-sm transition-all flex items-center gap-2"
            >
              <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
            <button
              onClick={exportPDF}
              disabled={exportingPdf}
              className="shrink-0 bg-teal border-[3px] border-navy press-3 press-navy px-5 py-3 rounded-2xl font-display text-navy text-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
                <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
              </svg>
              {exportingPdf ? "Exporting..." : "Export PDF"}
            </button>
          </div>
        </PermissionGate>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "This page", value: logs.length, color: "bg-lavender-light border-lavender" },
          { label: "Offset", value: currentSkip, color: "bg-lime-light border-navy" },
          { label: "Action filter", value: actionFilter || "All", color: "bg-sunny-light border-navy" },
          { label: "Date range", value: fromDate && toDate ? `${fromDate} → ${toDate}` : fromDate || toDate || "All time", color: "bg-teal-light border-teal" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border-[3px] p-4 ${s.color}`}>
            <p className="text-label text-slate uppercase tracking-wider text-xs">{s.label}</p>
            <p className="font-display font-black text-2xl text-navy truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[3px_3px_0_0_#000]">
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
                className="flex-1 bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 font-normal text-navy placeholder:text-slate text-sm focus:outline-none focus:border-coral"
              />
              <button
                onClick={() => setActorQuery(actorSearch)}
                className="bg-navy text-snow border-[3px] border-lime rounded-xl px-3 py-2 text-sm font-display press-3 press-lime transition-all"
              >
                Go
              </button>
            </div>
          </div>

          {/* Resource type */}
          <div>
            <label htmlFor="audit-resource-type" className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Resource Type</label>
            <select
              id="audit-resource-type"
              title="Filter by resource type"
              value={resourceTypeFilter}
              onChange={(e) => setResourceTypeFilter(e.target.value)}
              className="w-full bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 font-normal text-navy text-sm focus:outline-none focus:border-coral appearance-none"
            >
              {resourceTypeOptions.map((t) => (
                <option key={t} value={t}>{t || "All resource types"}</option>
              ))}
            </select>
          </div>

          {/* Action */}
          <div>
            <label htmlFor="audit-action-type" className="text-label uppercase tracking-wider text-xs text-slate block mb-2">Action</label>
            <select
              id="audit-action-type"
              title="Filter by action type"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 font-normal text-navy text-sm focus:outline-none focus:border-coral appearance-none"
            >
              {actionOptions.map((a) => (
                <option key={a} value={a}>{a ? formatAction(a) : "All actions"}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date range row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="audit-from-date" className="text-label uppercase tracking-wider text-xs text-slate block mb-2">From Date</label>
            <input
              id="audit-from-date"
              title="Filter logs from date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 font-normal text-navy text-sm focus:outline-none focus:border-coral"
            />
          </div>
          <div>
            <label htmlFor="audit-to-date" className="text-label uppercase tracking-wider text-xs text-slate block mb-2">To Date</label>
            <input
              id="audit-to-date"
              title="Filter logs to date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-ghost border-[3px] border-navy rounded-xl px-4 py-2 font-normal text-navy text-sm focus:outline-none focus:border-coral"
            />
          </div>
        </div>

        {/* Clear filters */}
        {(actionFilter || resourceTypeFilter || actorQuery || fromDate || toDate) && (
          <button
            onClick={() => { setActionFilter(""); setResourceTypeFilter(""); setActorSearch(""); setActorQuery(""); setFromDate(""); setToDate(""); }}
            className="mt-4 text-sm text-coral font-display hover:underline"
          >
            ✕ Clear all filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[3px_3px_0_0_#000] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-[3px] border-navy border-t-lime rounded-full animate-spin" />
          </div>
        ) : displayedLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <svg aria-hidden="true" className="w-12 h-12 text-cloud" viewBox="0 0 24 24" fill="currentColor">
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
                    <React.Fragment key={log.id}>
                      <tr
                        className={`border-b-[2px] border-cloud cursor-pointer transition-colors ${
                          isExpanded ? "bg-lime-light" : idx % 2 === 0 ? "bg-snow hover:bg-ghost" : "bg-ghost hover:bg-cloud/40"
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
                        <tr className="bg-lime-light border-b-[2px] border-cloud">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                              {/* Details */}
                              <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[3px_3px_0_0_#000]">
                                <p className="font-display font-black text-navy uppercase tracking-wider mb-2 text-xs">Details</p>
                                {Object.keys(log.details).length === 0 ? (
                                  <p className="text-slate">No details recorded</p>
                                ) : (
                                  <dl className="space-y-2">
                                    {Object.entries(log.details).map(([k, v]) => (
                                      <div key={k} className="flex flex-col gap-1">
                                        <dt className="text-slate shrink-0">{formatDetailKey(k)}</dt>
                                        <dd className="text-navy font-normal break-words">
                                          {typeof v === "object" && v !== null ? (
                                            <pre className="bg-ghost border-[2px] border-cloud rounded-xl p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                                              {stringifyDetailValue(v)}
                                            </pre>
                                          ) : (
                                            stringifyDetailValue(v)
                                          )}
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                )}
                              </div>

                              {/* Metadata */}
                              <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[3px_3px_0_0_#000]">
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
                              <div className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[3px_3px_0_0_#000]">
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
                    </React.Fragment>
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
            {actorQuery && <span className="ml-1 text-coral">(filtered by &ldquo;{actorQuery}&rdquo;)</span>}
          </p>
          <div className="flex gap-3">
            <button
              disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)}
              className="bg-snow border-[3px] border-navy rounded-xl px-4 py-2 font-display text-sm text-navy press-3 press-black transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled: disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              ← Previous
            </button>
            <button
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="bg-lime border-[3px] border-navy rounded-xl px-4 py-2 font-display text-sm text-navy press-3 press-navy transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled: disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(AuditLogsPage, {
  requiredPermission: "audit:view",
});