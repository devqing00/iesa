"use client";

import Link from "next/link";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { usePermissions } from "@/context/PermissionsContext";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

const UNITS = [
  {
    name: "Press",
    description: "The IESA Press ecosystem — write, edit, and publish articles for the association.",
    href: "/dashboard/press",
    accent: "bg-lavender",
    accentLight: "bg-lavender-light",
    rotation: "rotate-[-0.6deg]",
    anyPermission: ["press:access", "press:create", "press:edit", "press:publish"],
    icon: (
      <svg className="w-8 h-8 text-navy" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 0 0 3 3h15a3 3 0 0 1-3-3V4.875C17.25 3.839 16.41 3 15.375 3H4.125ZM12 9.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H12Zm-.75-2.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1-.75-.75ZM6 12.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5H6Zm-.75 3.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75ZM6 6.75a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75v-3A.75.75 0 0 0 9 6.75H6Z" clipRule="evenodd" />
        <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 0 1-3 0V6.75Z" />
      </svg>
    ),
  },
  {
    name: "Applications",
    description: "Apply for unit roles within IESA — press, committee positions, and more.",
    href: "/dashboard/applications",
    accent: "bg-coral",
    accentLight: "bg-coral-light",
    rotation: "rotate-[0.5deg]",
    anyPermission: null,
    icon: (
      <svg className="w-8 h-8 text-navy" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.583-.164 3.023 3.023 0 0 0-2.251 2.996Z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M2.25 13.5a3 3 0 0 0 3 3h1.228a3.375 3.375 0 0 1-.978-2.375v-9.75a3.375 3.375 0 0 1 3-3.357H13.5a3 3 0 0 1 3 3v1.107a3.375 3.375 0 0 1 .878 2.618v6.007a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-1.25Z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export default function UnitsPage() {
  const { hasPermission } = usePermissions();
  const { showHelp, openHelp, closeHelp } = useToolHelp("units");

  const visibleUnits = UNITS.filter((u) => {
    if (!u.anyPermission) return true;
    return u.anyPermission.some((p) => hasPermission(p));
  });

  return (
    <>
      <DashboardHeader />
      <ToolHelpModal toolId="units" isOpen={showHelp} onClose={closeHelp} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-black text-display-lg text-navy">
              <span className="brush-highlight">Units</span>
            </h1>
            <p className="mt-2 text-slate text-body">
              IESA operational units — apply for roles or manage your unit work.
            </p>
          </div>
          <HelpButton onClick={openHelp} />
        </div>

        {/* Unit cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {visibleUnits.map((unit) => (
            <Link
              key={unit.name}
              href={unit.href}
              className={`group bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] ${unit.rotation} hover:rotate-0 transition-transform`}
            >
              <div className={`w-14 h-14 ${unit.accentLight} rounded-2xl flex items-center justify-center mb-4 border-[3px] border-navy group-hover:scale-105 transition-transform`}>
                {unit.icon}
              </div>
              <h2 className="font-display font-black text-xl text-navy mb-1">{unit.name}</h2>
              <p className="text-sm text-slate leading-relaxed">{unit.description}</p>
              <div className="mt-4 flex items-center gap-2 text-navy font-display font-bold text-sm">
                Open
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {visibleUnits.length === 0 && (
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
            <p className="font-display font-black text-xl text-navy mb-2">No units available</p>
            <p className="text-sm text-slate">You don&apos;t have access to any units yet. Apply or check back later.</p>
          </div>
        )}
      </div>
    </>
  );
}
