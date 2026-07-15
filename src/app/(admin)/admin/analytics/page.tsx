"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { withAuth } from "@/lib/withAuth";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import { ToolHelpModal, useToolHelp, HelpButton } from "@/components/ui/ToolHelpModal";
import { getErrorMessage } from "@/lib/adminApiError";
import Link from "next/link";

/* ── Types ──────────────────────────────── */

interface AtRiskStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  level: string;
  profileUrl?: string;
  riskScore: number;
  riskLevel: "High" | "Medium" | "Low";
  riskFactors: string[];
  lastLogin: string | null;
}

/* ── Component ──────────────────────────── */

function AnalyticsAtRiskPage() {
  const { user, userProfile, loading: authLoading, getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-analytics");
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchAtRiskStudents = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(getApiUrl("/api/v1/analytics/at-risk-students"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error("Failed to load at-risk students");
      }
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setStudents(data.students || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to fetch analytics"));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (user && userProfile) {
      fetchAtRiskStudents();
    }
  }, [user, userProfile, fetchAtRiskStudents]);

  if (authLoading || (loading && students.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate summary stats
  const highRisk = students.filter(s => s.riskLevel === "High").length;
  const mediumRisk = students.filter(s => s.riskLevel === "Medium").length;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <ToolHelpModal toolId="admin-analytics" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>
      
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Predictive Analytics</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Early Warning</span> System
          </h1>
          <p className="text-sm text-navy/60 mt-1">Identify and support students at risk of dropping out or failing.</p>
        </div>
        <button
          onClick={fetchAtRiskStudents}
          className="self-start px-5 py-2.5 bg-snow border-[3px] border-navy rounded-2xl text-navy text-sm font-bold press-3 press-navy flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-coral-light border-[3px] border-coral rounded-2xl p-4">
          <p className="text-coral text-sm font-bold">{error}</p>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-coral border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80 mb-1">Critical Attention</p>
          <p className="font-display font-black text-3xl text-snow">{highRisk}</p>
          <p className="text-xs text-snow/60 mt-1">High Risk Students</p>
        </div>
        <div className="bg-sunny border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60 mb-1">Needs Monitoring</p>
          <p className="font-display font-black text-3xl text-navy">{mediumRisk}</p>
          <p className="text-xs text-navy/60 mt-1">Medium Risk Students</p>
        </div>
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Total Flagged</p>
          <p className="font-display font-black text-3xl text-navy">{students.length}</p>
          <p className="text-xs text-navy/40 mt-1">Students at Risk</p>
        </div>
      </div>

      {/* ── Students Table ── */}
      <div className="relative bg-snow border-[3px] border-navy rounded-3xl overflow-hidden shadow-[4px_4px_0_0_#000]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-[4px] border-lime bg-navy">
                <th scope="col" className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Student</th>
                <th scope="col" className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Risk Level</th>
                <th scope="col" className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Risk Factors</th>
                <th scope="col" className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Last Active</th>
                <th scope="col" className="text-right px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-snow/80">Action</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <p className="text-sm text-navy/60 font-medium">No at-risk students found. Great job!</p>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="border-b-[3px] border-navy/10 last:border-b-0 hover:bg-ghost transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {student.profileUrl ? (
                          <img src={student.profileUrl} alt="" className="w-10 h-10 rounded-xl object-cover border-2 border-navy" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-cloud flex items-center justify-center text-sm font-bold text-navy shrink-0 border-2 border-navy">
                            {student.firstName[0]}{student.lastName[0]}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-bold text-navy">
                            {student.firstName} {student.lastName}
                          </div>
                          <div className="text-xs text-slate mt-0.5">
                            {student.level} • {student.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border-[2px] ${
                        student.riskLevel === 'High' 
                          ? 'bg-coral-light border-coral text-coral' 
                          : student.riskLevel === 'Medium'
                          ? 'bg-sunny-light border-sunny text-sunny'
                          : 'bg-teal-light border-teal text-teal'
                      }`}>
                        {student.riskLevel} ({student.riskScore})
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <ul className="list-disc pl-4 text-xs text-navy/70 space-y-1">
                        {student.riskFactors.map((factor, idx) => (
                          <li key={idx}>{factor}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-navy/60">
                      {student.lastLogin 
                        ? new Date(student.lastLogin).toLocaleDateString() 
                        : "Never"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link 
                        href={`/admin/messages?to=${student.id}`}
                        className="inline-flex items-center justify-center px-4 py-2 bg-navy text-snow text-xs font-bold rounded-xl press-3 hover:bg-navy/90"
                      >
                        Contact
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default withAuth(AnalyticsAtRiskPage, {
  requiredPermission: "admin:dashboard",
});
