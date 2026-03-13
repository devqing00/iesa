"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getTimeGreeting } from "@/lib/greeting";
import { useAdminStats } from "@/hooks/useData";
import { AdminDashboardSkeleton } from "@/components/ui/Skeleton";
import { withAuth } from "@/lib/withAuth";

const AdminCharts = dynamic(() => import("./AdminCharts"), { ssr: false });
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ─── Helpers ────────────────────────────────────── */

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatBirthdayDate(month: number, day: number): string {
  const date = new Date(2024, month - 1, day);
  return date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

/* ─── Component ──────────────────────────────────── */

function AdminDashboardPage() {
  const { user } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-dashboard");
  const { data, isLoading: loading } = useAdminStats(!!user);

  // Full-page shimmer skeleton while initial data loads
  if (loading && !data) return <AdminDashboardSkeleton />;

  const stats = {
    totalStudents: data?.totalStudents ?? 0,
    totalEnrollments: data?.totalEnrollments ?? 0,
    totalPayments: data?.totalPayments ?? 0,
    totalEvents: data?.totalEvents ?? 0,
    totalAnnouncements: data?.totalAnnouncements ?? 0,
    activeSession: data?.activeSession ?? null,
  };
  const charts = {
    enrollmentsByLevel: data?.enrollmentsByLevel ?? [],
    paymentsByStatus: data?.paymentsByStatus ?? [],
  };
  const recentActivity = data?.recentActivity ?? [];
  const upcomingBirthdays = data?.upcomingBirthdays ?? [];
  const engagement = data?.engagement;

  const greeting = getTimeGreeting;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <ToolHelpModal toolId="admin-dashboard" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">
            Admin Dashboard
          </p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            {greeting()},{" "}
            <span className="brush-highlight">{user?.firstName}</span>
          </h1>
          <p className="text-navy/60 mt-1 text-sm">
            Here&apos;s what&apos;s happening across IESA today
          </p>
        </div>
        {stats.activeSession && (
          <span className="self-start sm:self-auto px-4 py-1.5 rounded-full bg-cloud border-[2px] border-navy/10 text-navy text-xs font-bold">
            {stats.activeSession}
          </span>
        )}
      </div>

      {/* ── Hero Bento Grid ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Total Students — navy hero card spanning 7 cols */}
        <div className="md:col-span-7 bg-navy border-[3px] border-ghost/20 rounded-3xl p-8 relative overflow-hidden">
          {/* Decorative diamonds */}
          <svg aria-hidden="true" className="absolute top-6 right-6 w-5 h-5 text-navy/10 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>
          <svg aria-hidden="true" className="absolute bottom-8 right-20 w-3 h-3 text-coral/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>

          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/50 mb-6">
              Total Students Registered
            </p>
            <p className="font-display font-black text-6xl md:text-7xl text-snow mb-2">
              {loading ? "---" : stats.totalStudents}
            </p>
            <p className="text-ghost/50 text-sm">enrolled across all sessions</p>
          </div>
        </div>

        {/* Right column — 2 stacked cards spanning 5 cols */}
        <div className="md:col-span-5 grid grid-rows-2 gap-4">
          {/* Enrollments — lime card */}
          <div className="bg-lime border-[3px] border-navy rounded-3xl p-6 flex items-center justify-between shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-1">Enrollments</p>
              <p className="font-display font-black text-4xl text-navy">{loading ? "--" : stats.totalEnrollments}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-navy/10 flex items-center justify-center">
              <svg aria-hidden="true" className="w-6 h-6 text-navy" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25a3.75 3.75 0 0 0-3-3.75H5.625Z" />
                <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
              </svg>
            </div>
          </div>

          {/* Events — coral card */}
          <div className="bg-coral border-[3px] border-navy rounded-3xl p-6 flex items-center justify-between shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/60 mb-1">Events</p>
              <p className="font-display font-black text-4xl text-snow">{loading ? "--" : stats.totalEvents}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-snow/20 flex items-center justify-center">
              <svg aria-hidden="true" className="w-6 h-6 text-snow" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts Row ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Enrollments by Level */}
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-0.5">Breakdown</p>
              <h3 className="font-display font-black text-lg text-navy">Enrollments by Level</h3>
            </div>
            <Link href="/admin/enrollments" className="text-xs font-bold text-teal hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="h-48 bg-ghost rounded-2xl animate-pulse" />
          ) : charts.enrollmentsByLevel.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate text-sm font-medium">No enrollments yet</div>
          ) : (
            <AdminCharts type="bar" data={charts.enrollmentsByLevel} />
          )}
        </div>

        {/* Payments by Status */}
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-0.5">Overview</p>
              <h3 className="font-display font-black text-lg text-navy">Payment Status</h3>
            </div>
            <Link href="/admin/payments" className="text-xs font-bold text-teal hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="h-48 bg-ghost rounded-2xl animate-pulse" />
          ) : charts.paymentsByStatus.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate text-sm font-medium">No payments yet</div>
          ) : (
            <AdminCharts type="pie" data={charts.paymentsByStatus} />
          )}
        </div>
      </div>

      {/* ── Engagement Row ──────────────────────── */}
      {engagement && (
        <div className="space-y-4">
          <h2 className="font-display font-black text-xl text-navy">
            Platform <span className="brush-highlight">Engagement</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "Study Groups", value: engagement.studyGroups, color: "bg-teal-light", accent: "text-teal" },
              { label: "Resources", value: engagement.resources, color: "bg-lavender-light", accent: "text-lavender" },
              { label: "Press Articles", value: engagement.pressArticles, color: "bg-coral-light", accent: "text-coral" },
              { label: "AI Conversations", value: engagement.aiChats, color: "bg-sunny-light", accent: "text-sunny" },
              { label: "Growth Entries", value: engagement.growthEntries, color: "bg-lime-light", accent: "text-lime-dark" },
            ].map((m) => (
              <div key={m.label} className={`${m.color} border-[3px] border-navy rounded-2xl p-4 shadow-[3px_3px_0_0_#000]`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-1">{m.label}</p>
                <p className={`font-display font-black text-2xl ${m.accent}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom Row ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-black text-lg text-navy">Recent Activity</h3>
            <Link href="/admin/audit-logs" className="text-xs font-bold text-teal hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-ghost border-l-[4px] border-l-cloud">
                  <div className="w-8 h-8 rounded-xl bg-cloud animate-pulse" />
                  <div className="flex-1"><div className="h-4 bg-cloud rounded-xl animate-pulse w-3/4" /></div>
                  <div className="h-3 bg-cloud rounded animate-pulse w-12" />
                </div>
              ))
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-slate font-medium text-center py-4">No recent activity</p>
            ) : (
              recentActivity.slice(0, 5).map((log, i) => {
                const accents = ["border-l-teal", "border-l-lime", "border-l-lavender", "border-l-coral", "border-l-sunny"];
                const timeAgo = formatTimeAgo(log.timestamp);
                return (
                  <div key={log.id} className={`flex items-center gap-3 p-3 rounded-xl bg-ghost border-l-[4px] ${accents[i % accents.length]}`}>
                    <div className="w-8 h-8 rounded-xl bg-cloud flex items-center justify-center shrink-0">
                      <span className="text-slate text-xs font-bold">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy/70 font-medium truncate">
                        {log.action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        {log.resource?.name ? ` — ${log.resource.name}` : ` — ${log.resource?.type ?? ""}`}
                      </p>
                      {log.actor?.name && (
                        <p className="text-[10px] text-slate truncate">by {log.actor.name}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate font-bold shrink-0">{timeAgo}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Session Status */}
          <div className="bg-lavender border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
            <h3 className="font-display font-black text-lg text-snow mb-5">Session Status</h3>
            <div className="space-y-3">
              <div className="bg-snow/90 rounded-2xl p-4 border-[3px] border-navy/20">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Active Session</p>
                <p className="text-sm font-bold text-navy">{stats.activeSession || "None"}</p>
              </div>
              <div className="bg-snow/90 rounded-2xl p-4 border-[3px] border-navy/20">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Announcements</p>
                <p className="text-2xl font-display font-black text-navy">{loading ? "--" : stats.totalAnnouncements}</p>
              </div>
              <Link
                href="/admin/sessions"
                className="block w-full text-center py-3 rounded-2xl bg-navy border-[3px] border-lime text-snow text-sm font-bold press-4 press-lime transition-all"
              >
                Manage Sessions
              </Link>
            </div>
          </div>

          {/* Upcoming Birthdays */}
          <div className="bg-sunny-light border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-black text-lg text-navy">Upcoming Birthdays</h3>
              <span className="text-label-sm text-navy-muted">Next 14 days</span>
            </div>

            {upcomingBirthdays.length === 0 ? (
              <p className="text-sm text-slate font-medium">No birthdays coming up soon.</p>
            ) : (
              <div className="space-y-2.5">
                {upcomingBirthdays.map((person) => {
                  const label =
                    person.daysUntil === 0
                      ? "Today"
                      : person.daysUntil === 1
                        ? "Tomorrow"
                        : `In ${person.daysUntil} days`;

                  return (
                    <div
                      key={person.id}
                      className="bg-snow border-[2px] border-navy rounded-2xl px-3 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy truncate">
                          {person.firstName} {person.lastName}
                        </p>
                        <p className="text-xs text-slate truncate">
                          {person.currentLevel || "Student"} • {formatBirthdayDate(person.birthdayMonth, person.birthdayDay)}
                        </p>
                      </div>
                      <span className="text-label-sm bg-lime-light text-navy px-2 py-1 rounded-lg border border-navy/20 whitespace-nowrap">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(AdminDashboardPage, {
  anyPermission: ["user:view_all"],
});
