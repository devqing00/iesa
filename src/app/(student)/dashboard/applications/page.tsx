"use client";

import { useState, useEffect } from "react";
import {
  createApplication,
  getMyApplications,
  UNIT_LABELS,
  UNIT_DESCRIPTIONS,
  UNIT_COLORS,
  api,
} from "@/lib/api";
import type { UnitApplication, UnitType, CreateApplicationData } from "@/lib/api";

/* ─── Unit-to-role position mapping ────────────── */
const UNIT_ROLE_POSITIONS: Record<UnitType, string[]> = {
  press: ["press_member", "press_head"],
  committee_academic: ["committee_academic_member", "committee_head_academic"],
  committee_welfare: ["committee_welfare_member", "committee_head_welfare"],
  committee_sports: ["committee_sports_member", "committee_head_sports"],
  committee_socials: ["committee_socials_member", "committee_head_social"],
};

/* ─── Constants ─────────────────────────────────── */

const ALL_UNITS: UnitType[] = [
  "press",
  "committee_academic",
  "committee_welfare",
  "committee_sports",
  "committee_socials",
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-sunny-light", text: "text-navy", label: "Pending" },
  accepted: { bg: "bg-teal", text: "text-snow", label: "Accepted" },
  rejected: { bg: "bg-coral", text: "text-snow", label: "Rejected" },
};

/* ─── Unit Icons (SVG) ─────────────────────────── */

function UnitIcon({ unit, className = "w-8 h-8" }: { unit: UnitType; className?: string }) {
  switch (unit) {
    case "press":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 0 0 3 3h15a3 3 0 0 1-3-3V4.875C17.25 3.839 16.41 3 15.375 3H4.125ZM12 9.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H12Zm-.75-2.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1-.75-.75ZM6 12.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5H6Zm-.75 3.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75ZM6 6.75a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75v-3A.75.75 0 0 0 9 6.75H6Z" clipRule="evenodd" />
          <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 0 1-3 0V6.75Z" />
        </svg>
      );
    case "committee_academic":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.173v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
          <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.711 47.878 47.878 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.205 47.205 0 0 0-1.346-.808c-.364-.216-.46-.555-.283-.885a6.7 6.7 0 0 0 .3-.643.75.75 0 0 0-.228-.876 48.316 48.316 0 0 0-4.681-3.281c-.21.5-.396 1.012-.557 1.535a.75.75 0 0 1-1.024.447 50.01 50.01 0 0 0-3.32-1.345.75.75 0 0 1-.46-.71c.035-1.442.121-2.87.255-4.286A48.354 48.354 0 0 1 5 13.238v3.858a13.09 13.09 0 0 0-1.138 1.397.75.75 0 0 1-1.268-.142 12.56 12.56 0 0 0-.472-.93l-.21.362a.75.75 0 0 1-.764.382A61.39 61.39 0 0 1 .5 17.996 60.976 60.976 0 0 1 5 13.238Z" />
        </svg>
      );
    case "committee_welfare":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
        </svg>
      );
    case "committee_sports":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
        </svg>
      );
    case "committee_socials":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
          <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
        </svg>
      );
  }
}

/* ─── Page Component ───────────────────────────── */

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<UnitApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [memberRoles, setMemberRoles] = useState<Set<string>>(new Set());

  // Modal state
  const [selectedUnit, setSelectedUnit] = useState<UnitType | null>(null);
  const [motivation, setMotivation] = useState("");
  const [skills, setSkills] = useState("");

  /* ── Fetch my applications ──────────────────── */
  const fetchApplications = async () => {
    try {
      const data = await getMyApplications();
      setApplications(data);
    } catch {
      // toast handled by api client
    } finally {
      setLoading(false);
    }
  };

  /* ── Fetch my roles to detect direct membership ── */
  const fetchMyRoles = async () => {
    try {
      const me = await api.get<{ _id?: string; id?: string }>("/api/v1/users/me");
      const userId = me.id || me._id || "";
      if (!userId) return;
      const roles = await api.get<{ position: string; isActive: boolean }[]>(
        `/api/v1/roles?user_id=${userId}`
      );
      const positions = new Set(
        roles.filter((r) => r.isActive).map((r) => r.position)
      );
      setMemberRoles(positions);
    } catch {
      // non-critical, ignore
    }
  };

  useEffect(() => {
    fetchApplications();
    fetchMyRoles();
  }, []);

  /* ── Derive which units already have active apps ── */
  const appliedUnits = new Set(
    applications
      .filter((a) => a.status === "pending" || a.status === "accepted")
      .map((a) => a.unit)
  );

  /* ── Submit application ─────────────────────── */
  const handleSubmit = async () => {
    if (!selectedUnit) return;
    if (motivation.trim().length < 20) return;

    setSubmitting(true);
    try {
      const data: CreateApplicationData = {
        unit: selectedUnit,
        motivation: motivation.trim(),
      };
      if (skills.trim()) data.skills = skills.trim();

      await createApplication(data);
      setSelectedUnit(null);
      setMotivation("");
      setSkills("");
      fetchApplications();
    } catch {
      // toast handled by api client
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render ─────────────────────────────────── */
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 space-y-8">
      {/* ─── Header ─────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-block px-3 py-1 text-label bg-lavender text-snow rounded-full">
            Units & Committees
          </span>
        </div>
        <h1 className="font-display font-black text-display-lg text-navy">
          <span className="brush-highlight">Join a Unit</span>
        </h1>
        <p className="text-slate mt-2 max-w-2xl">
          Apply to join IESA units and committees. Each unit plays a vital role in making the department thrive.
          Your application will be reviewed by the unit head.
        </p>
      </div>

      {/* ─── Unit Cards Grid ────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {ALL_UNITS.map((unit, idx) => {
          const colors = UNIT_COLORS[unit];
          const hasApplied = appliedUnits.has(unit);
          const existingApp = applications.find(
            (a) => a.unit === unit && (a.status === "pending" || a.status === "accepted")
          );
          // Check if user already has a role for this unit (assigned directly)
          const rolePositions = UNIT_ROLE_POSITIONS[unit] || [];
          const isHeadViaRole = rolePositions.some(
            (pos) => memberRoles.has(pos) && (pos.includes("head") || pos.includes("lead"))
          );
          const isMemberViaRole = rolePositions.some((pos) => memberRoles.has(pos));
          const isMember = hasApplied || isMemberViaRole;
          const rotations = ["rotate-[-1deg]", "rotate-[0.5deg]", "rotate-[-0.5deg]", "rotate-[1deg]", "rotate-0"];
          const rotation = rotations[idx % rotations.length];

          return (
            <div
              key={unit}
              className={`${colors.bg} border-[3px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] ${rotation} hover:rotate-0 transition-transform`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${colors.badge} border-[3px] border-navy rounded-2xl p-3`}>
                  <UnitIcon unit={unit} className="w-7 h-7 text-navy" />
                </div>
                {(existingApp || isMemberViaRole) && (
                  <span
                    className={`${
                      isHeadViaRole
                        ? "bg-lime text-navy"
                        : isMemberViaRole || existingApp?.status === "accepted"
                        ? "bg-teal text-snow"
                        : `${STATUS_STYLES[existingApp?.status || "pending"].bg} ${STATUS_STYLES[existingApp?.status || "pending"].text}`
                    } text-label px-3 py-1 rounded-full border-[2px] border-navy`}
                  >
                    {isHeadViaRole ? "Head" : isMemberViaRole || existingApp?.status === "accepted" ? "Member" : STATUS_STYLES[existingApp?.status || "pending"].label}
                  </span>
                )}
              </div>

              <h3 className="font-display font-black text-display-sm text-navy mb-2">
                {UNIT_LABELS[unit]}
              </h3>
              <p className="text-sm text-navy-muted leading-relaxed mb-5">
                {UNIT_DESCRIPTIONS[unit]}
              </p>

              {isMember ? (
                <div className="flex items-center gap-2 text-sm font-medium">
                  <svg className="w-5 h-5 text-teal" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                  <span className="text-navy-muted">
                    {isHeadViaRole
                      ? "You lead this unit!"
                      : existingApp?.status === "pending"
                      ? "Your application is under review."
                      : "You are a member of this unit!"}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setSelectedUnit(unit);
                    setMotivation("");
                    setSkills("");
                  }}
                  className="bg-navy border-[3px] border-navy text-snow px-5 py-2.5 rounded-xl font-display font-bold text-sm
                    press-3 press-navy w-full"
                >
                  Apply Now
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── My Applications ────────────────── */}
      <div>
        <h2 className="font-display font-black text-display-sm text-navy mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-lavender" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.583-.164 3.023 3.023 0 0 0-2.251 2.996Z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M2.25 13.5a3 3 0 0 0 3 3h1.228a3.375 3.375 0 0 1-.978-2.375v-9.75a3.375 3.375 0 0 1 3-3.357H13.5a3 3 0 0 1 3 3v1.107a3.375 3.375 0 0 1 .878 2.618v6.007a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-1.25Z" clipRule="evenodd" />
          </svg>
          My Applications
        </h2>

        {loading ? (
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-12 shadow-[6px_6px_0_0_#000] flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-navy border-t-lime rounded-full animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-8 shadow-[6px_6px_0_0_#000] text-center">
            <p className="text-slate font-medium">You haven&apos;t applied to any unit yet.</p>
            <p className="text-sm text-slate mt-1">Pick a unit above to get started!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => {
              const colors = UNIT_COLORS[app.unit as UnitType];
              const statusStyle = STATUS_STYLES[app.status];
              return (
                <div
                  key={app.id}
                  className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[5px_5px_0_0_#000] flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className={`${colors.badge} border-[3px] border-navy rounded-2xl p-3 shrink-0 w-fit`}>
                    <UnitIcon unit={app.unit as UnitType} className="w-6 h-6 text-navy" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-bold text-navy">{app.unitLabel}</h4>
                    <p className="text-sm text-slate truncate">{app.motivation}</p>
                    <p className="text-xs text-slate mt-1">
                      Applied {new Date(app.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={`${statusStyle.bg} ${statusStyle.text} text-label px-3 py-1 rounded-full border-[2px] border-navy`}
                    >
                      {statusStyle.label}
                    </span>
                    {app.feedback && (
                      <p className="text-xs text-slate italic max-w-[200px] text-right">
                        &ldquo;{app.feedback}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Application Modal ──────────────── */}
      {selectedUnit && (
        <div className="fixed inset-0 bg-navy/60 z-[70] flex items-center justify-center p-4" onClick={() => setSelectedUnit(null)}>
          <div
            className="bg-snow border-[3px] border-navy rounded-3xl shadow-[10px_10px_0_0_#000] w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`${UNIT_COLORS[selectedUnit].bg} border-b-[4px] border-navy rounded-t-[20px] p-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`${UNIT_COLORS[selectedUnit].badge} border-[3px] border-navy rounded-2xl p-3`}>
                    <UnitIcon unit={selectedUnit} className="w-6 h-6 text-navy" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-lg text-navy">
                      Apply to {UNIT_LABELS[selectedUnit]}
                    </h3>
                    <p className="text-sm text-navy-muted">Tell us why you want to join</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUnit(null)}
                  title="Close"
                  className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center hover:bg-navy/20 transition-colors"
                >
                  <svg className="w-4 h-4 text-navy" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              {/* Motivation */}
              <div>
                <label className="block font-display font-bold text-sm text-navy mb-2">
                  Why do you want to join? <span className="text-coral">*</span>
                </label>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  placeholder="Share your motivation, what you hope to contribute, and what excites you about this unit..."
                  rows={5}
                  maxLength={1000}
                  className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 text-sm text-navy placeholder:text-slate
                    focus:outline-none focus:ring-2 focus:ring-lime resize-none"
                />
                <div className="flex justify-between mt-1">
                  <p className={`text-xs ${motivation.trim().length < 20 && motivation.length > 0 ? "text-coral" : "text-slate"}`}>
                    {motivation.trim().length < 20 && motivation.length > 0
                      ? `At least 20 characters required (${motivation.trim().length}/20)`
                      : "Min 20 characters"}
                  </p>
                  <p className="text-xs text-slate">{motivation.length}/1000</p>
                </div>
              </div>

              {/* Skills */}
              <div>
                <label className="block font-display font-bold text-sm text-navy mb-2">
                  Relevant Skills <span className="text-slate font-normal">(optional)</span>
                </label>
                <textarea
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="E.g., writing, graphic design, event planning, public speaking..."
                  rows={3}
                  maxLength={500}
                  className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 text-sm text-navy placeholder:text-slate
                    focus:outline-none focus:ring-2 focus:ring-lime resize-none"
                />
                <p className="text-xs text-slate text-right mt-1">{skills.length}/500</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t-[3px] border-cloud px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedUnit(null)}
                className="bg-transparent border-[3px] border-navy px-5 py-2.5 rounded-xl font-display font-bold text-sm text-navy
                  hover:bg-navy hover:text-snow transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || motivation.trim().length < 20}
                className="bg-lime border-[3px] border-navy px-6 py-2.5 rounded-xl font-display font-bold text-sm text-navy
                  press-3 press-navy
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  "Submit Application"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
