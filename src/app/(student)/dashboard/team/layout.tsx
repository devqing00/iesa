"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_TABS = [
  { label: "Central Excos", href: "/dashboard/team/central", color: "coral", bgLight: "bg-coral-light", dotBg: "bg-coral" },
  { label: "Class Reps", href: "/dashboard/team/class-reps", color: "lavender", bgLight: "bg-lavender-light", dotBg: "bg-lavender" },
  { label: "Committees", href: "/dashboard/team/committees", color: "teal", bgLight: "bg-teal-light", dotBg: "bg-teal" },
];

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-ghost p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 overflow-x-hidden relative">
      {/* ── diamond sparkles ── */}
      {[
        "top-10 left-[6%] w-5 h-5 text-teal/14",
        "top-28 right-[9%] w-4 h-4 text-coral/12",
        "top-[50%] left-[5%] w-6 h-6 text-lavender/16",
        "top-[70%] right-[7%] w-5 h-5 text-sunny/14",
        "bottom-20 left-[12%] w-4 h-4 text-lime/12",
      ].map((cls, i) => (
        <svg key={i} className={`fixed ${cls} pointer-events-none z-0`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
        </svg>
      ))}

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* ── back link ── */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-display font-bold text-navy hover:text-teal transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </Link>

        {/* ════════════════════════════════════════
            BENTO HERO — teal theme
        ════════════════════════════════════════ */}
        <div className="grid grid-cols-12 gap-4">
          {/* left: title */}
          <div className="col-span-12 md:col-span-7 bg-teal border-[6px] border-navy rounded-[2rem] p-8 shadow-[4px_4px_0_0_#000] rotate-[-0.4deg] hover:rotate-0 transition-transform relative overflow-hidden">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/50 mb-1">IESA Leadership</div>
            <h1 className="font-display font-black text-3xl sm:text-4xl text-navy leading-tight">
              Team<br />Sustainability
            </h1>
            <p className="text-sm text-navy/70 font-medium mt-3 max-w-sm">
              United in purpose, driven by excellence. Meet the people building a thriving community.
            </p>
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-navy/8" />
            <div className="absolute top-4 right-5">
              <svg className="w-6 h-6 text-navy/15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
              </svg>
            </div>
          </div>

          {/* right: 3 stats */}
          <div className="col-span-12 md:col-span-5 grid grid-rows-3 gap-3">
            <div className="bg-coral-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#000] rotate-[0.5deg] hover:rotate-0 transition-transform flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-coral/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Central Excos</div>
                <div className="font-display font-black text-lg text-navy">5 Members</div>
              </div>
            </div>

            <div className="bg-lavender-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#000] rotate-[-0.6deg] hover:rotate-0 transition-transform flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-lavender/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.664 1.319a.75.75 0 01.672 0 41.059 41.059 0 018.198 5.424.75.75 0 01-.254 1.285 31.372 31.372 0 00-7.86 3.83.75.75 0 01-.84 0 31.508 31.508 0 00-7.86-3.83.75.75 0 01-.254-1.285 41.059 41.059 0 018.198-5.424zM6.303 9.796a.75.75 0 01.49.976A23.05 23.05 0 005.44 14.9a.75.75 0 01-.262.542 47.099 47.099 0 00-2.04 1.874.75.75 0 01-1.263-.566 49.464 49.464 0 00-.23-3.478.75.75 0 01.306-.753 38.036 38.036 0 014.353-2.724zM18.56 17.316a.75.75 0 01-1.263.566 47.192 47.192 0 00-2.04-1.874.75.75 0 01-.262-.542 23.04 23.04 0 00-1.354-4.128.75.75 0 011.466-.491 38.124 38.124 0 014.353 2.724.75.75 0 01.306.752 49.478 49.478 0 00-.23 3.478.75.75 0 01-.976.516z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Class Reps</div>
                <div className="font-display font-black text-lg text-navy">5 Levels</div>
              </div>
            </div>

            <div className="bg-sunny-light border-[4px] border-navy rounded-[1.5rem] p-4 shadow-[4px_4px_0_0_#000] rotate-[0.4deg] hover:rotate-0 transition-transform flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sunny/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-navy" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h16.5a.75.75 0 010 1.5H18v8.75A2.75 2.75 0 0115.25 15h-1.072l.798 3.06a.75.75 0 01-1.452.38L13.41 18H6.59l-.114.44a.75.75 0 01-1.452-.38L5.822 15H4.75A2.75 2.75 0 012 12.25V3.5h-.25A.75.75 0 011 2.75z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy/60">Committees</div>
                <div className="font-display font-black text-lg text-navy">4 Active</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── tab navigation ── */}
        <div className="bg-snow border-[4px] border-navy rounded-[1.5rem] p-2 shadow-[4px_4px_0_0_#000]">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {NAV_TABS.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-[0.08em] transition-all ${
                    isActive
                      ? `${tab.bgLight} border-[3px] border-navy text-navy shadow-[3px_3px_0_0_#0F0F2D]`
                      : "border-[3px] border-transparent text-navy/50 hover:text-navy hover:bg-cloud"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isActive ? tab.dotBg : "bg-navy/20"}`} />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── page content ── */}
        <div>{children}</div>
      </div>
    </div>
  );
}
