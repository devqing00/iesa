"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useMemo } from "react";

// Helper function to generate dynamic, time-based greetings
const getTimeBasedGreeting = (userName: string) => {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;

  if (hour >= 5 && hour < 12) {
    return {
      greeting: `Good morning, ${userName}`,
      message:
        "Ready to make today count? Let's start strong and achieve great things.",
      period: "Morning",
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: `Good afternoon, ${userName}`,
      message: isWeekend
        ? "Hope you're having a relaxing weekend! Take time to recharge and explore."
        : "You're doing great! Keep up the momentum and stay focused on your goals.",
      period: "Afternoon",
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      greeting: `Good evening, ${userName}`,
      message:
        "Winding down? Don't forget to review today's achievements and plan for tomorrow.",
      period: "Evening",
    };
  } else {
    return {
      greeting: `Burning the midnight oil, ${userName}?`,
      message:
        "Remember to take breaks and get enough rest. Your wellbeing matters!",
      period: "Night",
    };
  }
};

export default function DashboardPage() {
  const { user } = useAuth();

  const greeting = useMemo(() => {
    const firstName = user?.displayName?.split(" ")[0] || "Engineer";
    return getTimeBasedGreeting(firstName);
  }, [user]);

  const stats = [
    { label: "Upcoming Events", value: "3", number: "01" },
    { label: "Library Resources", value: "24", number: "02" },
    { label: "Payment Status", value: "Paid", number: "03" },
  ];

  const announcements = [
    { title: "General Meeting This Friday", time: "2 hours ago", unread: true },
    {
      title: "T-Shirt Collection Starts Monday",
      time: "5 hours ago",
      unread: true,
    },
    {
      title: "Career Fair Registration Open",
      time: "1 day ago",
      unread: false,
    },
  ];

  const quickActions = [
    {
      label: "Calculate CGPA",
      href: "/dashboard/growth/cgpa",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
      ),
    },
    {
      label: "View Events",
      href: "/dashboard/events",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
          />
        </svg>
      ),
    },
    {
      label: "Library",
      href: "/dashboard/library",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
          />
        </svg>
      ),
    },
    {
      label: "Payments",
      href: "/dashboard/payments",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
          />
        </svg>
      ),
    },
    {
      label: "IESA Team",
      href: "/dashboard/team/central",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
          />
        </svg>
      ),
    },
    {
      label: "My Profile",
      href: "/dashboard/profile",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
      ),
    },
  ];

  const aiSuggestions = [
    "Show my timetable",
    "Payment help",
    "Study tips",
    "Events this week",
  ];

  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="Overview" />

      <div className="p-4 md:p-8 space-y-8 pb-24 md:pb-8">
        {/* Hero Section */}
        <section className="bg-charcoal dark:bg-cream py-12 px-6 md:px-12 relative">
          <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

          <div className="relative max-w-4xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-label-sm text-cream/60 dark:text-charcoal/60 flex items-center gap-2">
                <span>✦</span> {greeting.period}
              </span>
            </div>

            <h1 className="font-display text-display-md text-cream dark:text-charcoal mb-4">
              {greeting.greeting}
            </h1>

            <p className="text-cream/70 dark:text-charcoal/70 text-body max-w-2xl mb-8">
              {greeting.message}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/dashboard/iesa-ai"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-cream dark:bg-charcoal text-charcoal dark:text-cream text-label transition-colors hover:bg-cream-dark dark:hover:bg-charcoal-light"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
                Chat with IESA AI
              </Link>

              <Link
                href="/dashboard/growth"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-cream/30 dark:border-charcoal/30 text-cream dark:text-charcoal text-label transition-colors hover:bg-cream/10 dark:hover:bg-charcoal/10"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                  />
                </svg>
                View My Progress
              </Link>
            </div>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="border-t border-border pt-8">
          <div className="flex items-center justify-between mb-6">
            <span className="text-label-sm text-text-muted flex items-center gap-2">
              <span>◆</span> Quick Stats
            </span>
            <span className="page-number">Page 01</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.number}
                className="border border-border p-6 space-y-4 hover:border-border-dark transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-label-sm text-text-muted">
                    {stat.number}
                  </span>
                  <span className="text-label-sm text-text-muted">◆</span>
                </div>
                <div>
                  <div className="font-display text-3xl text-text-primary mb-1">
                    {stat.value}
                  </div>
                  <div className="text-body text-sm text-text-secondary">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Recent Announcements */}
          <section className="lg:col-span-7 border-t border-border pt-8">
            <div className="flex items-center justify-between mb-6">
              <span className="text-label-sm text-text-muted flex items-center gap-2">
                <span>✦</span> Recent Announcements
              </span>
              <Link
                href="/dashboard/announcements"
                className="text-label-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
              >
                View all
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </Link>
            </div>

            <div className="space-y-2">
              {announcements.map((item, i) => (
                <Link
                  key={i}
                  href="/dashboard/announcements"
                  className={`block p-4 border transition-colors ${
                    item.unread
                      ? "border-border-dark bg-bg-secondary"
                      : "border-border hover:border-border-dark"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-1.5 h-1.5 mt-2 shrink-0 ${
                        item.unread ? "bg-text-primary" : "bg-text-muted"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-body font-medium text-text-primary truncate">
                        {item.title}
                      </h4>
                      <p className="text-label-sm text-text-muted mt-1">
                        {item.time}
                      </p>
                    </div>
                    {item.unread && (
                      <span className="text-label-sm bg-charcoal dark:bg-cream text-cream dark:text-charcoal px-2 py-0.5">
                        New
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="lg:col-span-5 border-t border-border pt-8">
            <div className="flex items-center justify-between mb-6">
              <span className="text-label-sm text-text-muted flex items-center gap-2">
                <span>◆</span> Quick Actions
              </span>
              <span className="page-number">Page 02</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="p-4 border border-border hover:border-border-dark hover:bg-bg-secondary transition-colors group"
                >
                  <div className="text-text-secondary group-hover:text-text-primary transition-colors mb-3">
                    {action.icon}
                  </div>
                  <span className="text-body text-sm text-text-primary">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* AI Assistant Section */}
        <section className="border-t border-border pt-8">
          <div className="flex items-center justify-between mb-6">
            <span className="text-label-sm text-text-muted flex items-center gap-2">
              <span>✦</span> IESA AI Assistant
            </span>
            <span className="page-number">Page 03</span>
          </div>

          <div className="border border-border p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="w-16 h-16 bg-charcoal dark:bg-cream flex items-center justify-center shrink-0">
                <svg
                  className="w-8 h-8 text-cream dark:text-charcoal"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                  />
                </svg>
              </div>

              <div className="flex-1">
                <h3 className="font-display text-xl text-text-primary mb-2">
                  Need help with anything?
                </h3>
                <p className="text-body text-sm text-text-secondary mb-4">
                  IESA AI knows your schedule, payment status, upcoming events,
                  and can answer any questions about the department.
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {aiSuggestions.map((q) => (
                    <Link
                      key={q}
                      href={`/dashboard/iesa-ai?q=${encodeURIComponent(q)}`}
                      className="px-3 py-1.5 border border-border text-label-sm text-text-secondary hover:border-border-dark hover:text-text-primary transition-colors"
                    >
                      {q}
                    </Link>
                  ))}
                </div>

                <Link
                  href="/dashboard/iesa-ai"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-charcoal dark:bg-cream text-cream dark:text-charcoal text-label transition-colors hover:bg-charcoal-light dark:hover:bg-cream-dark"
                >
                  Start Chatting
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
