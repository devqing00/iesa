"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import Link from "next/link";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

/* ─── Types ─────────────────────────────────────────────────────── */

interface Announcement {
  _id?: string;
  id?: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  createdAt: string;
  authorName?: string;
  author?: { firstName: string; lastName: string };
}

interface UpcomingEvent {
  _id?: string;
  id?: string;
  title: string;
  date: string;
  location?: string;
  category?: string;
}

interface PaymentItem {
  _id?: string;
  id?: string;
  title: string;
  amount: number;
  deadline: string;
  hasPaid: boolean;
}

interface ClassSession {
  _id?: string;
  courseCode: string;
  courseTitle: string;
  startTime: string;
  endTime: string;
  venue: string;
  day: string;
  classType: string;
}

/* ─── Page Component ────────────────────────────────────────────── */

export default function StudentDashboardPage() {
  const { user, userProfile, getAccessToken } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [announcementsRes, eventsRes, paymentsRes, timetableRes] =
        await Promise.allSettled([
          fetch(getApiUrl("/api/v1/announcements/"), { headers }),
          fetch(getApiUrl("/api/v1/events/"), { headers }),
          fetch(getApiUrl("/api/v1/payments/"), { headers }).catch(() => null),
          fetch(getApiUrl("/api/v1/timetable/classes"), { headers }).catch(
            () => null
          ),
        ]);

      if (announcementsRes.status === "fulfilled" && announcementsRes.value?.ok) {
        const data = await announcementsRes.value.json();
        setAnnouncements(Array.isArray(data) ? data.slice(0, 5) : []);
      }

      if (eventsRes.status === "fulfilled" && eventsRes.value?.ok) {
        const data = await eventsRes.value.json();
        const upcoming = (Array.isArray(data) ? data : [])
          .filter((e: UpcomingEvent) => new Date(e.date) >= new Date())
          .sort(
            (a: UpcomingEvent, b: UpcomingEvent) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
          )
          .slice(0, 4);
        setEvents(upcoming);
      }

      if (paymentsRes.status === "fulfilled" && paymentsRes.value?.ok) {
        const data = await paymentsRes.value.json();
        setPayments(Array.isArray(data) ? data : []);
      }

      if (timetableRes.status === "fulfilled" && timetableRes.value?.ok) {
        const data = await timetableRes.value.json();
        setClasses(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user, fetchDashboardData]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const pendingPayments = payments.filter((p) => !p.hasPaid);

  const getTodayClasses = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = days[new Date().getDay()];
    return classes
      .filter((c) => c.day === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const todayClasses = getTodayClasses();

  /* ── Event color cycling ── */
  const eventColors = [
    { bg: "bg-coral", text: "text-snow", dateBg: "bg-snow", dateText: "text-coral" },
    { bg: "bg-lavender-light", text: "text-navy", dateBg: "bg-lavender", dateText: "text-snow" },
    { bg: "bg-teal-light", text: "text-navy", dateBg: "bg-teal", dateText: "text-snow" },
    { bg: "bg-sunny-light", text: "text-navy", dateBg: "bg-sunny", dateText: "text-navy" },
  ];

  /* ── Class card color cycling ── */
  const classColors = [
    { bg: "bg-lavender", border: "border-navy", text: "text-snow", sub: "text-snow/70", timeBg: "bg-snow/20", timeTxt: "text-snow", tagBg: "bg-snow/20", tagTxt: "text-snow" },
    { bg: "bg-snow", border: "border-navy", text: "text-navy", sub: "text-slate", timeBg: "bg-cloud", timeTxt: "text-navy", tagBg: "bg-cloud", tagTxt: "text-slate" },
    { bg: "bg-teal-light", border: "border-navy", text: "text-navy", sub: "text-navy/60", timeBg: "bg-teal/20", timeTxt: "text-navy", tagBg: "bg-teal/20", tagTxt: "text-navy/70" },
    { bg: "bg-snow", border: "border-navy", text: "text-navy", sub: "text-slate", timeBg: "bg-cloud", timeTxt: "text-navy", tagBg: "bg-cloud", tagTxt: "text-slate" },
    { bg: "bg-coral-light", border: "border-navy", text: "text-navy", sub: "text-navy/60", timeBg: "bg-coral/20", timeTxt: "text-navy", tagBg: "bg-coral/20", tagTxt: "text-navy/70" },
    { bg: "bg-snow", border: "border-navy", text: "text-navy", sub: "text-slate", timeBg: "bg-cloud", timeTxt: "text-navy", tagBg: "bg-cloud", tagTxt: "text-slate" },
  ];

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Dashboard" />

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">

        {/* ═══════════════════════════════════════════════════════════
            ROW 1 — Hero Bento: Greeting (8 cols) + Classes Today (4 cols)
            ═══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-5">

          {/* — Greeting Hero — */}
          <div className="lg:col-span-8 bg-navy border-[5px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[230px] flex flex-col justify-between">
            {/* Decorative shapes */}
            <div className="absolute top-6 right-8 w-20 h-20 rounded-full bg-coral/15 pointer-events-none" />
            <div className="absolute bottom-8 right-32 w-10 h-10 rounded-lg bg-lavender/10 rotate-12 pointer-events-none" />
            <div className="absolute top-1/2 right-16 w-6 h-6 rounded-full bg-teal/15 pointer-events-none" />
            {/* Diamond sparkle */}
            <svg className="absolute top-5 right-24 w-5 h-5 text-lime/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <svg className="absolute bottom-12 right-12 w-4 h-4 text-coral/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>

            <div className="relative z-10">
              <p className="text-ghost/35 text-[10px] font-bold tracking-[0.2em] uppercase mb-3">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="font-display font-black text-4xl md:text-5xl lg:text-[3.5rem] text-ghost leading-[0.95]">
                {greeting()},
                <br />
                <span className="text-lime">{userProfile?.firstName || user?.email?.split("@")[0]}</span>
              </h1>
            </div>
            <div className="relative z-10 flex flex-wrap items-center gap-2 mt-6">
              {userProfile?.level && (
                <span className="text-[10px] font-bold text-navy bg-lime rounded-full px-3 py-1 uppercase tracking-wider">
                  {userProfile.level} Level
                </span>
              )}
              <span className="text-[10px] font-bold text-navy bg-teal rounded-full px-3 py-1 uppercase tracking-wider">
                {todayClasses.length} class{todayClasses.length !== 1 ? "es" : ""} today
              </span>
              {pendingPayments.length > 0 && (
                <span className="text-[10px] font-bold text-navy bg-coral rounded-full px-3 py-1 uppercase tracking-wider">
                  {pendingPayments.length} pending due{pendingPayments.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* — Classes Today Counter — */}
          <div className="lg:col-span-4 bg-coral border-[5px] border-navy rounded-[2rem] p-8 relative overflow-hidden flex flex-col justify-between min-h-[230px] shadow-[8px_8px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
            {/* Decorative shapes */}
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-navy/10 pointer-events-none" />
            <svg className="absolute top-4 right-5 w-5 h-5 text-navy/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>

            <div className="relative z-10">
              <p className="text-snow/70 text-[10px] font-bold tracking-[0.15em] uppercase mb-1">Classes Today</p>
              <p className="font-display font-black text-8xl md:text-[6.5rem] text-snow leading-none">
                {loading ? "--" : String(todayClasses.length).padStart(2, "0")}
              </p>
            </div>
            <Link href="/dashboard/timetable" className="relative z-10 inline-flex items-center gap-2 text-snow/80 text-xs font-bold hover:text-snow transition-colors group mt-4">
              View full timetable
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            ROW 2 — Stats Bento: 4 cards, varied colors
            ═══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {[
            {
              label: "Announcements",
              value: loading ? "--" : announcements.length,
              bg: "bg-sunny border-[4px] border-navy shadow-[5px_5px_0_0_#000]",
              iconBg: "bg-navy/10",
              iconColor: "text-navy",
              textColor: "text-navy",
              subColor: "text-navy/50",
              rotate: "rotate-[-0.5deg] hover:rotate-0",
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
                </svg>
              ),
            },
            {
              label: "Pending Dues",
              value: loading ? "--" : pendingPayments.length,
              bg: "bg-navy border-[4px] border-navy",
              iconBg: "bg-ghost/10",
              iconColor: "text-coral",
              textColor: "text-snow",
              subColor: "text-ghost/40",
              rotate: "",
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" />
                  <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
                </svg>
              ),
            },
            {
              label: "Upcoming Events",
              value: loading ? "--" : events.length,
              bg: "bg-lavender-light border-[4px] border-navy shadow-[5px_5px_0_0_#000]",
              iconBg: "bg-lavender/30",
              iconColor: "text-lavender",
              textColor: "text-navy",
              subColor: "text-navy/50",
              rotate: "rotate-[0.5deg] hover:rotate-0",
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                </svg>
              ),
            },
            {
              label: "Resources",
              value: loading ? "--" : "24+",
              bg: "bg-teal-light border-[4px] border-navy shadow-[5px_5px_0_0_#000]",
              iconBg: "bg-teal/30",
              iconColor: "text-teal",
              textColor: "text-navy",
              subColor: "text-navy/50",
              rotate: "rotate-[-0.3deg] hover:rotate-0",
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
                </svg>
              ),
            },
          ].map((stat, i) => (
            <div
              key={i}
              className={`rounded-2xl p-5 flex flex-col justify-between min-h-[135px] transition-transform ${stat.bg} ${stat.rotate}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.iconBg}`}>
                <span className={stat.iconColor}>{stat.icon}</span>
              </div>
              <div className="mt-auto">
                <p className={`text-[10px] font-bold tracking-[0.1em] uppercase mb-0.5 ${stat.subColor}`}>{stat.label}</p>
                <p className={`font-display font-black text-3xl ${stat.textColor}`}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            ROW 3 — Quick Access Bento: 6 shortcut tiles
            ═══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          {[
            { name: "Timetable", href: "/dashboard/timetable", color: "bg-lavender-light", hoverBg: "hover:bg-lavender", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" /></svg> },
            { name: "Payments", href: "/dashboard/payments", color: "bg-coral-light", hoverBg: "hover:bg-coral", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" /><path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" /></svg> },
            { name: "Events", href: "/dashboard/events", color: "bg-sunny-light", hoverBg: "hover:bg-sunny", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" /></svg> },
            { name: "Library", href: "/dashboard/library", color: "bg-teal-light", hoverBg: "hover:bg-teal", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" /></svg> },

            { name: "IESA AI", href: "/dashboard/iesa-ai", color: "bg-cloud", hoverBg: "hover:bg-ghost", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5Z" clipRule="evenodd" /></svg> },
          ].map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={`group ${link.color} ${link.hoverBg} border-[3px] border-navy rounded-2xl p-3 md:p-4 shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:-translate-y-1 transition-all text-center`}
            >
              <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-navy/15 transition-colors">
                <span className="text-navy">{link.icon}</span>
              </div>
              <p className="text-xs font-bold text-navy truncate">{link.name}</p>
            </Link>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            ROW 4 — Main Content Bento: Schedule (8) + Sidebar (4)
            ═══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-5">

          {/* ── LEFT: Schedule + Announcements stacked (8 cols) ── */}
          <div className="lg:col-span-8 space-y-4">

            {/* Today's Schedule Card */}
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-8 rounded-full bg-lavender" />
                  <h3 className="font-display font-black text-xl text-navy">Today&apos;s Schedule</h3>
                </div>
                <Link href="/dashboard/timetable" className="text-xs font-bold text-slate hover:text-navy transition-colors flex items-center gap-1">
                  Full timetable
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 bg-cloud rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : todayClasses.length === 0 ? (
                <div className="text-center py-12 bg-teal-light rounded-2xl border-[3px] border-navy/10">
                  <div className="w-14 h-14 rounded-2xl bg-teal/20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-teal" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-navy">No classes scheduled today</p>
                  <p className="text-xs text-slate mt-1">Enjoy your free time!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {todayClasses.slice(0, 6).map((cls, i) => {
                    const c = classColors[i % classColors.length];
                    return (
                      <div
                        key={cls._id || i}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-[3px] ${c.border} ${c.bg} transition-all hover:shadow-[3px_3px_0_0_#000]`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-display font-black text-sm ${c.timeBg} ${c.timeTxt}`}>
                          {cls.startTime}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${c.text}`}>{cls.courseCode}</p>
                          <p className={`text-[10px] truncate ${c.sub}`}>
                            {cls.venue} &middot; {cls.startTime}–{cls.endTime}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 shrink-0 ${c.tagBg} ${c.tagTxt}`}>
                          {cls.classType}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Announcements Card */}
            <div className="bg-sunny-light border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] rotate-[-0.3deg] hover:rotate-0 transition-transform">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-8 rounded-full bg-sunny" />
                  <h3 className="font-display font-black text-xl text-navy">Announcements</h3>
                </div>
                <Link href="/dashboard/announcements" className="text-xs font-bold text-navy/50 hover:text-navy transition-colors flex items-center gap-1">
                  View all
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-sunny/20 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-10 bg-snow rounded-2xl border-[3px] border-navy/10">
                  <p className="text-sm text-slate">No announcements yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {announcements.slice(0, 5).map((ann, idx) => (
                    <Link
                      key={ann.id || ann._id}
                      href="/dashboard/announcements"
                      className="flex items-center gap-4 p-4 rounded-2xl bg-snow hover:bg-ghost transition-colors group border-[2px] border-transparent hover:border-navy/10"
                    >
                      <span className="font-display font-black text-lg text-navy/20 w-8 text-center shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-navy group-hover:text-navy transition-colors truncate">
                          {ann.title}
                        </p>
                        <p className="text-[10px] text-slate mt-0.5">
                          {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} &middot; {ann.category}
                        </p>
                      </div>
                      {ann.priority === "urgent" && (
                        <span className="text-[10px] font-bold text-snow bg-coral rounded-full px-2.5 py-0.5 shrink-0">URGENT</span>
                      )}
                      <svg className="w-4 h-4 text-slate group-hover:text-navy transition-colors shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Stacked sidebar cards (4 cols) ── */}
          <div className="lg:col-span-4 space-y-4">

            {/* Pending Dues Card */}
            <div className="bg-coral-light border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-6 rounded-full bg-coral" />
                  <h3 className="font-display font-black text-lg text-navy">Pending Dues</h3>
                </div>
                <Link href="/dashboard/payments" className="text-[10px] font-bold text-navy/50 hover:text-navy transition-colors uppercase tracking-wider">
                  Pay
                  <svg className="w-3 h-3 inline ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 bg-snow/50 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : pendingPayments.length === 0 ? (
                <div className="bg-teal-light rounded-2xl p-5 text-center border-[3px] border-navy/10">
                  <svg className="w-8 h-8 text-teal mx-auto mb-2" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm font-bold text-teal">All clear!</p>
                  <p className="text-xs text-slate mt-1">No pending dues</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingPayments.slice(0, 3).map((p) => (
                    <div key={p._id || p.id} className="bg-snow rounded-2xl p-4 border-[3px] border-navy">
                      <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em] mb-2">{p.title}</p>
                      <div className="flex items-end justify-between">
                        <p className="font-display font-black text-2xl text-navy">&#8358;{p.amount.toLocaleString()}</p>
                        <span className="text-[10px] font-medium text-coral">
                          Due {new Date(p.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                  ))}
                  {pendingPayments.length > 3 && (
                    <Link href="/dashboard/payments" className="block text-center text-xs font-bold text-coral hover:underline py-2">
                      +{pendingPayments.length - 3} more dues
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Upcoming Events Card */}
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-6 rounded-full bg-lavender" />
                  <h3 className="font-display font-black text-lg text-navy">Upcoming</h3>
                </div>
                <Link href="/dashboard/events" className="text-[10px] font-bold text-slate hover:text-navy transition-colors uppercase tracking-wider">
                  All
                  <svg className="w-3 h-3 inline ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 bg-cloud rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-slate text-center py-6">No upcoming events</p>
              ) : (
                <div className="space-y-2">
                  {events.slice(0, 4).map((evt, i) => {
                    const ec = eventColors[i % eventColors.length];
                    return (
                      <div key={evt.id || evt._id} className={`flex items-center gap-3 p-3 rounded-2xl ${ec.bg} transition-colors`}>
                        <div className={`w-11 h-11 rounded-xl ${ec.dateBg} flex flex-col items-center justify-center shrink-0`}>
                          <span className={`text-[9px] font-bold leading-none ${ec.dateText}`}>
                            {new Date(evt.date).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                          </span>
                          <span className={`text-base font-bold leading-none ${ec.dateText}`}>
                            {new Date(evt.date).getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${ec.text}`}>{evt.title}</p>
                          {evt.location && (
                            <p className={`text-[10px] truncate ${ec.text} opacity-60`}>{evt.location}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Growth CTA */}
            <Link href="/dashboard/growth" className="block bg-teal border-[4px] border-navy rounded-3xl p-6 relative overflow-hidden group shadow-[6px_6px_0_0_#000] rotate-[-0.5deg] hover:rotate-0 transition-transform">
              {/* Decorative */}
              <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-navy/10 pointer-events-none" />
              <svg className="absolute top-3 right-4 w-4 h-4 text-navy/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
              </svg>

              <h3 className="font-display font-black text-xl text-navy mb-1 relative z-10">Growth Tools</h3>
              <p className="text-navy/60 text-xs font-medium relative z-10 mb-3">CGPA, planner, goals &amp; more</p>
              <span className="inline-flex items-center gap-1.5 text-navy text-xs font-bold relative z-10 group-hover:gap-2.5 transition-all bg-snow/30 rounded-full px-3 py-1.5">
                Explore
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </span>
            </Link>

            {/* IESA AI CTA */}
            <Link href="/dashboard/iesa-ai" className="block bg-navy border-[4px] border-navy rounded-3xl p-6 relative overflow-hidden group">
              <svg className="absolute top-4 right-5 w-5 h-5 text-lavender/20 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
              </svg>
              <div className="w-10 h-10 rounded-xl bg-lavender/20 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5Z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="font-display font-black text-lg text-ghost mb-1">IESA AI</h3>
              <p className="text-ghost/40 text-xs font-medium mb-3">Ask anything about the department</p>
              <span className="inline-flex items-center gap-1.5 text-lavender text-xs font-bold group-hover:gap-2.5 transition-all">
                Start chatting
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
