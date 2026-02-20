"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import Link from "next/link";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

/* ─── Types ──────────────────────────────────────── */

interface DashboardStats {
  totalStudents: number;
  totalEnrollments: number;
  totalPayments: number;
  totalEvents: number;
  totalAnnouncements: number;
  activeSession: string | null;
}

interface ChartData {
  enrollmentsByLevel: { level: string; count: number }[];
  paymentsByStatus: { name: string; value: number }[];
}

const LEVEL_COLORS = ["#C8F31D", "#9B8AF5", "#FF7B5C", "#6ECFC9", "#F5C842"];
const PAYMENT_COLORS: Record<string, string> = {
  successful: "#6ECFC9",
  pending: "#F5C842",
  failed: "#FF7B5C",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-snow border-[3px] border-navy rounded-2xl px-4 py-3 shadow-[4px_4px_0_0_#000]">
        <p className="font-display font-black text-navy text-sm">{label}</p>
        <p className="text-navy/70 font-bold text-sm">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ─── Component ──────────────────────────────────── */

export default function AdminDashboardPage() {
  const { user, getAccessToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalEnrollments: 0,
    totalPayments: 0,
    totalEvents: 0,
    totalAnnouncements: 0,
    activeSession: null,
  });
  const [charts, setCharts] = useState<ChartData>({
    enrollmentsByLevel: [],
    paymentsByStatus: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, enrollmentsRes, eventsRes, announcementsRes, sessionsRes, paymentsRes] = await Promise.allSettled([
        fetch(getApiUrl("/api/v1/users/"), { headers }),
        fetch(getApiUrl("/api/v1/enrollments/"), { headers }),
        fetch(getApiUrl("/api/v1/events/"), { headers }),
        fetch(getApiUrl("/api/v1/announcements/"), { headers }),
        fetch(getApiUrl("/api/v1/sessions/"), { headers }),
        fetch(getApiUrl("/api/v1/payments/"), { headers }),
      ]);

      const users = usersRes.status === "fulfilled" && usersRes.value.ok ? await usersRes.value.json() : [];
      const enrollments = enrollmentsRes.status === "fulfilled" && enrollmentsRes.value.ok ? await enrollmentsRes.value.json() : [];
      const events = eventsRes.status === "fulfilled" && eventsRes.value.ok ? await eventsRes.value.json() : [];
      const announcements = announcementsRes.status === "fulfilled" && announcementsRes.value.ok ? await announcementsRes.value.json() : [];
      const sessions = sessionsRes.status === "fulfilled" && sessionsRes.value.ok ? await sessionsRes.value.json() : [];
      const payments = paymentsRes.status === "fulfilled" && paymentsRes.value.ok ? await paymentsRes.value.json() : [];

      const activeSession = Array.isArray(sessions) ? sessions.find((s: Record<string, unknown>) => s.isActive) : null;

      setStats({
        totalStudents: Array.isArray(users) ? users.length : 0,
        totalEnrollments: Array.isArray(enrollments) ? enrollments.length : 0,
        totalPayments: Array.isArray(payments) ? payments.length : 0,
        totalEvents: Array.isArray(events) ? events.length : 0,
        totalAnnouncements: Array.isArray(announcements) ? announcements.length : 0,
        activeSession: activeSession ? `${activeSession.name}` : null,
      });

      // ── Build chart data ──────────────────────────────────────
      if (Array.isArray(enrollments)) {
        const levelMap: Record<string, number> = {};
        for (const e of enrollments) {
          const lvl = e.level ? `${e.level}L` : "Other";
          levelMap[lvl] = (levelMap[lvl] ?? 0) + 1;
        }
        const orderedLevels = ["100L","200L","300L","400L","500L"];
        const enrollmentsByLevel = [
          ...orderedLevels.filter(l => levelMap[l]).map(l => ({ level: l, count: levelMap[l] })),
          ...Object.entries(levelMap).filter(([k]) => !orderedLevels.includes(k)).map(([k, v]) => ({ level: k, count: v })),
        ];
        setCharts(prev => ({ ...prev, enrollmentsByLevel }));
      }

      if (Array.isArray(payments)) {
        const statusMap: Record<string, number> = {};
        for (const p of payments) {
          const st = (p.status as string) ?? "unknown";
          statusMap[st] = (statusMap[st] ?? 0) + 1;
        }
        const paymentsByStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }));
        setCharts(prev => ({ ...prev, paymentsByStatus }));
      }
    } catch {
      toast.error("Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (user) fetchStats();
  }, [user, fetchStats]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

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
        <div className="md:col-span-7 bg-navy border-[4px] border-lime rounded-3xl p-8 relative overflow-hidden">
          {/* Decorative diamonds */}
          <svg className="absolute top-6 right-6 w-5 h-5 text-lime/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>
          <svg className="absolute bottom-8 right-20 w-3 h-3 text-coral/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>

          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-lime/60 mb-6">
              Total Students Registered
            </p>
            <p className="font-display font-black text-6xl md:text-7xl text-lime mb-2">
              {loading ? "---" : stats.totalStudents}
            </p>
            <p className="text-ghost/50 text-sm">enrolled across all sessions</p>
          </div>
        </div>

        {/* Right column — 2 stacked cards spanning 5 cols */}
        <div className="md:col-span-5 grid grid-rows-2 gap-4">
          {/* Enrollments — lime card */}
          <div className="bg-lime border-[4px] border-navy rounded-3xl p-6 flex items-center justify-between shadow-[6px_6px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
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
          <div className="bg-coral border-[4px] border-navy rounded-3xl p-6 flex items-center justify-between shadow-[6px_6px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
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
            className="group bg-snow border-[4px] border-navy rounded-2xl p-5 hover:shadow-[8px_8px_0_0_#000] hover:-translate-y-1 transition-all"
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
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
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
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={charts.enrollmentsByLevel} barSize={36}>
                <XAxis dataKey="level" tick={{ fontFamily: "inherit", fontSize: 11, fontWeight: 700, fill: "#3F3F5C" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontFamily: "inherit", fontSize: 11, fill: "#3F3F5C" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(200,243,29,0.08)" }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {charts.enrollmentsByLevel.map((_, i) => (
                    <Cell key={i} fill={LEVEL_COLORS[i % LEVEL_COLORS.length]} stroke="#0F0F2D" strokeWidth={2} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payments by Status */}
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
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
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={charts.paymentsByStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  strokeWidth={2}
                  stroke="#0F0F2D"
                >
                  {charts.paymentsByStatus.map((entry, i) => (
                    <Cell key={i} fill={PAYMENT_COLORS[entry.name] ?? LEVEL_COLORS[i % LEVEL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
<Legend
                  formatter={(value) => (
                    <span className="font-display font-black text-xs capitalize text-navy">
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom Row ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-black text-lg text-navy">Recent Activity</h3>
            <Link href="/admin/announcements" className="text-xs font-bold text-teal hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { label: "Dashboard loaded", time: "Just now", accent: "border-l-teal" },
              { label: "System status: healthy", time: "1m ago", accent: "border-l-lime" },
              { label: "Admin panel active", time: "2m ago", accent: "border-l-lavender" },
            ].map((item, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl bg-ghost border-l-[4px] ${item.accent}`}>
                <div className="w-8 h-8 rounded-xl bg-cloud flex items-center justify-center shrink-0">
                  <span className="text-slate text-xs font-bold">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {loading ? (
                    <div className="h-4 bg-cloud rounded-xl animate-pulse w-3/4" />
                  ) : (
                    <p className="text-sm text-navy/70 font-medium">{item.label}</p>
                  )}
                </div>
                <span className="text-[10px] text-slate font-bold">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Session Status */}
        <div className="bg-lavender border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
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
              className="block w-full text-center py-3 rounded-2xl bg-navy border-[3px] border-navy text-lime text-sm font-bold hover:shadow-[4px_4px_0_0_#C8F31D] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
            >
              Manage Sessions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
