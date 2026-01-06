"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import TeamNav from "@/components/dashboard/TeamNav";

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-primary">
      <DashboardHeader title="IESA Team" />
      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto w-full">
          {/* Editorial Header */}
          <div className="mb-10 pb-8 border-b border-border">
            <div className="text-center space-y-4">
              {/* Top Accent */}
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-12 md:w-20 bg-border" />
                <span className="text-text-muted">✦</span>
                <div className="h-px w-12 md:w-20 bg-border" />
              </div>

              {/* Main Title */}
              <h1 className="font-display text-display-md">
                Team Sustainability
              </h1>

              {/* Supporting Text */}
              <p className="text-text-secondary text-body text-sm max-w-xl mx-auto leading-relaxed">
                United in purpose, driven by excellence. Our team brings
                together passionate individuals committed to building a
                sustainable and thriving community for all members.
              </p>

              {/* Bottom Accent */}
              <div className="flex items-center justify-center gap-4 pt-2">
                <div className="h-px w-8 md:w-12 bg-border" />
                <span className="text-text-muted text-xs">◆</span>
                <div className="h-px w-8 md:w-12 bg-border" />
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <TeamNav />

          {/* Page Content */}
          {children}
        </div>
      </div>
    </div>
  );
}
