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
type TabKey = "central" | "classreps" | "committees";
const TABS: { key: TabKey; label: string; dot: string; bgLight: string }[] = [
  { key: "central", label: "Central Excos", dot: "bg-coral", bgLight: "bg-coral-light" },
  { key: "classreps", label: "Class Reps", dot: "bg-lavender", bgLight: "bg-lavender-light" },
  { key: "committees", label: "Committees", dot: "bg-teal", bgLight: "bg-teal-light" },
];

/* ─── Component ─── */
export default function PublicTeamPage() {
  const [tab, setTab] = useState<TabKey>("central");
  const [executives, setExecutives] = useState<TeamMember[]>([]);
  const [classReps, setClassReps] = useState<TeamMember[]>([]);
  const [committees, setCommittees] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [execRes, repsRes, comRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/roles/public/executives`),
          fetch(`${API_BASE}/api/v1/roles/public/class-reps`),
          fetch(`${API_BASE}/api/v1/roles/public/committees`),
        ]);
        if (execRes.ok) setExecutives(await execRes.json());
        if (repsRes.ok) setClassReps(await repsRes.json());
        if (comRes.ok) setCommittees(await comRes.json());
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

  const currentMembers =
    tab === "central" ? executives : tab === "classreps" ? classReps : committees;

  return (
    <div className="min-h-screen bg-ghost text-navy overflow-x-hidden">
      {/* Diamond sparkle decorators */}
      {[
        "top-20 left-[8%] w-5 h-5 text-teal/14",
        "top-[35%] right-[10%] w-6 h-6 text-coral/12",
        "bottom-[40%] left-[5%] w-7 h-7 text-lavender/16",
        "bottom-[15%] right-[20%] w-5 h-5 text-sunny/14",
      ].map((cls, i) => (
        <svg key={i} className={`fixed ${cls} pointer-events-none z-0`} aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
        </svg>
      ))}

      <Header />

      <main id="main-content" className="pt-14 sm:pt-16">
        {/* ── Hero ── */}
        <section className="pt-16 pb-12 relative overflow-hidden md:min-h-[calc(100vh-5rem)] flex flex-col justify-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-3xl">
              <p className="text-label uppercase tracking-wider text-slate mb-3">Leadership</p>
              <h1 className="font-display font-black text-[2.5rem] sm:text-[4rem] lg:text-[5rem] leading-[0.9] text-navy">
                Meet the{" "}
                <span className="brush-highlight">IESA Team</span>
              </h1>
              <p className="text-lg text-slate mt-4 max-w-xl">
                The people driving the Industrial Engineering Students&apos; Association forward — united in purpose, driven by excellence.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 mt-6 bg-lime border-[4px] border-navy press-5 press-navy px-8 py-4 rounded-2xl font-display font-black text-lg text-navy transition-all"
              >
                Contact Us
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>

            {/* ── Tab navigation ── */}
            <div className="bg-snow border-[3px] border-navy rounded-[1.5rem] p-2 shadow-[4px_4px_0_0_#000]">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {TABS.map((t) => {
                  const isActive = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-[0.08em] transition-all ${
                        isActive
                          ? `${t.bgLight} border-[3px] border-navy text-navy shadow-[3px_3px_0_0_#0F0F2D]`
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
            {!loading && currentMembers.length === 0 && (
              <div className="bg-snow border-[3px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
                <p className="font-display font-black text-xl text-navy mb-2">No members assigned yet</p>
                <p className="text-sm text-slate">Check back once positions have been assigned for the current session.</p>
              </div>
            )}

            {/* ── Central Excos Tab ── */}
            {!loading && tab === "central" && executives.length > 0 && (
              <div className="space-y-6">
                {/* President hero */}
                {president && (
                  <div className="bg-navy border-[3px] border-lime rounded-[2rem] p-6 md:p-8 shadow-[3px_3px_0_0_#C8F31D] rotate-[-0.3deg] hover:rotate-0 transition-transform relative overflow-hidden">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-lime flex items-center justify-center flex-shrink-0 border-[3px] border-ghost/20">
                        <span className="font-display font-black text-2xl md:text-3xl text-navy">
                          {president.user.firstName[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-teal/20 font-display font-bold text-[10px] text-snow uppercase tracking-[0.08em] mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-lime" />
                          President
                        </span>
                        <h3 className="font-display font-black text-xl md:text-2xl text-snow">
                          {president.user.firstName} {president.user.lastName}
                        </h3>
                        <a href={`mailto:${president.user.email}`} className="inline-flex items-center gap-1.5 text-snow/50 hover:text-snow transition-colors text-sm font-medium mt-2">
                          <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                          {president.user.email}
                        </a>
                      </div>
                    </div>
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-teal/8" />
                  </div>
                )}

                {/* Other excos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {otherExcos.map((exco, i) => {
                    const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
                    const rotations = ["rotate-[0.4deg]", "rotate-[-0.3deg]", "rotate-[0.5deg]", "rotate-[-0.4deg]"];
                    return (
                      <div
                        key={exco.position}
                        className={`bg-snow border-[3px] border-navy border-l-[6px] ${accent.border} rounded-[1.5rem] p-5 shadow-[4px_4px_0_0_#000] ${rotations[i % rotations.length]} hover:rotate-0 transition-transform`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl ${accent.iconBg} flex items-center justify-center flex-shrink-0 border-[3px] border-navy`}>
                            <span className="font-display font-black text-lg text-navy">{exco.user.firstName[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-display font-black text-base text-navy">
                              {exco.user.firstName} {exco.user.lastName}
                            </h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${accent.bg} font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em] mt-0.5`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                              {getPositionLabel(exco.position)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t-[3px] border-navy/15">
                          <a href={`mailto:${exco.user.email}`} className="inline-flex items-center gap-1.5 text-navy/50 hover:text-navy transition-colors text-sm font-medium">
                            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                            <span className="truncate">{exco.user.email}</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Class Reps Tab ── */}
            {!loading && tab === "classreps" && classReps.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {classReps.map((rep, i) => {
                  const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
                  const rotations = ["rotate-[0.4deg]", "rotate-[-0.3deg]", "rotate-[0.5deg]", "rotate-[-0.4deg]"];
                  return (
                    <div
                      key={rep.position}
                      className={`bg-snow border-[3px] border-navy border-l-[6px] ${accent.border} rounded-[1.5rem] p-5 shadow-[4px_4px_0_0_#000] ${rotations[i % rotations.length]} hover:rotate-0 transition-transform`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl ${accent.iconBg} flex items-center justify-center flex-shrink-0 border-[3px] border-navy`}>
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

            {/* ── Committees Tab ── */}
            {!loading && tab === "committees" && committees.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {committees.map((com, i) => {
                  const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
                  const rotations = ["rotate-[0.4deg]", "rotate-[-0.3deg]", "rotate-[0.5deg]", "rotate-[-0.4deg]"];
                  return (
                    <div
                      key={com.position}
                      className={`bg-snow border-[3px] border-navy border-l-[6px] ${accent.border} rounded-[1.5rem] p-5 shadow-[4px_4px_0_0_#000] ${rotations[i % rotations.length]} hover:rotate-0 transition-transform`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl ${accent.iconBg} flex items-center justify-center flex-shrink-0 border-[3px] border-navy`}>
                          <span className="font-display font-black text-lg text-navy">{com.user.firstName[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-black text-base text-navy">
                            {com.user.firstName} {com.user.lastName}
                          </h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${accent.bg} font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em] mt-0.5`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                            {getPositionLabel(com.position)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t-[3px] border-navy/15">
                        <a href={`mailto:${com.user.email}`} className="inline-flex items-center gap-1.5 text-navy/50 hover:text-navy transition-colors text-sm font-medium">
                          <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                          <span className="truncate">{com.user.email}</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
