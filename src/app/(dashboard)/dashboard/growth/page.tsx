"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";

const TOOLS = [
  {
    id: "cgpa",
    title: "CGPA Calculator",
    desc: "Calculate your semester and cumulative GPA quickly.",
    href: "./growth/cgpa",
  },
  {
    id: "schedule-bot",
    title: "Schedule Bot",
    desc: "Smart schedule helpers and quick imports from your timetable.",
    href: "./growth/schedule-bot",
  },
  {
    id: "planner",
    title: "Personal Planner",
    desc: "Daily/weekly planner to manage tasks, deadlines and study sessions.",
    href: "./growth/planner",
  },
];

export default function GrowthPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Student Growth" />
      <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
        <p className="text-foreground/80 mb-6 max-w-2xl">
          Tools and resources to help students grow academically and professionally. Click a card to open its workspace or use the quick actions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {TOOLS.map((t) => (
            <article
              key={t.id}
              className="group relative rounded-2xl overflow-hidden p-6 bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)] shadow-lg transition-transform transform hover:-translate-y-1 hover:scale-[1.01] focus-within:scale-[1.01]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-heading font-semibold text-xl text-foreground mb-1 leading-snug">
                    {t.title}
                  </h3>
                  <p className="text-sm text-foreground/70 max-w-[20ch]">
                    {t.desc}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                    {/* simple icon */}
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Link
                  href={t.href}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-background font-semibold text-sm shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  Open
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>

                {/* <Link  */}
              </div>

              <Link
                href={t.href}
                className="absolute inset-0 z-0"
                aria-hidden
              />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
