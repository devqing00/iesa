"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import { getTimeGreeting } from "@/lib/greeting";
import { useAdminStats } from "@/hooks/useData";
import { AdminDashboardSkeleton } from "@/components/ui/Skeleton";
import { getApiUrl } from "@/lib/api";

const AdminCharts = dynamic(() => import("./AdminCharts"), { ssr: false });

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

/* ─── Component ──────────────────────────────────── */

export default function AdminDashboardPage() {
  const { user, getAccessToken } = useAuth();
  const { data, isLoading: loading } = useAdminStats(!!user);

  // Detailed engagement analytics
  interface EngagementDetail {
    inactiveStudents: number;
    totalStudents: number;
    activeStudents7d: number;
    unenrolledStudents: number;
    iepod: { totalRegistrations: number; completionRate: number; byPhase: Record<string, number> };
    library: { uploads30d: number; uploads7d: number };
    aiUsage7d: number;
  }
  const [engagementDetail, setEngagementDetail] = useState<EngagementDetail | null>(null);

  const fetchEngagement = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/admin/engagement"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setEngagementDetail(await res.json());
    } catch { /* non-critical */ }
  }, [getAccessToken]);

  useEffect(() => {
    if (user) fetchEngagement();
  }, [user, fetchEngagement]);

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
  const engagement = data?.engagement;

  const greeting = getTimeGreeting;

  const quickLinks = [
    {
      name: "Users",
      href: "/admin/users",
      count: stats.totalStudents,
      color: "bg-lavender-light",
      accent: "bg-lavender",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Enrollments",
      href: "/admin/enrollments",
      count: stats.totalEnrollments,
      color: "bg-teal-light",
      accent: "bg-teal",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25a3.75 3.75 0 0 0-3-3.75H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" />
          <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
        </svg>
      ),
    },
    {
      name: "Events",
      href: "/admin/events",
      count: stats.totalEvents,
      color: "bg-coral-light",
      accent: "bg-coral",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Announcements",
      href: "/admin/announcements",
      count: stats.totalAnnouncements,
      color: "bg-sunny-light",
      accent: "bg-sunny",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.881 4.345A23.112 23.112 0 0 1 8.25 6H7.5a5.25 5.25 0 0 0-.88 10.427 21.593 21.593 0 0 0 1.378 3.94c.464 1.004 1.674 1.32 2.582.796l.657-.379c.88-.508 1.165-1.593.772-2.468a17.116 17.116 0 0 1-.628-1.607c1.918.258 3.76.75 5.5 1.446A21.727 21.727 0 0 0 18 11.25c0-2.414-.393-4.735-1.119-6.905ZM18.26 3.74a23.22 23.22 0 0 1 1.24 7.51 23.22 23.22 0 0 1-1.24 7.51c-.055.161.044.348.206.404a.75.75 0 0 0 .974-.518 24.725 24.725 0 0 0 0-14.792.75.75 0 0 0-.974-.518.348.348 0 0 0-.206.404Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
          <svg className="absolute top-6 right-6 w-5 h-5 text-navy/10 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>
          <svg className="absolute bottom-8 right-20 w-3 h-3 text-coral/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
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
              <svg className="w-6 h-6 text-navy" viewBox="0 0 24 24" fill="currentColor">
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
              <svg className="w-6 h-6 text-snow" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Links Row ────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickLinks.map((link) => (
          <Link
            key={link.name}
            href={link.href}
 className="group bg-snow border-[3px] border-navy rounded-2xl p-5 press-3 press-black transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${link.color} flex items-center justify-center`}>
                <span className={`text-navy/70`}>{link.icon}</span>
              </div>
              <svg className="w-4 h-4 text-slate group-hover:text-navy transition-colors" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M8.25 3.75H19.5a.75.75 0 0 1 .75.75v11.25a.75.75 0 0 1-1.5 0V6.31L5.03 20.03a.75.75 0 0 1-1.06-1.06L17.69 5.25H8.25a.75.75 0 0 1 0-1.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm font-bold text-navy">{link.name}</p>
            <p className="text-3xl font-display font-black text-navy mt-1">{loading ? "--" : link.count}</p>
          </Link>
        ))}
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

          {/* Detailed Engagement Analytics */}
          {engagementDetail && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Active vs Inactive Students */}
              <div className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-3">Student Activity (7d)</p>
                <div className="flex items-end justify-between mb-2">
                  <p className="font-display font-black text-3xl text-teal">{engagementDetail.activeStudents7d}</p>
                  <p className="text-[10px] font-bold text-slate">/ {engagementDetail.totalStudents}</p>
                </div>
                <div className="w-full bg-cloud rounded-full h-2 mb-2">
                  <div
                    className="bg-teal rounded-full h-2 transition-all"
                    style={{ width: `${engagementDetail.totalStudents ? Math.round(engagementDetail.activeStudents7d / engagementDetail.totalStudents * 100) : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate">
                  {engagementDetail.totalStudents ? Math.round(engagementDetail.activeStudents7d / engagementDetail.totalStudents * 100) : 0}% active this week
                </p>
              </div>

              {/* Inactive Students */}
              <div className="bg-coral-light border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-3">Inactive (30d+)</p>
                <p className="font-display font-black text-3xl text-coral">{engagementDetail.inactiveStudents}</p>
                <p className="text-[10px] text-navy/50 mt-1">
                  {engagementDetail.totalStudents ? Math.round(engagementDetail.inactiveStudents / engagementDetail.totalStudents * 100) : 0}% of all students
                </p>
              </div>

              {/* Unenrolled Students */}
              <div className="bg-sunny-light border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-3">Unenrolled</p>
                <p className="font-display font-black text-3xl text-sunny">{engagementDetail.unenrolledStudents}</p>
                <p className="text-[10px] text-navy/50 mt-1">not enrolled this session</p>
              </div>

              {/* Library Velocity */}
              <div className="bg-lavender-light border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-3">Library Uploads</p>
                <div className="flex items-baseline gap-3">
                  <div>
                    <p className="font-display font-black text-3xl text-lavender">{engagementDetail.library.uploads7d}</p>
                    <p className="text-[10px] text-navy/50">this week</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-black text-xl text-navy/40">{engagementDetail.library.uploads30d}</p>
                    <p className="text-[10px] text-navy/40">30d total</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IEPOD + AI Row */}
          {engagementDetail && (engagementDetail.iepod.totalRegistrations > 0 || engagementDetail.aiUsage7d > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* IEPOD Progress */}
              {engagementDetail.iepod.totalRegistrations > 0 && (
                <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-0.5">Programme</p>
                      <h3 className="font-display font-black text-lg text-navy">IEPOD Progress</h3>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-black text-2xl text-teal">{engagementDetail.iepod.completionRate}%</p>
                      <p className="text-[10px] text-slate">completion</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate mb-3">{engagementDetail.iepod.totalRegistrations} registrations</p>
                  {Object.keys(engagementDetail.iepod.byPhase).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(engagementDetail.iepod.byPhase).map(([phase, count]) => {
                        const phaseColors: Record<string, string> = {
                          orientation: "bg-lavender-light text-lavender",
                          quiz: "bg-sunny-light text-sunny",
                          team: "bg-teal-light text-teal",
                          pitch: "bg-coral-light text-coral",
                          completed: "bg-lime-light text-lime-dark",
                        };
                        return (
                          <span key={phase} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${phaseColors[phase] || "bg-cloud text-slate"}`}>
                            {phase}: {count}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* AI Usage */}
              <div className="bg-navy border-[3px] border-lime rounded-3xl p-6 shadow-[4px_4px_0_0_#C8F31D]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-snow/50 mb-0.5">IESA AI</p>
                    <h3 className="font-display font-black text-lg text-snow">AI Usage (7d)</h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-lime/15 flex items-center justify-center">
                    <svg className="w-6 h-6 text-lime" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5Z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <p className="font-display font-black text-5xl text-lime mb-1">{engagementDetail.aiUsage7d}</p>
                <p className="text-snow/50 text-sm">rate-limit entries this week</p>
              </div>
            </div>
          )}

          {/* Registrations 7-day sparkline */}
          {engagement.registrations7d.length > 0 && (
            <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-0.5">Last 7 Days</p>
                  <h3 className="font-display font-black text-lg text-navy">New Registrations</h3>
                </div>
                <span className="text-2xl font-display font-black text-teal">
                  {engagement.registrations7d.reduce((s, d) => s + d.count, 0)}
                </span>
              </div>
              <div className="flex items-end gap-2 h-24">
                {engagement.registrations7d.map((d) => {
                  const max = Math.max(...engagement.registrations7d.map((r) => r.count), 1);
                  const pct = (d.count / max) * 100;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-navy">{d.count}</span>
                      <div
                        className="w-full bg-teal rounded-t-lg min-h-[4px]"
                        style={{ height: `${Math.max(pct, 5)}%` }}
                      />
                      <span className="text-[8px] text-slate font-bold">
                        {new Date(d.date).toLocaleDateString("en-NG", { weekday: "short" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
 className="block w-full text-center py-3 rounded-2xl bg-navy border-[3px] border-navy text-snow text-sm font-bold press-4 press-navy transition-all"
            >
              Manage Sessions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
