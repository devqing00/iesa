"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  createApplication,
  getMyApplications,
  fetchTeamRegistry,
  getTeamColors,
  api,
} from "@/lib/api";
import type {
  TeamApplication,
  TeamRegistryEntry,
  CreateApplicationData,
} from "@/lib/api";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ─── Constants ─────────────────────────────────── */

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-sunny-light", text: "text-navy", label: "Pending" },
  accepted: { bg: "bg-teal", text: "text-snow", label: "Accepted" },
  rejected: { bg: "bg-coral", text: "text-snow", label: "Rejected" },
  revoked: { bg: "bg-cloud", text: "text-slate", label: "Revoked" },
};

/* ─── Generic Team Icon ────────────────────────── */

function TeamIcon({ colorKey, className = "w-8 h-8" }: { colorKey: string; className?: string }) {
  const iconMap: Record<string, React.JSX.Element> = {
    // Press — newspaper
    lavender: (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 0 0 3 3h15a3 3 0 0 1-3-3V4.875C17.25 3.839 16.41 3 15.375 3H4.125ZM12 9.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H12Zm-.75-2.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1-.75-.75ZM6 12.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5H6Zm-.75 3.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75ZM6 6.75a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75v-3A.75.75 0 0 0 9 6.75H6Z" clipRule="evenodd" />
        <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 0 1-3 0V6.75Z" />
      </svg>
    ),
    // ICS — paint brush
    coral: (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M20.599 1.5c-.376 0-.743.111-1.055.32l-5.08 3.385a18.747 18.747 0 0 0-3.471 2.987 10.04 10.04 0 0 1 4.815 4.815 18.748 18.748 0 0 0 2.987-3.472l3.386-5.079A1.902 1.902 0 0 0 20.599 1.5Zm-8.3 6.7a18.79 18.79 0 0 0-3.949 5.049 15.04 15.04 0 0 1-2.4-2.418A18.792 18.792 0 0 0 .96 14.834 18.05 18.05 0 0 0 5.07 19.13a18.05 18.05 0 0 0 4.297 4.11 18.792 18.792 0 0 0 4.503-5.35 15.04 15.04 0 0 1-2.418-2.4 18.79 18.79 0 0 0 5.049-3.949 10.04 10.04 0 0 0-4.202-3.341Z" clipRule="evenodd" />
      </svg>
    ),
    // Teal — building/factory
    teal: (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.006 3.705a.75.75 0 1 0-.512-1.41L6 6.838V3a.75.75 0 0 0-.75-.75h-1.5A.75.75 0 0 0 3 3v4.93l-1.006.365a.75.75 0 0 0 .512 1.41l16.5-6Z" />
        <path fillRule="evenodd" d="M3.019 11.114 18 5.667V9.56l4.228 1.691a.75.75 0 0 1 .458.693v8.306a.75.75 0 0 1-.75.75h-6a.75.75 0 0 1-.75-.75V17.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75v2.75a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75v-9.136h.019ZM12 12.75a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H12Zm2.25.75a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V13.5ZM9.75 15a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75v-.008a.75.75 0 0 0-.75-.75H9.75ZM12 15.75a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H12.75a.75.75 0 0 1-.75-.75v-.008Zm2.25-.75a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75v-.008a.75.75 0 0 0-.75-.75H14.25Z" clipRule="evenodd" />
      </svg>
    ),
    // Sunny — megaphone / logistics
    sunny: (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.881 4.345A23.112 23.112 0 0 1 8.25 6H7.5a5.25 5.25 0 0 0-.88 10.427 21.593 21.593 0 0 0 1.378 3.94c.464 1.004 1.674 1.32 2.582.796l.657-.379c.88-.508 1.165-1.593.772-2.468a17.116 17.116 0 0 1-.628-1.607c1.918.258 3.76.75 5.5 1.446A21.727 21.727 0 0 0 18 11.25c0-2.414-.393-4.735-1.119-6.905ZM18.26 3.74a23.22 23.22 0 0 1 1.24 7.51 23.22 23.22 0 0 1-1.24 7.51c-.055.161-.111.322-.17.482a.75.75 0 1 0 1.409.516 24.555 24.555 0 0 0 1.415-6.43.75.75 0 0 0 .09-.286h-.003a24.72 24.72 0 0 0-.09-1.792 24.555 24.555 0 0 0-1.415-6.43.75.75 0 1 0-1.409.516c.059.16.116.321.17.483Z" />
      </svg>
    ),
    // Lime — sparkles
    lime: (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 8.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
      </svg>
    ),
  };
  return (
    iconMap[colorKey] ?? (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
        <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
      </svg>
    )
  );
}

/* ─── Page Component ───────────────────────────── */

export default function ApplicationsPage() {
  const { showHelp, openHelp, closeHelp } = useToolHelp("applications");
  const [teams, setTeams] = useState<TeamRegistryEntry[]>([]);
  const [applications, setApplications] = useState<TeamApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [memberRoles, setMemberRoles] = useState<Set<string>>(new Set());

  // Modal state
  const [selectedTeam, setSelectedTeam] = useState<TeamRegistryEntry | null>(null);
  const [motivation, setMotivation] = useState("");
  const [skills, setSkills] = useState("");
  const [subTeam, setSubTeam] = useState("");
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  /* ── Fetch data ─────────────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      const [teamsData, appsData] = await Promise.all([
        fetchTeamRegistry(),
        getMyApplications(),
      ]);
      setTeams(teamsData);
      setApplications(appsData);
    } catch {
      // toast handled by api client
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Fetch my roles to detect direct membership ── */
  const fetchMyRoles = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchData();
    fetchMyRoles();
  }, [fetchData, fetchMyRoles]);

  /* ── Derive which teams already have active apps ── */
  const appliedTeams = new Set(
    applications
      .filter((a) => a.status === "pending" || a.status === "accepted")
      .map((a) => a.team)
  );

  /* ── Open modal for a team ──────────────────── */
  const openApplyModal = (team: TeamRegistryEntry) => {
    setSelectedTeam(team);
    setMotivation("");
    setSkills("");
    setSubTeam("");
    setCustomAnswers({});
  };

  /* ── Submit application ─────────────────────── */
  const handleSubmit = async () => {
    if (!selectedTeam) return;
    if (motivation.trim().length < 20) return;
    if (selectedTeam.subTeams && selectedTeam.subTeams.length > 0 && !subTeam) return;

    setSubmitting(true);
    try {
      const data: CreateApplicationData = {
        team: selectedTeam.slug,
        motivation: motivation.trim(),
      };
      if (skills.trim()) data.skills = skills.trim();
      if (subTeam) data.subTeam = subTeam;
      if (Object.keys(customAnswers).length > 0) data.customAnswers = customAnswers;

      await createApplication(data);
      setSelectedTeam(null);
      fetchData();
    } catch {
      // toast handled by api client
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Detect membership status for a team ──── */
  const getTeamStatus = (teamSlug: string) => {
    const existingApp = applications.find(
      (a) => a.team === teamSlug && (a.status === "pending" || a.status === "accepted")
    );
    // Check common role position patterns for this team
    const teamPositions = Array.from(memberRoles).filter(
      (pos) => pos.includes(teamSlug)
    );
    const isHeadViaRole = teamPositions.some((pos) => pos.includes("head") || pos.includes("lead"));
    const isMemberViaRole = teamPositions.length > 0;

    return { existingApp, isHeadViaRole, isMemberViaRole, hasApplied: appliedTeams.has(teamSlug) };
  };

  /* ── Render ─────────────────────────────────── */
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-navy border-t-lime rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 space-y-8">
      <ToolHelpModal toolId="applications" isOpen={showHelp} onClose={closeHelp} />
      {/* ─── Header ─────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-block px-3 py-1 text-label bg-lavender text-snow rounded-full">
              IESA Teams
            </span>
          </div>
          <h1 className="font-display font-black text-display-lg text-navy">
            <span className="brush-highlight">Join a Team</span>
          </h1>
          <p className="text-slate mt-2 max-w-2xl">
            Apply to join IESA teams. Each team plays a vital role in making the department thrive.
            Your application will be reviewed by the team head.
          </p>
        </div>
        <HelpButton onClick={openHelp} />
      </div>

      {/* ─── Team Cards Grid ────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {teams.map((team, idx) => {
          const colors = getTeamColors(team.colorKey);
          const { existingApp, isHeadViaRole, isMemberViaRole, hasApplied } = getTeamStatus(team.slug);
          const isMember = hasApplied || isMemberViaRole;
          const rotations = ["rotate-[-1deg]", "rotate-[0.5deg]", "rotate-[-0.5deg]", "rotate-[1deg]", "rotate-0"];
          const rotation = rotations[idx % rotations.length];

          return (
            <div
              key={team.slug}
              className={`${colors.bg} border-[3px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] ${rotation} hover:rotate-0 transition-transform`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${colors.badge} border-[3px] border-navy rounded-2xl p-3`}>
                  <TeamIcon colorKey={team.colorKey} className="w-7 h-7 text-navy" />
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
                {team.label}
              </h3>
              <p className="text-sm text-navy-muted leading-relaxed mb-2">
                {team.description}
              </p>

              {/* Sub-team indicator */}
              {team.subTeams && team.subTeams.length > 0 && (
                <p className="text-xs text-slate mb-4">
                  Sub-teams: {team.subTeams.join(", ")}
                </p>
              )}

              {!team.subTeams && <div className="mb-3" />}

              {isMember ? (
                <div className="flex items-center gap-2 text-sm font-medium">
                  <svg aria-hidden="true" className="w-5 h-5 text-teal" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                  <span className="text-navy-muted">
                    {isHeadViaRole
                      ? "You lead this team!"
                      : existingApp?.status === "pending"
                      ? "Your application is under review."
                      : "You are a member of this team!"}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => openApplyModal(team)}
                  className="bg-navy border-[3px] border-lime text-snow px-5 py-2.5 rounded-xl font-display font-bold text-sm
                    press-3 press-lime w-full"
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
          <svg aria-hidden="true" className="w-6 h-6 text-lavender" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.583-.164 3.023 3.023 0 0 0-2.251 2.996Z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M2.25 13.5a3 3 0 0 0 3 3h1.228a3.375 3.375 0 0 1-.978-2.375v-9.75a3.375 3.375 0 0 1 3-3.357H13.5a3 3 0 0 1 3 3v1.107a3.375 3.375 0 0 1 .878 2.618v6.007a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-1.25Z" clipRule="evenodd" />
          </svg>
          My Applications
        </h2>

        {applications.length === 0 ? (
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-8 shadow-[6px_6px_0_0_#000] text-center">
            <p className="text-slate font-medium">You haven&apos;t applied to any team yet.</p>
            <p className="text-sm text-slate mt-1">Pick a team above to get started!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => {
              const colors = getTeamColors(
                teams.find((t) => t.slug === app.team)?.colorKey || "slate"
              );
              const statusStyle = STATUS_STYLES[app.status] || STATUS_STYLES.pending;
              return (
                <div
                  key={app.id}
                  className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[5px_5px_0_0_#000] flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className={`${colors.badge} border-[3px] border-navy rounded-2xl p-3 shrink-0 w-fit`}>
                    <TeamIcon
                      colorKey={teams.find((t) => t.slug === app.team)?.colorKey || "slate"}
                      className="w-6 h-6 text-navy"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-bold text-navy">{app.teamLabel}</h4>
                    {app.subTeam && (
                      <p className="text-xs text-lavender font-medium">Sub-team: {app.subTeam}</p>
                    )}
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
      {selectedTeam && (
        <div className="fixed inset-0 bg-navy/60 z-[70] flex items-center justify-center p-4" onClick={() => setSelectedTeam(null)}>
          <div
            className="bg-snow border-[3px] border-navy rounded-3xl shadow-[10px_10px_0_0_#000] w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`${getTeamColors(selectedTeam.colorKey).bg} border-b-[4px] border-navy rounded-t-[20px] p-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`${getTeamColors(selectedTeam.colorKey).badge} border-[3px] border-navy rounded-2xl p-3`}>
                    <TeamIcon colorKey={selectedTeam.colorKey} className="w-6 h-6 text-navy" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-lg text-navy">
                      Apply to {selectedTeam.label}
                    </h3>
                    <p className="text-sm text-navy-muted">Tell us why you want to join</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTeam(null)}
                  title="Close"
                  className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center hover:bg-navy/20 transition-colors"
                >
                  <svg aria-hidden="true" className="w-4 h-4 text-navy" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              {/* Sub-team selection (if team requires it) */}
              {selectedTeam.subTeams && selectedTeam.subTeams.length > 0 && (
                <div>
                  <label className="block font-display font-bold text-sm text-navy mb-2">
                    Select Sub-team <span className="text-coral">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedTeam.subTeams.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSubTeam(st)}
                        className={`text-left px-4 py-3 border-[3px] rounded-2xl text-sm font-medium transition-all ${
                          subTeam === st
                            ? "border-lime bg-lime-light text-navy"
                            : "border-cloud bg-snow text-navy hover:border-navy"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Motivation */}
              <div>
                <label className="block font-display font-bold text-sm text-navy mb-2">
                  Why do you want to join? <span className="text-coral">*</span>
                </label>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  placeholder="Share your motivation, what you hope to contribute, and what excites you about this team..."
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
                  Relevant Skills{" "}
                  {selectedTeam.requiresSkills ? (
                    <span className="text-coral">*</span>
                  ) : (
                    <span className="text-slate font-normal">(optional)</span>
                  )}
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

              {/* Custom questions */}
              {selectedTeam.customQuestions && selectedTeam.customQuestions.length > 0 && (
                <>
                  {selectedTeam.customQuestions.map((q) => (
                    <div key={q.key}>
                      <label className="block font-display font-bold text-sm text-navy mb-2">
                        {q.label} <span className="text-coral">*</span>
                      </label>
                      <textarea
                        value={customAnswers[q.key] || ""}
                        onChange={(e) =>
                          setCustomAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))
                        }
                        placeholder={`Answer: ${q.label}`}
                        rows={3}
                        maxLength={500}
                        className="w-full border-[3px] border-navy rounded-2xl px-4 py-3 text-sm text-navy placeholder:text-slate
                          focus:outline-none focus:ring-2 focus:ring-lime resize-none"
                      />
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t-[3px] border-cloud px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedTeam(null)}
                className="bg-transparent border-[3px] border-navy px-5 py-2.5 rounded-xl font-display font-bold text-sm text-navy
                  hover:bg-navy hover:text-lime hover:border-lime transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  motivation.trim().length < 20 ||
                  (selectedTeam.requiresSkills && !skills.trim()) ||
                  (!!selectedTeam.subTeams && selectedTeam.subTeams.length > 0 && !subTeam)
                }
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
