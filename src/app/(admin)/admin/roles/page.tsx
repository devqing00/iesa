"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { withAuth } from "@/lib/withAuth";
import RolesTab from "@/components/admin/RolesTab";
import ApplicationsTab from "@/components/admin/ApplicationsTab";

/* ─── Tabs ─────────────────────────────────── */

type Tab = "roles" | "applications";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "roles",
    label: "Roles",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "applications",
    label: "Applications",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.583-.164 3.023 3.023 0 0 0-2.251 2.996Z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M2.25 13.5a3 3 0 0 0 3 3h1.228a3.375 3.375 0 0 1-.978-2.375v-9.75a3.375 3.375 0 0 1 3-3.357H13.5a3 3 0 0 1 3 3v1.107a3.375 3.375 0 0 1 .878 2.618v6.007a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-1.25Z" clipRule="evenodd" />
      </svg>
    ),
  },
];

/* ─── Inner (needs searchParams) ────────────── */

function RolesPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam === "applications" ? "applications" : "roles"
  );

  // Sync URL → state
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "applications") setActiveTab("applications");
    else setActiveTab("roles");
  }, [searchParams]);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    router.replace(`/admin/roles${tab === "roles" ? "" : "?tab=applications"}`, { scroll: false });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate mb-1">Administration</p>
          <h1 className="font-display font-black text-3xl md:text-4xl text-navy">
            <span className="brush-highlight">Roles</span> & Applications
          </h1>
          <p className="text-sm text-slate mt-1">Manage executive roles and review unit applications</p>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-2">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-display font-bold text-sm border-[3px] transition-all ${
              activeTab === key
                ? "bg-navy border-navy text-snow"
                : "bg-snow border-navy text-navy hover:bg-cloud"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === "roles" ? <RolesTab /> : <ApplicationsTab />}
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
