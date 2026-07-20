"use client";

import { Suspense } from "react";
import { withAuth } from "@/lib/withAuth";
import RolesTab from "@/components/admin/RolesTab";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ─── Inner (needs Suspense boundary) ───────── */

function RolesPageInner() {
  const { showHelp, openHelp, closeHelp } = useToolHelp("admin-roles");
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <ToolHelpModal toolId="admin-roles" isOpen={showHelp} onClose={closeHelp} />
      <div className="flex justify-end mb-3">
        <HelpButton onClick={openHelp} />
      </div>
      {/* 🚀 Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Administration</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Roles</span> Management
          </h1>
          <p className="text-sm text-slate mt-1">Assign and manage executive, team, and special roles</p>
        </div>
        
        <div>
          <a href="/admin/roles/audit" className="px-5 py-2.5 bg-lavender/10 text-lavender font-bold border-[2px] border-lavender rounded-xl hover:bg-lavender hover:text-snow transition-colors flex items-center gap-2 shadow-[2px_2px_0_0_#000]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Audit Logs
          </a>
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
  requiredPermission: "role:view",
});
