"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { throwApiError, getErrorMessage } from "@/lib/adminApiError";
import { withAuth } from "@/lib/withAuth";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

interface ServiceStatus {
  status: "healthy" | "degraded" | "unhealthy";
  latency_ms?: number;
  collections?: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface EmailProviderQuota {
  hardLimit: number;
  softStopAt: number;
  sent: number;
  success: number;
  failed: number;
  blocked: number;
  remaining: number;
  disabled: boolean;
}

interface EmailQuotaDetails {
  enabled: boolean;
  day: string;
  source?: string;
  activeProvider: string;
  dailyLimit: number;
  softStopAt: number;
  sentToday: number;
  successToday: number;
  failedToday: number;
  blockedToday: number;
  remaining: number;
  disabled: boolean;
  buffer: number;
  providers: Record<string, EmailProviderQuota>;
}

interface EmailLimitSettingsResponse {
  defaults: {
    enabled: boolean;
    dailyLimitTotal: number;
    resendLimit: number;
    smtpLimit: number;
    sendgridLimit: number;
    buffer: number;
  };
  overrides: Partial<{
    enabled: boolean;
    dailyLimitTotal: number;
    resendLimit: number;
    smtpLimit: number;
    sendgridLimit: number;
    buffer: number;
  }>;
  effective: {
    enabled: boolean;
    dailyLimitTotal: number;
    resendLimit: number;
    smtpLimit: number;
    sendgridLimit: number;
    buffer: number;
    source: string;
  };
  recommended: {
    enabled: boolean;
    dailyLimitTotal: number;
    resendLimit: number;
    smtpLimit: number;
    sendgridLimit: number;
    buffer: number;
  };
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

interface VapidStatusData {
  enabled: boolean;
  public_key_length: number;
  private_key_present: boolean;
  private_key_source: string | null;
  claims: { sub?: string } | null;
}

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  healthy: { bg: "bg-teal-light", text: "text-teal", dot: "bg-teal" },
  degraded: { bg: "bg-sunny-light", text: "text-sunny", dot: "bg-sunny" },
  unhealthy: { bg: "bg-coral-light", text: "text-coral", dot: "bg-coral" },
};

function AdminHealthPage() {
  const { getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-health");
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [basicPing, setBasicPing] = useState<number | null>(null);
  const [pushStatus, setPushStatus] = useState<VapidStatusData | null>(null);
  const [pushStatusLoading, setPushStatusLoading] = useState(false);
  const [pushStatusError, setPushStatusError] = useState("");
  const [pushTestEmail, setPushTestEmail] = useState("");
  const [pushTestLoading, setPushTestLoading] = useState(false);
  const [pushTestResult, setPushTestResult] = useState("");
  const [pushTestError, setPushTestError] = useState("");
  const [emailLimitSettings, setEmailLimitSettings] = useState<EmailLimitSettingsResponse | null>(null);
  const [emailSettingsLoading, setEmailSettingsLoading] = useState(false);
  const [emailSettingsSaving, setEmailSettingsSaving] = useState(false);
  const [emailSettingsError, setEmailSettingsError] = useState("");
  const [emailSettingsResult, setEmailSettingsResult] = useState("");
  const [emailLimitsForm, setEmailLimitsForm] = useState({
    enabled: true,
    dailyLimitTotal: 450,
    resendLimit: 95,
    smtpLimit: 450,
    sendgridLimit: 450,
    buffer: 5,
  });

  const fetchHealth = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const t0 = performance.now();
      const res = await fetch(getApiUrl("/health/detailed"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pingMs = Math.round(performance.now() - t0);
      setBasicPing(pingMs);

      if (!res.ok) await throwApiError(res, "load system health");
      const json: HealthData = await res.json();
      setData(json);
      setError("");
      setLastRefresh(new Date());
    } catch (err) {
      setError(getErrorMessage(err, "Failed to fetch health data"));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  const fetchPushStatus = useCallback(async () => {
    setPushStatusLoading(true);
    setPushStatusError("");
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/push/vapid-status"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) await throwApiError(res, "load push status");
      const json: VapidStatusData = await res.json();
      setPushStatus(json);
    } catch (err) {
      setPushStatusError(getErrorMessage(err, "Failed to load push diagnostics"));
    } finally {
      setPushStatusLoading(false);
    }
  }, [getAccessToken]);

  const sendPushTest = useCallback(async () => {
    const email = pushTestEmail.trim();
    if (!email) {
      setPushTestError("Enter a user email to test push delivery");
      setPushTestResult("");
      return;
    }

    setPushTestLoading(true);
    setPushTestError("");
    setPushTestResult("");
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/push/test/send-by-email"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          title: "IESA Push Health Test",
          body: "Push health test from Admin Health page.",
          url: "/dashboard/announcements",
          tag: "push-health-test",
        }),
      });
      if (!res.ok) await throwApiError(res, "send push test");
      const json = await res.json();
      const attempted = typeof json?.attempted === "number" ? json.attempted : 0;
      const sent = typeof json?.sent === "number" ? json.sent : 0;
      const failed = typeof json?.failed === "number" ? json.failed : 0;
      const stale = typeof json?.stale_removed === "number" ? json.stale_removed : 0;
      const subscriptions = typeof json?.subscriptions === "number" ? json.subscriptions : 0;
      setPushTestResult(
        subscriptions === 0
          ? `No active push subscriptions found for ${email}.`
          : sent > 0
            ? `Push sent for ${email}: ${sent}/${attempted} delivered${failed > 0 ? `, ${failed} failed` : ""}${stale > 0 ? `, ${stale} stale removed` : ""}.`
            : `Push delivery failed for ${email}: 0/${attempted} sent${stale > 0 ? `, ${stale} stale removed` : ""}.`,
      );
    } catch (err) {
      setPushTestError(getErrorMessage(err, "Failed to send push test"));
    } finally {
      setPushTestLoading(false);
    }
  }, [getAccessToken, pushTestEmail]);

  const fetchEmailLimitSettings = useCallback(async () => {
    setEmailSettingsLoading(true);
    setEmailSettingsError("");
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/settings/email-limits"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) await throwApiError(res, "load email limit settings");
      const json: EmailLimitSettingsResponse = await res.json();
      setEmailLimitSettings(json);
      setEmailLimitsForm({
        enabled: !!json.effective.enabled,
        dailyLimitTotal: Number(json.effective.dailyLimitTotal || 0),
        resendLimit: Number(json.effective.resendLimit || 0),
        smtpLimit: Number(json.effective.smtpLimit || 0),
        sendgridLimit: Number(json.effective.sendgridLimit || 0),
        buffer: Number(json.effective.buffer || 0),
      });
    } catch (err) {
      setEmailSettingsError(getErrorMessage(err, "Failed to load email limit settings"));
    } finally {
      setEmailSettingsLoading(false);
    }
  }, [getAccessToken]);

  const saveEmailLimitSettings = useCallback(async () => {
    setEmailSettingsSaving(true);
    setEmailSettingsError("");
    setEmailSettingsResult("");
    try {
      const token = await getAccessToken();
      const payload = {
        enabled: emailLimitsForm.enabled,
        dailyLimitTotal: Number(emailLimitsForm.dailyLimitTotal),
        resendLimit: Number(emailLimitsForm.resendLimit),
        smtpLimit: Number(emailLimitsForm.smtpLimit),
        sendgridLimit: Number(emailLimitsForm.sendgridLimit),
        buffer: Number(emailLimitsForm.buffer),
      };
      const res = await fetch(getApiUrl("/api/v1/settings/email-limits"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) await throwApiError(res, "save email limit settings");
      const json: EmailLimitSettingsResponse = await res.json();
      setEmailLimitSettings(json);
      setEmailSettingsResult("Email limit settings updated.");
      fetchHealth();
    } catch (err) {
      setEmailSettingsError(getErrorMessage(err, "Failed to save email limit settings"));
    } finally {
      setEmailSettingsSaving(false);
    }
  }, [emailLimitsForm, fetchHealth, getAccessToken]);

  const resetEmailLimitSettings = useCallback(async () => {
    setEmailSettingsSaving(true);
    setEmailSettingsError("");
    setEmailSettingsResult("");
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/settings/email-limits"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resetToDefaults: true }),
      });
      if (!res.ok) await throwApiError(res, "reset email limit settings");
      const json: EmailLimitSettingsResponse = await res.json();
      setEmailLimitSettings(json);
      setEmailLimitsForm({
        enabled: !!json.effective.enabled,
        dailyLimitTotal: Number(json.effective.dailyLimitTotal || 0),
        resendLimit: Number(json.effective.resendLimit || 0),
        smtpLimit: Number(json.effective.smtpLimit || 0),
        sendgridLimit: Number(json.effective.sendgridLimit || 0),
        buffer: Number(json.effective.buffer || 0),
      });
      setEmailSettingsResult("Email limits reset to defaults.");
      fetchHealth();
    } catch (err) {
      setEmailSettingsError(getErrorMessage(err, "Failed to reset email limit settings"));
    } finally {
      setEmailSettingsSaving(false);
    }
  }, [fetchHealth, getAccessToken]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    fetchPushStatus();
  }, [fetchPushStatus]);

  useEffect(() => {
    fetchEmailLimitSettings();
  }, [fetchEmailLimitSettings]);

  const overall = data?.overall || "unhealthy";
  const colors = statusColors[overall] || statusColors.unhealthy;
  const pingValue = basicPing ?? 0;
  const pingWidthClass =
    pingValue < 500 ? "w-1/4" : pingValue < 1000 ? "w-2/4" : pingValue < 1500 ? "w-3/4" : "w-full";
  const emailDetails = (data?.services?.email?.details as { quota?: EmailQuotaDetails; provider?: string } | undefined);
  const emailQuota = emailDetails?.quota;
  const emailLimitValidationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!emailLimitsForm.enabled) return errors;

    const total = Number(emailLimitsForm.dailyLimitTotal || 0);
    const resend = Number(emailLimitsForm.resendLimit || 0);
    const smtp = Number(emailLimitsForm.smtpLimit || 0);
    const sendgrid = Number(emailLimitsForm.sendgridLimit || 0);
    const buffer = Number(emailLimitsForm.buffer || 0);

    if (total <= 0) {
      errors.push("Daily total must be greater than 0 when limits are enabled.");
    }

    if (resend > total) errors.push("Resend limit cannot be greater than Daily Total.");
    if (smtp > total) errors.push("SMTP limit cannot be greater than Daily Total.");
    if (sendgrid > total) errors.push("SendGrid limit cannot be greater than Daily Total.");

    const positiveLimits = [resend, smtp, sendgrid].filter((v) => v > 0);
    if (positiveLimits.length > 0) {
      const smallest = Math.min(...positiveLimits);
      if (buffer >= smallest) {
        errors.push(`Buffer must be smaller than the smallest provider limit (${smallest}).`);
      }
    }

    return errors;
  }, [emailLimitsForm]);
  const hasEmailLimitValidationError = emailLimitValidationErrors.length > 0;

  return (
    <div className="min-h-screen bg-ghost">
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHelpModal toolId="admin-health" isOpen={showHelp} onClose={closeHelp} />
        <div className="flex justify-end mb-3">
          <HelpButton onClick={openHelp} />
        </div>
        {loading && !data ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-navy font-bold">Checking system health...</p>
            </div>
          </div>
        ) : error && !data ? (
          <div className="bg-coral-light border-4 border-coral rounded-3xl p-8 text-center shadow-[8px_8px_0_0_#000]">
            <h2 className="font-display font-black text-2xl text-coral mb-2">Health Check Failed</h2>
            <p className="text-navy/60 mb-4">{error}</p>
            <button onClick={fetchHealth} className="bg-navy text-snow px-6 py-2 rounded-xl font-bold press-3 press-lime">
              Retry
            </button>
          </div>
        ) : data && (
          <>
            {/* Overall Status Banner */}
            <div className={`${colors.bg} border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] mb-8`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${colors.bg} border-[3px] border-navy flex items-center justify-center`}>
                    {overall === "healthy" ? (
                      <svg aria-hidden="true" className="w-7 h-7 text-teal" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                      </svg>
                    ) : overall === "degraded" ? (
                      <svg aria-hidden="true" className="w-7 h-7 text-sunny" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" className="w-7 h-7 text-coral" fill="currentColor" viewBox="0 0 24 24">
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
                  className="bg-navy text-snow px-5 py-2 rounded-xl font-bold text-sm press-3 press-lime flex items-center gap-2"
                >
                  <svg aria-hidden="true" className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* API Response Time */}
              <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-lavender-light flex items-center justify-center">
                    <svg aria-hidden="true" className="w-5 h-5 text-lavender" fill="currentColor" viewBox="0 0 24 24">
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
                    className={`h-full rounded-full transition-all ${pingWidthClass} ${(basicPing ?? 0) < 500 ? "bg-teal" : (basicPing ?? 0) < 1500 ? "bg-sunny" : "bg-coral"}`}
                  />
                </div>
                <p className="text-[10px] text-navy/40 mt-1">{(basicPing ?? 0) < 500 ? "Excellent" : (basicPing ?? 0) < 1500 ? "Acceptable" : "Slow"}</p>
              </div>

              {/* Service Cards */}
              {Object.entries(data.services).map(([name, svc]) => {
                const sc = statusColors[svc.status] || statusColors.unhealthy;
                return (
                  <div key={name} className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
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
                <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-lime-light flex items-center justify-center">
                      <svg aria-hidden="true" className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 24 24">
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
              <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000]">
                <h2 className="font-display font-black text-xl text-navy mb-4">Database Collections</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Object.entries(data.collections)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count]) => (
                      <div key={name} className="bg-ghost rounded-2xl p-4 text-center border-2 border-cloud">
                        <p className="font-display font-black text-2xl text-navy">{count >= 0 ? count.toLocaleString() : "?"}</p>
                        <p className="text-[10px] font-bold text-slate uppercase tracking-wider mt-1">{name}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {emailQuota && (
              <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] mt-8">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                  <h2 className="font-display font-black text-xl text-navy">Email Daily Limits</h2>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${emailQuota.disabled ? "bg-coral-light text-coral" : "bg-teal-light text-teal"}`}>
                    {emailQuota.disabled ? "DISABLED (SOFT STOP)" : "ACTIVE"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                  <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                    <p className="text-label text-slate mb-1">Provider</p>
                    <p className="font-display font-black text-lg text-navy uppercase">{emailQuota.activeProvider || "—"}</p>
                  </div>
                  <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                    <p className="text-label text-slate mb-1">Sent Today</p>
                    <p className="font-display font-black text-lg text-navy">{emailQuota.sentToday}</p>
                  </div>
                  <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                    <p className="text-label text-slate mb-1">Remaining</p>
                    <p className={`font-display font-black text-lg ${emailQuota.remaining > 0 ? "text-teal" : "text-coral"}`}>{emailQuota.remaining}</p>
                  </div>
                  <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                    <p className="text-label text-slate mb-1">Soft Stop At</p>
                    <p className="font-display font-black text-lg text-navy">{emailQuota.softStopAt}</p>
                  </div>
                  <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                    <p className="text-label text-slate mb-1">Hard Limit</p>
                    <p className="font-display font-black text-lg text-navy">{emailQuota.dailyLimit}</p>
                  </div>
                </div>

                <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                  <p className="text-sm text-slate mb-2">
                    Day: <span className="font-bold text-navy">{emailQuota.day}</span> • Buffer before stop: <span className="font-bold text-navy">{emailQuota.buffer}</span>
                  </p>
                  <p className="text-xs text-slate mb-2">
                    Config source: <span className="font-bold text-navy">{emailQuota.source || "env"}</span>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(emailQuota.providers || {}).map(([providerName, provider]) => (
                      <div key={providerName} className="bg-snow rounded-xl p-3 border-2 border-cloud">
                        <p className="text-label text-slate mb-1 uppercase">{providerName}</p>
                        <p className="text-sm text-navy">Sent: <span className="font-bold">{provider.sent}</span> / {provider.softStopAt}</p>
                        <p className="text-sm text-navy">Success: <span className="font-bold">{provider.success}</span> • Failed: <span className="font-bold">{provider.failed}</span></p>
                        <p className="text-sm text-navy">Blocked: <span className="font-bold">{provider.blocked}</span></p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud mt-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <h3 className="font-display font-black text-lg text-navy">Email Limit Settings</h3>
                    <p className="text-xs text-slate">Recommended: Total 450, Resend 95, SMTP 450, SendGrid 450, Buffer 5</p>
                  </div>

                  {emailSettingsLoading ? (
                    <p className="text-sm text-slate">Loading settings...</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <label className="flex items-center gap-2 text-sm text-navy">
                          <input
                            type="checkbox"
                            checked={emailLimitsForm.enabled}
                            onChange={(e) => setEmailLimitsForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                          />
                          Enable limits
                        </label>

                        {[
                          { key: "dailyLimitTotal", label: "Daily Total" },
                          { key: "resendLimit", label: "Resend" },
                          { key: "smtpLimit", label: "SMTP" },
                          { key: "sendgridLimit", label: "SendGrid" },
                          { key: "buffer", label: "Buffer" },
                        ].map((field) => (
                          <label key={field.key} className="flex flex-col gap-1 text-xs text-slate">
                            <span>{field.label}</span>
                            <input
                              type="number"
                              min={0}
                              value={String(emailLimitsForm[field.key as keyof typeof emailLimitsForm])}
                              onChange={(e) => {
                                const value = Number(e.target.value || 0);
                                setEmailLimitsForm((prev) => ({ ...prev, [field.key]: Number.isFinite(value) ? value : 0 }));
                              }}
                              className="bg-snow border-2 border-navy rounded-xl px-3 py-2 text-sm text-navy"
                            />
                          </label>
                        ))}
                      </div>

                      {emailLimitSettings?.effective && (
                        <p className="text-xs text-navy-muted mt-3">
                          Effective now — Total: {emailLimitSettings.effective.dailyLimitTotal}, Resend: {emailLimitSettings.effective.resendLimit}, SMTP: {emailLimitSettings.effective.smtpLimit}, SendGrid: {emailLimitSettings.effective.sendgridLimit}, Buffer: {emailLimitSettings.effective.buffer}
                        </p>
                      )}

                      {hasEmailLimitValidationError && (
                        <div className="mt-3 bg-coral-light border-2 border-coral rounded-2xl p-3 text-sm text-coral font-medium">
                          {emailLimitValidationErrors.map((msg, idx) => (
                            <p key={`${msg}-${idx}`}>{msg}</p>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          type="button"
                          onClick={saveEmailLimitSettings}
                          disabled={emailSettingsSaving || hasEmailLimitValidationError}
                          className="bg-lime border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-bold text-navy press-3 press-navy disabled:opacity-50"
                        >
                          {emailSettingsSaving ? "Saving..." : "Save Settings"}
                        </button>
                        <button
                          type="button"
                          onClick={resetEmailLimitSettings}
                          disabled={emailSettingsSaving}
                          className="bg-snow border-[3px] border-navy rounded-xl px-4 py-2 text-sm font-bold text-navy press-3 press-black disabled:opacity-50"
                        >
                          Reset to Defaults
                        </button>
                      </div>

                      {emailSettingsResult && (
                        <div className="mt-3 bg-teal-light border-2 border-teal rounded-2xl p-3 text-sm text-teal font-medium">
                          {emailSettingsResult}
                        </div>
                      )}
                      {emailSettingsError && (
                        <div className="mt-3 bg-coral-light border-2 border-coral rounded-2xl p-3 text-sm text-coral font-medium">
                          {emailSettingsError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="bg-snow border-4 border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] mt-8">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <h2 className="font-display font-black text-xl text-navy">Push Health</h2>
                <button
                  type="button"
                  onClick={fetchPushStatus}
                  disabled={pushStatusLoading}
                  className="bg-lime border-[3px] border-navy rounded-xl px-4 py-2 font-display font-bold text-sm text-navy press-3 press-navy disabled:opacity-50"
                >
                  {pushStatusLoading ? "Checking..." : "Check VAPID"}
                </button>
              </div>

              {pushStatusError ? (
                <div className="bg-coral-light border-2 border-coral rounded-2xl p-3 text-sm text-coral font-medium mb-4">
                  {pushStatusError}
                </div>
              ) : pushStatus ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                    <p className="text-label text-slate mb-1">Push Enabled</p>
                    <p className={`font-display font-black text-lg ${pushStatus.enabled ? "text-teal" : "text-coral"}`}>
                      {pushStatus.enabled ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                    <p className="text-label text-slate mb-1">Public Key Length</p>
                    <p className="font-display font-black text-lg text-navy">{pushStatus.public_key_length || 0}</p>
                  </div>
                  <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                    <p className="text-label text-slate mb-1">Private Key</p>
                    <p className={`font-display font-black text-lg ${pushStatus.private_key_present ? "text-teal" : "text-coral"}`}>
                      {pushStatus.private_key_present ? "Present" : "Missing"}
                    </p>
                  </div>
                  <div className="bg-ghost rounded-2xl p-4 border-2 border-cloud">
                    <p className="text-label text-slate mb-1">Key Source</p>
                    <p className="font-display font-black text-sm text-navy wrap-break-word">{pushStatus.private_key_source || "—"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate mb-4">Loading push diagnostics...</p>
              )}

              <div className="border-t-2 border-cloud pt-4">
                <p className="text-sm text-slate mb-3">Send a test push to verify subscription delivery for a specific user.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    value={pushTestEmail}
                    onChange={(e) => setPushTestEmail(e.target.value)}
                    placeholder="student@ui.edu.ng"
                    className="flex-1 bg-snow border-[3px] border-navy rounded-xl px-4 py-2.5 text-sm text-navy placeholder:text-slate"
                  />
                  <button
                    type="button"
                    onClick={sendPushTest}
                    disabled={pushTestLoading || !pushTestEmail.trim()}
                    className="bg-navy border-[3px] border-lime rounded-xl px-5 py-2.5 font-display font-bold text-sm text-lime press-3 press-lime disabled:opacity-50"
                  >
                    {pushTestLoading ? "Sending..." : "Send Test"}
                  </button>
                </div>
                {pushTestResult && (
                  <div className="mt-3 bg-teal-light border-2 border-teal rounded-2xl p-3 text-sm text-teal font-medium">
                    {pushTestResult}
                  </div>
                )}
                {pushTestError && (
                  <div className="mt-3 bg-coral-light border-2 border-coral rounded-2xl p-3 text-sm text-coral font-medium">
                    {pushTestError}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default withAuth(AdminHealthPage, { anyPermission: ["system:health"] });
