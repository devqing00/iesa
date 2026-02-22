import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function AboutPage() {

  return (
    <div className="min-h-screen bg-ghost text-navy overflow-x-hidden">
      {/* ✦ Text decorators */}
      <span className="fixed top-24 left-[12%] text-lime/15 text-lg pointer-events-none z-0 select-none">✦</span>
      <span className="fixed top-[35%] right-[8%] text-coral/12 text-xl pointer-events-none z-0 select-none">✦</span>
      <span className="fixed top-[65%] left-[6%] text-lavender/15 text-base pointer-events-none z-0 select-none">✦</span>
      <span className="fixed bottom-[20%] right-[15%] text-teal/12 text-lg pointer-events-none z-0 select-none">✦</span>

      {/* Diamond sparkle decorators */}
      <svg className="fixed top-20 left-[8%] w-6 h-6 text-lime/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[40%] right-[12%] w-7 h-7 text-coral/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed bottom-[30%] left-[18%] w-5 h-5 text-lavender/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed bottom-[15%] right-[25%] w-8 h-8 text-sunny/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>

      {/* SHARED HEADER */}
      <Header />

      <main id="main-content">
      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="pt-32 pb-16 sm:pb-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Small tag */}
          <div className="inline-flex items-center gap-2 bg-lavender border-[3px] border-navy rounded-full px-3 py-1 mb-6">
            <span className="text-[10px] font-display font-black text-navy uppercase tracking-widest">✦ About Us</span>
          </div>

          {/* Hero Content */}
          <div className="max-w-4xl space-y-8 relative">
            <svg className="absolute -top-6 -left-8 w-9 h-9 text-sunny/50" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <span className="absolute -top-3 -left-2 text-sunny/35 text-xs select-none">✦</span>
            <h1 className="font-display font-black text-[2.5rem] sm:text-[4rem] lg:text-[5rem] leading-[0.9] text-navy">
              <span className="brush-highlight">Shaping the Future</span>
              <br />
              of <span className="inline-block bg-lime border-[4px] sm:border-[6px] border-navy px-4 sm:px-6 py-2 rotate-[-1deg] shadow-[4px_4px_0_0_#000]">Industrial</span> Engineering
            </h1>
            <p className="font-display text-base sm:text-lg text-navy/60 max-w-2xl leading-relaxed font-medium">
              The Industrial Engineering Student Association (IESA) at the
              University of Ibadan is more than just a student organization —
              we&apos;re a community dedicated to academic excellence,
              professional development, and creating lasting impact.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================
          MISSION & VISION
          ============================================ */}
      <section className="py-16 sm:py-20 bg-lime">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="relative inline-block mb-10 sm:mb-14">
            <svg className="absolute -top-5 -right-8 w-7 h-7 text-navy/25" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <span className="absolute -top-2 -right-3 text-navy/15 text-xs select-none">✦</span>
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              Our <span className="bg-snow border-[4px] border-navy px-4 sm:px-6 py-2 inline-block rotate-[-2deg] shadow-[4px_4px_0_0_#000]">Purpose</span>
            </h2>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Mission */}
            <div className="bg-coral border-[4px] border-navy rounded-3xl p-8 sm:p-10 shadow-[3px_3px_0_0_#000] rotate-[-1deg] hover:rotate-0 transition-transform">
              <div className="w-14 h-14 bg-navy rounded-full flex items-center justify-center mb-5">
                <svg className="w-7 h-7 text-lime" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="font-display font-black text-2xl sm:text-3xl text-navy mb-4">
                <span className="brush-highlight brush-coral">Empowering</span> Students
              </h3>
              <p className="font-display font-medium text-sm sm:text-base text-navy/80 leading-relaxed">
                To foster academic excellence, professional growth, and a
                strong sense of community among industrial engineering
                students while bridging the gap between theoretical knowledge
                and practical application.
              </p>
            </div>

            {/* Vision */}
            <div className="bg-sunny border-[4px] border-navy rounded-3xl p-8 sm:p-10 shadow-[3px_3px_0_0_#000] rotate-[1deg] hover:rotate-0 transition-transform">
              <div className="w-14 h-14 bg-navy rounded-full flex items-center justify-center mb-5">
                <svg className="w-7 h-7 text-sunny" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="font-display font-black text-2xl sm:text-3xl text-navy mb-4">
                <span className="brush-highlight brush-coral">Leading</span> Innovation
              </h3>
              <p className="font-display font-medium text-sm sm:text-base text-navy/80 leading-relaxed">
                To be the foremost student association in Nigeria, recognized
                for producing industry-ready graduates who drive innovation
                and excellence in industrial engineering.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          WHAT WE DO
          ============================================ */}
      <section className="py-16 sm:py-20 bg-snow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="relative mb-10 sm:mb-14 text-center">
            <svg className="absolute -top-8 left-1/2 -translate-x-12 w-8 h-8 text-teal/40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <span className="absolute -top-4 left-1/2 -translate-x-6 text-teal/25 text-xs select-none">✦</span>
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              <span className="brush-highlight">What We</span> <span className="bg-lavender border-[4px] border-navy px-4 sm:px-6 py-2 inline-block rotate-[-2deg] shadow-[4px_4px_0_0_#000]">Do</span>
            </h2>
          </div>

          {/* Activities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Academic Support",
                description: "Tutorial sessions, study groups, past question resources, and academic mentorship programs.",
                bg: "bg-lavender",
                icon: (
                  <svg className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                ),
              },
              {
                title: "Industry Connections",
                description: "Networking events, company visits, internship placements, and career guidance sessions.",
                bg: "bg-teal",
                icon: (
                  <svg className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                ),
              },
              {
                title: "Workshops & Seminars",
                description: "Technical workshops, soft skills training, and seminars featuring industry experts.",
                bg: "bg-coral",
                icon: (
                  <svg className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                  </svg>
                ),
              },
              {
                title: "Social Events",
                description: "Orientation programs, social gatherings, sports competitions, and cultural celebrations.",
                bg: "bg-sunny",
                icon: (
                  <svg className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                  </svg>
                ),
              },
              {
                title: "Publications",
                description: "IESA magazine, newsletters, academic journals, and digital content creation.",
                bg: "bg-snow",
                icon: (
                  <svg className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                ),
              },
              {
                title: "Community Service",
                description: "Outreach programs, volunteering initiatives, and projects that give back to society.",
                bg: "bg-lime-light",
                icon: (
                  <svg className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                ),
              },
            ].map((activity, i) => (
              <div
                key={i}
                className={`${activity.bg} border-[4px] border-navy rounded-3xl p-6 sm:p-8 press-4 press-black transition-all`}
              >
                <div className="w-12 h-12 bg-snow border-[3px] border-navy rounded-full flex items-center justify-center mb-4 shadow-[3px_3px_0_0_#000]">
                  {activity.icon}
                </div>
                <h3 className="font-display font-black text-xl text-navy mb-3">{activity.title}</h3>
                <p className="font-display font-medium text-sm text-navy/80 leading-relaxed">
                  {activity.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          LEADERSHIP
          ============================================ */}
      <section className="py-16 sm:py-20 bg-ghost">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              Our <span className="brush-highlight">Leadership</span>
            </h2>
          </div>

          {/* Leadership Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { role: "President", name: "Leadership Position", bg: "bg-lime" },
              { role: "Vice President", name: "Leadership Position", bg: "bg-lavender" },
              { role: "General Secretary", name: "Leadership Position", bg: "bg-teal" },
              { role: "Financial Secretary", name: "Leadership Position", bg: "bg-coral" },
            ].map((leader, i) => (
              <div key={i} className={`${leader.bg} border-[4px] border-navy rounded-3xl p-6 press-4 press-black text-center transition-all`}>
                <div className="w-20 h-20 mx-auto bg-snow border-[3px] border-navy rounded-full flex items-center justify-center mb-4 shadow-[3px_3px_0_0_#000]">
                  <svg className="w-8 h-8 text-navy" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="font-display text-[10px] font-bold text-navy/60 uppercase tracking-widest mb-1">{leader.role}</p>
                <h3 className="font-display font-black text-lg text-navy">{leader.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          CTA SECTION
          ============================================ */}
      <section className="py-16 sm:py-24 bg-coral">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block bg-navy rounded-full px-4 py-1.5 mb-6">
            <span className="font-display text-xs font-black text-lime uppercase tracking-widest">✦ Join Us ✦</span>
          </div>

          <h2 className="font-display font-black text-4xl sm:text-6xl text-navy mb-6 leading-none">
            <span className="brush-highlight brush-coral">Become Part</span>
            <br />of Our Story
          </h2>
          <p className="font-display font-medium text-base sm:text-lg text-navy/80 max-w-md mx-auto mb-8 sm:mb-10">
            Join IESA today and connect with fellow students, access exclusive
            resources, and shape your engineering career.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/register"
              className="font-display font-black bg-lime border-[4px] border-navy rounded-full px-10 py-4 text-base text-navy uppercase tracking-wide press-3 press-navy transition-all text-center"
            >
              Join IESA →
            </Link>
            <Link
              href="/contact"
              className="font-display font-black bg-snow border-[4px] border-navy rounded-full px-10 py-4 text-base text-navy uppercase tracking-wide shadow-[3px_3px_0_0_#000] text-center"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
      </main>

      {/* SHARED FOOTER */}
      <Footer />
    </div>
  );
}
