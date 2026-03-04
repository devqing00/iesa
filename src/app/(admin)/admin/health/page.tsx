"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { withAuth } from "@/lib/withAuth";

interface ServiceStatus {
  status: "healthy" | "degraded" | "unhealthy";
  latency_ms?: number;
  collections?: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface HealthData {
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: Record<string, ServiceStatus>;
  collections?: Record<string, number>;
  system?: {
    python_version: string;
    environment: string;
  };
}

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  healthy: { bg: "bg-teal-light", text: "text-teal", dot: "bg-teal" },
  degraded: { bg: "bg-sunny-light", text: "text-sunny", dot: "bg-sunny" },
  unhealthy: { bg: "bg-coral-light", text: "text-coral", dot: "bg-coral" },
};

function AdminHealthPage() {
  const { getAccessToken } = useAuth();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [basicPing, setBasicPing] = useState<number | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const t0 = performance.now();
      const res = await fetch(getApiUrl("/health/detailed"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pingMs = Math.round(performance.now() - t0);
      setBasicPing(pingMs);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: HealthData = await res.json();
      setData(json);
      setError("");
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch health data");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const overall = data?.overall || "unhealthy";
  const colors = statusColors[overall] || statusColors.unhealthy;

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="System Health" subtitle="API & service monitoring" />

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && !data ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-navy font-bold">Checking system health...</p>
            </div>
          </div>
        ) : error && !data ? (
          <div className="bg-coral-light border-[4px] border-coral rounded-3xl p-8 text-center shadow-[8px_8px_0_0_#000]">
            <h2 className="font-display font-black text-2xl text-coral mb-2">Health Check Failed</h2>
            <p className="text-navy/60 mb-4">{error}</p>
            <button onClick={fetchHealth} className="bg-navy text-snow px-6 py-2 rounded-xl font-bold press-3 press-navy">
              Retry
            </button>
          </div>
        ) : data && (
          <>
            {/* Overall Status Banner */}
            <div className={`${colors.bg} border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] mb-8`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${colors.bg} border-[3px] border-navy flex items-center justify-center`}>
                    {overall === "healthy" ? (
                      <svg className="w-7 h-7 text-teal" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                      </svg>
                    ) : overall === "degraded" ? (
                      <svg className="w-7 h-7 text-sunny" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-7 h-7 text-coral" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h1 className="font-display font-black text-2xl text-navy">
                      System {overall === "healthy" ? "Operational" : overall === "degraded" ? "Degraded" : "Down"}
                    </h1>
                    <p className="text-sm text-navy/60">
                      {lastRefresh ? `Last checked: ${lastRefresh.toLocaleTimeString()}` : "Checking..."} • Auto-refreshes every 30s
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setLoading(true); fetchHealth(); }}
                  className="bg-navy text-snow px-5 py-2 rounded-xl font-bold text-sm press-3 press-navy flex items-center gap-2"
                >
                  <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* API Response Time */}
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-lavender-light flex items-center justify-center">
                    <svg className="w-5 h-5 text-lavender" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-label text-slate">API Roundtrip</p>
                    <p className="font-display font-black text-2xl text-navy">{basicPing ?? "—"}ms</p>
                  </div>
                </div>
                <div className="h-2 bg-cloud rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${(basicPing ?? 0) < 500 ? "bg-teal" : (basicPing ?? 0) < 1500 ? "bg-sunny" : "bg-coral"}`}
                    style={{ width: `${Math.min(100, ((basicPing ?? 0) / 3000) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-navy/40 mt-1">{(basicPing ?? 0) < 500 ? "Excellent" : (basicPing ?? 0) < 1500 ? "Acceptable" : "Slow"}</p>
              </div>

              {/* Service Cards */}
              {Object.entries(data.services).map(([name, svc]) => {
                const sc = statusColors[svc.status] || statusColors.unhealthy;
                return (
                  <div key={name} className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${sc.dot}`} />
                        <h3 className="font-display font-black text-lg text-navy capitalize">{name}</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${sc.bg} ${sc.text}`}>
                        {svc.status}
                      </span>
                    </div>
                    {svc.latency_ms !== undefined && (
                      <p className="text-sm text-navy/60">Latency: <span className="font-bold text-navy">{svc.latency_ms}ms</span></p>
                    )}
                    {svc.collections !== undefined && (
                      <p className="text-sm text-navy/60">Collections: <span className="font-bold text-navy">{svc.collections}</span></p>
                    )}
                    {svc.error && (
                      <p className="text-xs text-coral font-mono mt-2 break-all">{svc.error}</p>
                    )}
                  </div>
                );
              })}

              {/* System Info */}
              {data.system && (
                <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-lime-light flex items-center justify-center">
                      <svg className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M2.25 5.25a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3V15a3 3 0 0 1-3 3h-3v.257c0 .597.237 1.17.659 1.591l.621.622a.75.75 0 0 1-.53 1.28h-9a.75.75 0 0 1-.53-1.28l.621-.622a2.25 2.25 0 0 0 .659-1.59V18h-3a3 3 0 0 1-3-3V5.25Zm1.5 0v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="font-display font-black text-lg text-navy">System</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-navy/60">Python</span>
                      <span className="font-bold text-navy font-mono">{data.system.python_version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-navy/60">Environment</span>
                      <span className={`font-bold ${data.system.environment === "production" ? "text-coral" : "text-teal"}`}>
                        {data.system.environment}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Collection Stats */}
            {data.collections && Object.keys(data.collections).length > 0 && (
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                <h2 className="font-display font-black text-xl text-navy mb-4">Database Collections</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Object.entries(data.collections)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count]) => (
                      <div key={name} className="bg-ghost rounded-2xl p-4 text-center border-[2px] border-cloud">
                        <p className="font-display font-black text-2xl text-navy">{count >= 0 ? count.toLocaleString() : "?"}</p>
                        <p className="text-[10px] font-bold text-slate uppercase tracking-wider mt-1">{name}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default withAuth(AdminHealthPage, { anyPermission: ["system:health"] });
