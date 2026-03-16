"use client";

import Link from "next/link";
import { withAuth } from "@/lib/withAuth";
import { TeamHeadPortal } from "@/app/(admin)/admin/team-head/page";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { usePermissions } from "@/context/PermissionsContext";

function StudentTeamHeadPage() {
  const { hasPermission, loading: permissionsLoading, loaded: permissionsLoaded } = usePermissions();

  if (permissionsLoading || !permissionsLoaded) {
    return (
      <div className="min-h-screen bg-ghost p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-snow border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000]">
            <p className="font-bold text-navy">Loading team portal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasPermission("team_head:view_members")) {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader />
        <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <section className="bg-snow border-4 border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000]">
            <p className="text-label text-slate">TEAM HEAD PORTAL</p>
            <h1 className="font-display font-black text-display-md text-navy mt-2">Team Head Access Required</h1>
            <p className="text-slate mt-3">
              This page is only available to students assigned as Team Heads in the active session.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/teams"
                className="bg-lime border-[3px] border-navy press-3 press-navy rounded-2xl px-5 py-2.5 text-sm font-bold text-navy"
              >
                Go to Teams
              </Link>
              <Link
                href="/dashboard/applications"
                className="bg-snow border-[3px] border-navy press-3 press-black rounded-2xl px-5 py-2.5 text-sm font-bold text-navy"
              >
                View Applications
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return <TeamHeadPortal />;
}

export default withAuth(StudentTeamHeadPage);
