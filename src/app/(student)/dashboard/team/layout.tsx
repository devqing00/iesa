"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import TeamNav from "@/components/dashboard/TeamNav";

const TEAM_MOTTO = "Team Sustainability";

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="IESA Team" />
      <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
        <TeamNav />
        <div className="flex justify-center md:justify-end mt-4 mb-8">
          <div
            className="flex items-center gap-3 text-sm text-foreground/90"
            aria-label={`Team motto: ${TEAM_MOTTO}`}
          >
            <svg
              className="h-5 w-5 text-primary/80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2s4 4 4 8-4 8-4 8-4-4-4-8 4-8 4-8z" />
              <path d="M8 8c1.5 1 4 1 6 0" />
            </svg>
            <span className="font-medium text-foreground">{TEAM_MOTTO}</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
