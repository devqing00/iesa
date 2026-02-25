"use client";

import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

/* ─── Phase data ─────────────────────────────────────────────── */

const PHASES = [
  {
    num: "01",
    label: "Stimulate the Mind",
    color: "bg-lavender",
    lightBg: "bg-lavender-light",
    border: "border-lavender",
    description:
      "Focus on learning processes, critical thinking, and identifying your niche. Take the Unfractured Focus Game and quizzes that reward methodical thinking over speed.",
    features: [
      "Unfractured Focus Game",
      "Process Breakdown Challenges",
      "Critical Thinking Quizzes",
      "Discovery & Exploration",
    ],
  },
  {
    num: "02",
    label: "Carve Your Niche",
    color: "bg-teal",
    lightBg: "bg-teal-light",
    border: "border-teal",
    description:
      "Complete your Niche Audit, commit to a campus society, join mentorship circles with senior students, and prepare for the Grand Hackathon.",
    features: [
      "Niche Audit Worksheet",
      "Society Commitment",
      "Mentorship Circles",
      "Hackathon Prep",
    ],
  },
  {
    num: "03",
    label: "Pitch Your Process",
    color: "bg-coral",
    lightBg: "bg-coral-light",
    border: "border-coral",
    description:
      "The grand finale conference where teams present their solutions with a focus on HOW they built them — documenting iteration, failure, and engineering rigor.",
    features: [
      "Team Formation",
      "Iterative Submissions",
      "Process Documentation",
      "The Grand Conference",
    ],
  },
];

const SOCIETIES = [
  { short: "IEEE", name: "Institute of Electrical and Electronic Engineers", focus: "Technology & Innovation", color: "bg-lime" },
  { short: "RAIN", name: "Renewable & Alternative Innovations Network", focus: "Renewable Energy", color: "bg-teal" },
  { short: "SFC", name: "Students for Change", focus: "Social Impact & Leadership", color: "bg-coral" },
  { short: "IPTLC", name: "Industrial Process & Tech Leadership Club", focus: "Process Engineering", color: "bg-lavender" },
  { short: "Energy Club", name: "Energy Club", focus: "Energy Sector & Sustainability", color: "bg-sunny" },
];

export default function IepodLandingPage() {
  return (
    <div className="min-h-screen bg-ghost text-navy overflow-x-hidden">
      {/* Diamond sparkle decorators */}
      <svg className="fixed top-20 left-[8%] w-6 h-6 text-teal/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[35%] right-[10%] w-7 h-7 text-coral/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed bottom-[40%] left-[15%] w-5 h-5 text-lavender/18 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed bottom-[20%] right-[20%] w-8 h-8 text-sunny/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[60%] left-[5%] w-4 h-4 text-lime/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[12%] right-[30%] w-5 h-5 text-navy/10 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>

      <Header />

      <main id="main-content" className="pt-14 sm:pt-16">
        {/* ============================================
            HERO SECTION
            ============================================ */}
        <section className="pt-16 sm:pt-20 pb-16 sm:pb-24 relative overflow-hidden md:min-h-[calc(100vh-5rem)] flex flex-col justify-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Text */}
              <div className="space-y-8 relative">
                <div className="inline-block">
                  <span className="text-label text-slate">IESA Professional Development Hub</span>
                </div>

                <h1 className="font-display font-black text-[2.5rem] sm:text-[4rem] lg:text-[4.5rem] leading-[0.9] text-navy">
                  Process
                  <br />
                  <span className="inline-block bg-lime border-[3px] border-navy px-5 py-2 rotate-[-2deg] shadow-[5px_5px_0_0_#0F0F2D]">
                    Drivers
                  </span>
                </h1>

                <p className="font-display text-lg sm:text-xl text-navy/70 max-w-lg leading-relaxed font-light">
                  Your Process, Our Progress. Moving beyond &ldquo;results at any cost&rdquo;
                  toward a <strong className="font-bold text-navy">prototyping mindset</strong> —
                  methodical growth, engineering rigor, and deep inquiry.
                </p>

                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/login"
                    className="bg-lime border-[4px] border-navy press-5 press-navy px-8 py-4 rounded-2xl font-display font-black text-lg text-navy transition-all"
                  >
                    Join the Hub
                  </Link>
                  <a
                    href="#pipeline"
                    className="bg-transparent border-[3px] border-navy px-6 py-3.5 rounded-xl font-display font-bold text-navy hover:bg-navy hover:text-lime transition-all"
                  >
                    See the Pipeline &darr;
                  </a>
                </div>
              </div>

              {/* Right: Visual Bento */}
              <div className="hidden lg:grid grid-cols-2 gap-4">
                <div className="bg-navy border-[4px] border-lime rounded-3xl p-6 shadow-[8px_8px_0_0_#C8F31D] rotate-[1deg]">
                  <div className="text-lime font-display font-black text-5xl mb-2">3</div>
                  <p className="text-lime/80 font-bold text-sm">Transformational Phases</p>
                </div>
                <div className="bg-coral border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] rotate-[-1deg]">
                  <div className="text-snow font-display font-black text-5xl mb-2">5+</div>
                  <p className="text-snow/80 font-bold text-sm">Campus Societies</p>
                </div>
                <div className="bg-lavender border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] rotate-[-1deg]">
                  <div className="text-snow font-display font-black text-5xl mb-2">
                    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                    </svg>
                  </div>
                  <p className="text-snow/80 font-bold text-sm">Gamified Learning</p>
                </div>
                <div className="bg-teal border-[4px] border-navy rounded-3xl p-6 shadow-[8px_8px_0_0_#000] rotate-[2deg]">
                  <div className="text-navy font-display font-black text-5xl mb-2">
                    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A18.034 18.034 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-navy font-bold text-sm">Mentorship Circles</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================
            PIPELINE MAP — "Forge the Future" 3 Phases
            ============================================ */}
        <section id="pipeline" className="py-16 sm:py-24 bg-snow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative inline-block mb-12 sm:mb-16">
              <span className="text-label text-slate">The Series</span>
              <h2 className="font-display font-black text-3xl sm:text-5xl text-navy mt-2">
                Forge the{" "}
                <span className="inline-block bg-sunny border-[3px] border-navy px-5 py-1 rotate-[1deg] shadow-[4px_4px_0_0_#000]">
                  Future
                </span>
              </h2>
              <p className="text-navy/60 font-medium mt-4 max-w-xl">
                A three-phase journey that transforms how you think, build, and present solutions.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {PHASES.map((phase, idx) => (
                <div
                  key={phase.num}
                  className={`${phase.color} border-[4px] border-navy rounded-3xl p-8 shadow-[8px_8px_0_0_#000] ${
                    idx === 1 ? "rotate-[1deg]" : idx === 2 ? "rotate-[-1deg]" : ""
                  } hover:rotate-0 transition-transform`}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span className="bg-navy text-snow font-display font-black text-xl w-12 h-12 rounded-xl flex items-center justify-center">
                      {phase.num}
                    </span>
                    <h3 className="font-display font-black text-xl text-navy">{phase.label}</h3>
                  </div>
                  <p className="text-navy/80 font-medium text-sm leading-relaxed mb-6">
                    {phase.description}
                  </p>
                  <ul className="space-y-2">
                    {phase.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-navy/60 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                        </svg>
                        <span className="text-navy/80 font-bold text-sm">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            SOCIETY PIPELINE
            ============================================ */}
        <section className="py-16 sm:py-24 bg-ghost">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative inline-block mb-12">
              <span className="text-label text-slate">Connected Societies</span>
              <h2 className="font-display font-black text-3xl sm:text-5xl text-navy mt-2">
                Your{" "}
                <span className="inline-block bg-teal border-[3px] border-navy px-5 py-1 rotate-[-1deg] shadow-[4px_4px_0_0_#000]">
                  Pipeline
                </span>
              </h2>
              <p className="text-navy/60 font-medium mt-4 max-w-xl">
                IEPOD connects you to campus societies where you&apos;ll commit, contribute, and grow.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {SOCIETIES.map((soc, idx) => (
                <div
                  key={soc.short}
                  className={`bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000] ${
                    idx % 2 === 0 ? "rotate-[-0.5deg]" : "rotate-[0.5deg]"
                  } hover:rotate-0 transition-transform`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`${soc.color} border-[3px] border-navy text-navy font-display font-black text-xs px-3 py-1.5 rounded-xl`}>
                      {soc.short}
                    </span>
                  </div>
                  <h4 className="font-display font-black text-base text-navy mb-1">{soc.name}</h4>
                  <p className="text-slate text-sm font-medium">{soc.focus}</p>
                </div>
              ))}
              {/* Plus card */}
              <div className="bg-navy border-[4px] border-lime rounded-3xl p-6 shadow-[6px_6px_0_0_#C8F31D] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-lime font-display font-black text-3xl mb-2">+</div>
                  <p className="text-lime/80 font-bold text-sm">More societies coming</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================
            WHY PROCESS MATTERS
            ============================================ */}
        <section className="py-16 sm:py-24 bg-navy">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <h2 className="font-display font-black text-3xl sm:text-5xl text-lime">
                Why Process Over Results?
              </h2>
              <p className="text-lime/70 font-medium text-lg leading-relaxed">
                The real world doesn&apos;t reward lucky answers — it rewards engineers who can
                <strong className="text-lime font-bold"> document their thinking</strong>,
                <strong className="text-lime font-bold"> iterate on failures</strong>, and
                <strong className="text-lime font-bold"> communicate their approach</strong>.
                IEPOD rewards the journey, not just the destination.
              </p>

              <div className="grid sm:grid-cols-3 gap-4 pt-8">
                {[
                  { icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z", title: "Not Speed", sub: "Thoughtful, methodical work" },
                  { icon: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99", title: "Embrace Iteration", sub: "Fail forward, document it" },
                  { icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", title: "Show the How", sub: "Process is the product" },
                ].map((item) => (
                  <div key={item.title} className="bg-navy-light border-[3px] border-lime/30 rounded-2xl p-6">
                    <svg className="w-8 h-8 text-lime mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    <h4 className="font-display font-black text-base text-lime mb-1">{item.title}</h4>
                    <p className="text-lime/60 font-medium text-sm">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================
            CTA
            ============================================ */}
        <section className="py-16 sm:py-24 bg-lime">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              Ready to Forge Your Future?
            </h2>
            <p className="text-navy/70 font-medium text-lg max-w-xl mx-auto">
              Registration opens in the first 3 weeks of each session. Sign in to your IESA account and apply for the IEPOD program.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/login"
                className="bg-navy border-[4px] border-lime press-5 press-lime px-8 py-4 rounded-2xl font-display font-black text-lg text-lime transition-all"
              >
                Sign In & Register
              </Link>
              <Link
                href="/about"
                className="bg-transparent border-[3px] border-navy px-6 py-3.5 rounded-xl font-display font-bold text-navy hover:bg-navy hover:text-lime transition-all"
              >
                Learn about IESA
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
