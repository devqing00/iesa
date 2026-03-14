"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { getMyIepodProfile, getMyTimpInfo } from "@/lib/api";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { usePermissions } from "@/context/PermissionsContext";

const HUBS = [
  {
    name: "IEPOD",
    description: "Industrial Engineering Professional & Organizational Development — explore your niche, take quizzes, and level up.",
    href: "/dashboard/iepod",
    accent: "bg-coral",
    accentLight: "bg-coral-light",
    border: "border-coral",
    rotation: "rotate-[-0.5deg]",
    icon: (
      <svg className="w-8 h-8 text-navy" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    name: "TIMP",
    description: "Technical & Industrial Mentorship Programme — connect with mentors, track progress, and grow professionally.",
    href: "/dashboard/timp",
    accent: "bg-teal",
    accentLight: "bg-teal-light",
    border: "border-teal",
    rotation: "rotate-[0.5deg]",
    icon: (
      <svg className="w-8 h-8 text-navy" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A18.034 18.034 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export default function HubsPage() {
  const { showHelp, openHelp, closeHelp } = useToolHelp("hubs");
  const { hasAnyPermission } = usePermissions();
  const [iepodStatus, setIepodStatus] = useState<string | null>(null);
  const [timpStatus, setTimpStatus] = useState<string | null>(null);
  const isIepodAdminRole = hasAnyPermission(["iepod:manage"]);
  const iepodHref = isIepodAdminRole ? "/dashboard/iepod/manage" : "/dashboard/iepod";

  useEffect(() => {
    getMyIepodProfile()
      .then((p) => {
        if (p?.registered) {
          const reg = p.registration;
          if (reg?.completedPhases?.length === 3) setIepodStatus("Completed");
          else if (reg?.status === "approved") setIepodStatus("Active");
          else if (reg?.status === "pending") setIepodStatus("Pending");
          else setIepodStatus("Registered");
        }
      })
      .catch(() => {});
    getMyTimpInfo()
      .then((info) => {
        if (info.isMentor && info.pairs.length > 0) setTimpStatus("Mentoring");
        else if (info.isMentee) setTimpStatus("Paired");
        else if (info.application) setTimpStatus(info.application.status === "approved" ? "Approved Mentor" : "Applied");
      })
      .catch(() => {});
  }, []);

  const statusMap: Record<string, string | null> = {
    IEPOD: isIepodAdminRole ? "Admin" : iepodStatus,
    TIMP: timpStatus,
  };

  return (
    <>
      <DashboardHeader />
      <ToolHelpModal toolId="hubs" isOpen={showHelp} onClose={closeHelp} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-black text-display-lg text-navy">
              <span className="brush-highlight">Hubs</span>
            </h1>
            <p className="mt-2 text-slate text-body">
              Programmes designed to accelerate your growth as an Industrial Engineer.
            </p>
          </div>
          <HelpButton onClick={openHelp} />
        </div>

        {/* Hub cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {HUBS.map((hub) => {
            const status = statusMap[hub.name];
            return (
              <Link
                key={hub.name}
                href={hub.name === "IEPOD" ? iepodHref : hub.href}
                className={`group bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] ${hub.rotation} hover:rotate-0 transition-transform`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 ${hub.accentLight} rounded-2xl flex items-center justify-center border-[3px] border-navy group-hover:scale-105 transition-transform`}>
                    {hub.icon}
                  </div>
                  {status && (
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${hub.accentLight} text-navy uppercase tracking-wider`}>
                      {status}
                    </span>
                  )}
                </div>
                <h2 className="font-display font-black text-xl text-navy mb-1">{hub.name}</h2>
                <p className="text-sm text-slate leading-relaxed">{hub.description}</p>
                <div className="mt-4 flex items-center gap-2 text-navy font-display font-bold text-sm">
                  Open Hub
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
