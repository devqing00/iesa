"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";

/* ─── Types ─── */
interface TeamMember {
  position: string;
  user: { firstName: string; lastName: string; email: string };
}

interface TeamLead {
  team: string;
  teamLabel: string;
  isCustom: boolean;
  lead: { firstName: string; lastName: string; email: string } | null;
}

/* ─── Helpers ─── */
const POSITION_LABELS: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  general_secretary: "General Secretary",
  assistant_general_secretary: "Asst. General Secretary",
  treasurer: "Treasurer",
  social_director: "Social Director",
  sports_secretary: "Sports Secretary",
  assistant_sports_secretary: "Asst. Sports Secretary",
  pro: "Public Relations Officer",
  financial_secretary: "Financial Secretary",
  director_of_socials: "Director of Socials",
  director_of_sports: "Director of Sports",
  director_of_welfare: "Director of Welfare",
  committee_academic: "Academic Committee",
  committee_welfare: "Welfare Committee",
  committee_sports: "Sports Committee",
  committee_socials: "Socials Committee",
};
const getPositionLabel = (pos: string) => {
  if (pos.startsWith("class_rep_")) {
    const level = pos.replace("class_rep_", "").toUpperCase();
    return `${level} Class Rep`;
  }
  return POSITION_LABELS[pos] || pos.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://iesa.onrender.com";

const ACCENT_CYCLE = [
  { border: "border-l-coral", bg: "bg-coral-light", dot: "bg-coral", iconBg: "bg-coral/30" },
  { border: "border-l-teal", bg: "bg-teal-light", dot: "bg-teal", iconBg: "bg-teal/30" },
  { border: "border-l-lavender", bg: "bg-lavender-light", dot: "bg-lavender", iconBg: "bg-lavender/30" },
  { border: "border-l-sunny", bg: "bg-sunny-light", dot: "bg-sunny", iconBg: "bg-sunny/30" },
  { border: "border-l-lime", bg: "bg-lime-light", dot: "bg-lime", iconBg: "bg-lime/30" },
];

/* ─── Tabs ─── */
type TabKey = "central" | "classreps" | "teams";
const TABS: { key: TabKey; label: string; dot: string; bgLight: string }[] = [
  { key: "central", label: "Central Excos", dot: "bg-coral", bgLight: "bg-coral-light" },
  { key: "classreps", label: "Class Reps", dot: "bg-lavender", bgLight: "bg-lavender-light" },
  { key: "teams", label: "Teams & Leads", dot: "bg-teal", bgLight: "bg-teal-light" },
];

/* ─── Component ─── */
export default function PublicTeamPage() {
  const [tab, setTab] = useState<TabKey>("central");
  const [executives, setExecutives] = useState<TeamMember[]>([]);
  const [classReps, setClassReps] = useState<TeamMember[]>([]);
  const [teamsAndLeads, setTeamsAndLeads] = useState<TeamLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [execRes, repsRes, teamsRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/roles/public/executives`),
          fetch(`${API_BASE}/api/v1/roles/public/class-reps`),
          fetch(`${API_BASE}/api/v1/roles/public/teams-leads`),
        ]);
        if (execRes.ok) setExecutives(await execRes.json());
        if (repsRes.ok) setClassReps(await repsRes.json());
        if (teamsRes.ok) setTeamsAndLeads(await teamsRes.json());
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const president = executives.find((e) => e.position === "president");
  const otherExcos = executives.filter((e) => e.position !== "president");

  const currentMembersCount =
    tab === "central" ? executives.length : tab === "classreps" ? classReps.length : teamsAndLeads.length;

  return (
    <div className="min-h-screen bg-ghost text-navy overflow-x-hidden">
      {[
        { cls: "top-16 left-[7%] w-3 h-3 md:w-5 md:h-5 text-teal/14 animate-float-slow" },
        { cls: "hidden md:block top-[28%] right-[12%] w-7 h-7 text-coral/14 animate-float-medium" },
        { cls: "hidden md:block bottom-[36%] left-[5%] w-6 h-6 text-lavender/16 animate-float-slow" },
        { cls: "bottom-[16%] right-[10%] w-3 h-3 md:w-6 md:h-6 text-sunny/16 animate-float-fast" },
      ].map((item, i) => (
        <svg
          key={i}
          className={`fixed ${item.cls} pointer-events-none z-0`}
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
        </svg>
      ))}

      <Header />

      <main id="main-content" className="pt-14 sm:pt-16">
        <section className="pt-12 pb-12 md:pt-16 md:pb-16 relative md:min-h-[calc(100vh-5rem)] flex flex-col justify-center">
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <div className="absolute -top-2 right-[5%] w-20 h-20 md:w-40 md:h-40 rounded-3xl bg-lime-light border-[4px] border-navy/15 animate-float-slow" />
            <div className="hidden md:block absolute top-[34%] left-[2%] w-32 h-32 rounded-2xl bg-coral-light border-[4px] border-navy/15 animate-float-fast" />
            <div className="absolute bottom-[12%] right-[11%] w-14 h-14 md:w-28 md:h-28 rounded-2xl bg-lavender-light border-[4px] border-navy/15 animate-float-medium" />
            <div className="hidden md:block absolute inset-x-0 top-[42%] h-32 bg-[radial-gradient(ellipse_at_center,oklch(95%_0.08_128/.45)_0%,transparent_72%)]" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative z-10">
            <div className="max-w-4xl">
              <p className="text-label uppercase tracking-wider text-slate mb-3">IESA Leadership</p>
              <h1 className="font-display font-black text-[2.1rem] sm:text-[3.8rem] lg:text-[5rem] leading-[0.9] text-navy max-w-[13ch]">
                Meet the{" "}
                <span className="brush-highlight">IESA Team</span>
              </h1>
              <p className="text-base sm:text-lg text-navy-muted mt-4 max-w-2xl">
                Meet the student leaders driving Industrial &amp; Production Engineering growth — from executive strategy to class coordination and technical teams.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5">
              <div className="bg-snow border-[4px] border-navy rounded-3xl p-4 md:p-5 shadow-[4px_4px_0_0_#000] md:shadow-[6px_6px_0_0_#000] md:rotate-[-0.5deg] md:hover:rotate-0 transition-transform">
                <p className="text-label-sm text-slate uppercase">Executive Roles</p>
                <p className="font-display font-black text-3xl md:text-4xl text-navy mt-1">{executives.length}</p>
              </div>
              <div className="bg-lavender-light border-[4px] border-navy rounded-3xl p-4 md:p-5 shadow-[4px_4px_0_0_#000] md:shadow-[6px_6px_0_0_#000] md:rotate-[0.4deg] md:hover:rotate-0 transition-transform">
                <p className="text-label-sm text-slate uppercase">Class Reps</p>
                <p className="font-display font-black text-3xl md:text-4xl text-navy mt-1">{classReps.length}</p>
              </div>
              <div className="bg-teal-light border-[4px] border-navy rounded-3xl p-4 md:p-5 shadow-[4px_4px_0_0_#000] md:shadow-[6px_6px_0_0_#000] md:rotate-[-0.3deg] md:hover:rotate-0 transition-transform">
                <p className="text-label-sm text-slate uppercase">Teams</p>
                <p className="font-display font-black text-3xl md:text-4xl text-navy mt-1">{teamsAndLeads.length}</p>
              </div>
            </div>

            <div className="bg-snow border-[4px] border-navy rounded-3xl p-2 shadow-[4px_4px_0_0_#000] md:shadow-[6px_6px_0_0_#000] md:sticky md:top-20 z-20">
              <div className="flex flex-wrap md:flex-nowrap gap-2 overflow-visible md:overflow-x-auto scrollbar-hide">
                {TABS.map((t) => {
                  const isActive = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`flex-1 md:flex-none min-w-0 shrink-0 flex items-center justify-center gap-1.5 px-3 md:px-5 py-2.5 rounded-2xl font-display font-bold text-[11px] md:text-xs uppercase tracking-[0.08em] transition-all ${
                        isActive
                          ? `${t.bgLight} border-[3px] border-navy text-navy shadow-[4px_4px_0_0_#0F0F2D]`
                          : "border-[3px] border-transparent text-navy/50 hover:text-navy hover:bg-cloud"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isActive ? t.dot : "bg-navy/20"}`} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Loading ── */}
            {loading && (
              <div className="flex items-center justify-center py-16">
                <div className="w-10 h-10 border-[3px] border-navy border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* ── Empty ── */}
            {!loading && currentMembersCount === 0 && (
              <div className="bg-snow border-[3px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
                <p className="font-display font-black text-xl text-navy mb-2">No members assigned yet</p>
                <p className="text-sm text-slate">Check back once positions have been assigned for the current session.</p>
              </div>
            )}

            {/* ── Central Excos Tab ── */}
            {!loading && tab === "central" && executives.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
                <div className="lg:col-span-5 lg:sticky lg:top-28 self-start">
                  {president && (
                    <div className="bg-navy border-[4px] border-lime rounded-[2rem] p-5 md:p-8 shadow-[6px_6px_0_0_#C8F31D] md:shadow-[8px_8px_0_0_#C8F31D] relative overflow-hidden">
                      <div className="absolute -top-10 -right-8 w-20 h-20 md:w-28 md:h-28 rounded-full bg-lime/20" />
                      <div className="absolute -bottom-10 -left-10 w-24 h-24 md:w-32 md:h-32 rounded-full bg-teal/15" />
                      <p className="text-label-sm uppercase text-lime tracking-widest mb-3">President</p>
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-lime border-[3px] border-navy flex items-center justify-center">
                          <span className="font-display font-black text-2xl text-navy">{president.user.firstName[0]}</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display font-black text-xl md:text-2xl text-snow leading-tight truncate">
                            {president.user.firstName} {president.user.lastName}
                          </h3>
                          <p className="text-snow/70 text-xs uppercase tracking-[0.08em] mt-1">Executive Lead</p>
                        </div>
                      </div>
                      <a
                        href={`mailto:${president.user.email}`}
                        className="mt-5 inline-flex items-center gap-1.5 text-snow/70 hover:text-snow transition-colors text-sm font-medium"
                      >
                        <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                        {president.user.email}
                      </a>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  {otherExcos.map((exco, i) => {
                    const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
                    const highlight = i < 2;
                    return (
                      <article
                        key={exco.position}
                        className={`bg-snow border-[4px] border-navy border-l-[8px] ${accent.border} rounded-3xl ${highlight ? "p-5 md:p-6 shadow-[6px_6px_0_0_#000] md:shadow-[8px_8px_0_0_#000]" : "p-4 md:p-5 shadow-[5px_5px_0_0_#000] md:shadow-[6px_6px_0_0_#000]"} hover:-translate-y-0.5 transition-all`}
                      >
                        {highlight && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sunny-light border-[3px] border-navy font-display font-bold text-[10px] uppercase tracking-[0.08em] text-navy mb-3">
                            Spotlight
                          </span>
                        )}
                        <div className="flex items-start gap-3.5">
                          <div className={`w-13 h-13 rounded-xl ${accent.iconBg} border-[3px] border-navy flex items-center justify-center shrink-0`}>
                            <span className="font-display font-black text-xl text-navy">{exco.user.firstName[0]}</span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display font-black text-lg text-navy truncate">
                              {exco.user.firstName} {exco.user.lastName}
                            </h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${accent.bg} text-[10px] font-bold uppercase tracking-[0.08em] text-navy mt-1`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                              {getPositionLabel(exco.position)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t-[3px] border-cloud">
                          <a href={`mailto:${exco.user.email}`} className="inline-flex items-center gap-1.5 text-sm text-navy-muted hover:text-navy transition-colors">
                            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                            <span className="truncate">{exco.user.email}</span>
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Class Reps Tab ── */}
            {!loading && tab === "classreps" && classReps.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {classReps.map((rep, i) => {
                  const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
                  return (
                    <div
                      key={rep.position}
                      className={`bg-snow border-[4px] border-navy border-l-[8px] ${accent.border} rounded-3xl p-4 md:p-5 shadow-[5px_5px_0_0_#000] md:shadow-[6px_6px_0_0_#000] hover:-translate-y-0.5 transition-all`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl ${accent.iconBg} flex items-center justify-center flex-shrink-0 border-[3px] border-navy`}>
                          <span className="font-display font-black text-lg text-navy">{rep.user.firstName[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-black text-base text-navy">
                            {rep.user.firstName} {rep.user.lastName}
                          </h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${accent.bg} font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em] mt-0.5`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                            {getPositionLabel(rep.position)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t-[3px] border-navy/15">
                        <a href={`mailto:${rep.user.email}`} className="inline-flex items-center gap-1.5 text-navy/50 hover:text-navy transition-colors text-sm font-medium">
                          <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                          <span className="truncate">{rep.user.email}</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Teams & Leads Tab ── */}
            {!loading && tab === "teams" && teamsAndLeads.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {teamsAndLeads.map((team, i) => {
                  const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
                  return (
                    <div
                      key={team.team}
                      className={`bg-snow border-[4px] border-navy border-l-[8px] ${accent.border} rounded-3xl p-4 md:p-5 shadow-[5px_5px_0_0_#000] md:shadow-[6px_6px_0_0_#000] hover:-translate-y-0.5 transition-all`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl ${accent.iconBg} flex items-center justify-center flex-shrink-0 border-[3px] border-navy`}>
                          <span className="font-display font-black text-lg text-navy">{team.teamLabel[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-black text-base text-navy">
                            {team.teamLabel}
                          </h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${accent.bg} font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em] mt-0.5`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                            {team.lead ? `${team.lead.firstName} ${team.lead.lastName}` : "Lead not assigned"}
                          </span>
                        </div>
                      </div>
                      {team.lead ? (
                        <div className="mt-3 pt-3 border-t-[3px] border-navy/15">
                          <a href={`mailto:${team.lead.email}`} className="inline-flex items-center gap-1.5 text-navy-muted hover:text-navy transition-colors text-sm font-medium">
                            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                            <span className="truncate">{team.lead.email}</span>
                          </a>
                        </div>
                      ) : (
                        <div className="mt-3 pt-3 border-t-[3px] border-navy/15">
                          <p className="text-sm text-slate">Lead assignment pending.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-navy border-[4px] border-lime rounded-3xl p-5 md:p-7 shadow-[6px_6px_0_0_#C8F31D] md:shadow-[8px_8px_0_0_#C8F31D] relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-lime/20" />
              <p className="text-label-sm text-lime uppercase tracking-widest">Want to reach the team?</p>
              <h2 className="font-display font-black text-2xl md:text-display-sm text-snow mt-2">
                Connect with IESA leadership directly.
              </h2>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/contact" className="bg-lime border-[4px] border-navy rounded-2xl px-6 py-3 press-5 press-navy font-display font-black text-navy">
                  Contact IESA
                </Link>
                <Link href="/history" className="bg-transparent border-[3px] border-lime rounded-2xl px-5 py-3 text-lime font-display font-bold hover:bg-lime hover:text-navy transition-colors">
                  Explore our story
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
