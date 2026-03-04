"use client";

import { Suspense } from "react";
import { withAuth } from "@/lib/withAuth";
import RolesTab from "@/components/admin/RolesTab";

/* ─── Inner (needs Suspense boundary) ───────── */

function RolesPageInner() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Administration</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Roles</span> Management
          </h1>
          <p className="text-sm text-slate mt-1">Assign and manage executive, committee, and special roles</p>
        </div>
      </div>

      <RolesTab />
    </div>
  );
}

/* ─── Page (wrapped with Suspense for useSearchParams) ── */

function RolesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RolesPageInner />
    </Suspense>
  );
}

export default withAuth(RolesPage, {
  anyPermission: ["role:create", "role:view", "role:edit", "user:edit"],
});
