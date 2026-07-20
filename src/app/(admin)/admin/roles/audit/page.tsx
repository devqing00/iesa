"use client";

import { useState, useEffect } from "react";
import { getAuditLogs, AuditLogResponse } from "@/lib/api/audit";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { Loader2, Search, ArrowLeft, Shield } from "lucide-react";
import { usePermissions } from "@/context/PermissionsContext";

export default function AuditLogsPage() {
  const { hasPermission, loading: permsLoading } = usePermissions();
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [actionFilter, setActionFilter] = useState("role.assigned");
  const [emailFilter, setEmailFilter] = useState("");
  
  // Pagination
  const [skip, setSkip] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (!permsLoading && hasPermission("audit:view")) {
      fetchLogs();
    }
  }, [skip, actionFilter, permsLoading, hasPermission]);

  const fetchLogs = async (isSearch = false) => {
    try {
      if (isSearch) setSkip(0);
      setLoading(true);
      
      const currentSkip = isSearch ? 0 : skip;
      
      const data = await getAuditLogs({
        action: actionFilter || undefined,
        actor_email: emailFilter || undefined,
        limit,
        skip: currentSkip
      });
      
      setLogs(data);
    } catch (err: any) {
      console.error("Failed to fetch audit logs:", err);
      // Let global interceptor handle toast
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(true);
  };

  if (permsLoading) {
    return <div className="max-w-7xl mx-auto p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-navy" /></div>;
  }

  if (!hasPermission("audit:view")) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="p-8 text-center max-w-md mx-auto mt-12 bg-coral/10 border-[3px] border-coral rounded-2xl">
          <Shield className="w-12 h-12 text-coral mx-auto mb-4" />
          <h2 className="font-display font-black text-2xl text-navy mb-2">Access Denied</h2>
          <p className="text-slate font-medium mb-6">You do not have permission to view audit logs.</p>
          <Link href="/admin/roles" className="px-6 py-3 bg-navy text-snow font-bold rounded-xl border-[3px] border-navy shadow-[4px_4px_0_0_#000] inline-block">
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link href="/admin/roles" className="p-2 border-[3px] border-navy rounded-xl hover:bg-navy hover:text-snow transition-colors shadow-[2px_2px_0_0_#000]">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">Administration</p>
          </div>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Audit</span> Logs
          </h1>
          <p className="text-sm text-slate mt-1">Track permission elevations and role assignments across the platform.</p>
        </div>
      </div>

      <div className="bg-snow border-[3px] border-navy shadow-[6px_6px_0_0_#000] rounded-2xl p-6 mb-8 animate-in fade-in slide-in-from-bottom-4">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate" />
            <input 
              type="text" 
              placeholder="Filter by admin email..." 
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-[3px] border-navy rounded-xl focus:outline-none focus:ring-4 focus:ring-lavender/30 font-medium"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setSkip(0);
            }}
            className="px-4 py-3 border-[3px] border-navy rounded-xl focus:outline-none font-bold bg-white"
          >
            <option value="">All Actions</option>
            <option value="role.assigned">Role Assigned</option>
            <option value="role.revoked">Role Revoked</option>
            <option value="user.role.changed">Role Changed</option>
          </select>
          <button 
            type="submit"
            className="px-8 py-3 bg-navy text-snow font-bold border-[3px] border-navy hover:bg-snow hover:text-navy transition-colors rounded-xl shadow-[4px_4px_0_0_#000]"
          >
            Filter
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-[3px] border-navy">
                <th className="py-4 px-4 font-black font-display text-navy">Timestamp</th>
                <th className="py-4 px-4 font-black font-display text-navy">Actor (Admin)</th>
                <th className="py-4 px-4 font-black font-display text-navy">Action</th>
                <th className="py-4 px-4 font-black font-display text-navy">Target Resource</th>
                <th className="py-4 px-4 font-black font-display text-navy">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-navy mx-auto" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate font-medium">
                    No audit logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b-[2px] border-navy/10 hover:bg-lavender/5 transition-colors">
                    <td className="py-4 px-4 font-medium text-sm text-slate whitespace-nowrap">
                      {format(new Date(log.timestamp), "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-bold text-navy">{log.actor.email}</span>
                      <br/>
                      <span className="text-xs text-slate">ID: {log.actor.id}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border-[2px] ${
                        log.action.includes('assigned') ? 'bg-teal/20 text-teal border-teal' :
                        log.action.includes('revoked') ? 'bg-coral/20 text-coral border-coral' :
                        'bg-lavender/20 text-lavender border-lavender'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm font-bold capitalize">{log.resource.type}</span>
                      <br/>
                      <span className="text-xs font-mono text-slate bg-ghost px-1 rounded border border-navy/20">
                        {log.resource.id}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        {log.details?.position && <div><span className="text-slate">Position:</span> <span className="font-bold">{log.details.position}</span></div>}
                        {log.details?.oldRole && <div><span className="text-slate">Old Role:</span> <span className="font-bold">{log.details.oldRole}</span></div>}
                        {log.details?.newRole && <div><span className="text-slate">New Role:</span> <span className="font-bold">{log.details.newRole}</span></div>}
                        {log.details?.permissions?.length > 0 && (
                          <div className="mt-1">
                            <span className="text-xs text-slate">{log.details.permissions.length} permissions assigned</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && logs.length > 0 && (
          <div className="mt-6 flex justify-between items-center pt-4 border-t-[3px] border-navy">
            <button
              disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - limit))}
              className="px-4 py-2 font-bold border-[2px] border-navy rounded-xl hover:bg-navy hover:text-snow disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              Previous
            </button>
            <span className="font-bold text-navy">
              Page {Math.floor(skip / limit) + 1}
            </span>
            <button
              disabled={logs.length < limit}
              onClick={() => setSkip(skip + limit)}
              className="px-4 py-2 font-bold border-[2px] border-navy rounded-xl hover:bg-navy hover:text-snow disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
