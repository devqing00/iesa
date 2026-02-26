import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function HistoryPage() {
  const timeline = [
    {
      year: "2018",
      title: "Foundation",
      description:
        "IESA was founded by a group of passionate industrial engineering students with a vision to create a supportive community for academic and professional growth.",
      color: "bg-lime",
    },
    {
      year: "2019",
      title: "First Annual Summit",
      description:
        "Organized the inaugural IESA Industrial Engineering Summit, bringing together students, faculty, and industry professionals for knowledge sharing.",
      color: "bg-lavender",
    },
    {
      year: "2020",
      title: "Digital Transformation",
      description:
        "Adapted to virtual operations during global challenges, launching online tutorials, webinars, and the IESA digital resource library.",
      color: "bg-teal",
    },
    {
      year: "2021",
      title: "Industry Partnerships",
      description:
        "Established formal partnerships with leading manufacturing and consulting firms for internship placements and mentorship programs.",
      color: "bg-coral",
    },
    {
      year: "2022",
      title: "Platform Launch",
      description:
        "Launched the IESA digital platform, providing members with access to resources, event management, and community features.",
      color: "bg-sunny",
    },
    {
      year: "2023",
      title: "Regional Recognition",
      description:
        "Received recognition as one of the most active engineering student associations in the region, with membership exceeding 400 students.",
      color: "bg-lavender",
    },
    {
      year: "2024",
      title: "500+ Members",
      description:
        "Reached a milestone of over 500 active members, expanded community outreach programs, and launched the IESA mentorship initiative.",
      color: "bg-lime",
    },
  ];

  return (
    <div className="min-h-screen bg-ghost text-navy overflow-x-hidden">
      {/* SHARED HEADER */}
      <Header />

      {/* Diamond Sparkle Decorators */}
      <svg className="fixed top-20 right-[7%] w-5 h-5 text-coral/15 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" /></svg>
      <svg className="fixed top-[40%] left-[4%] w-6 h-6 text-navy/8 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" /></svg>
      <svg className="fixed bottom-[30%] right-[5%] w-4 h-4 text-sunny/18 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" /></svg>

      <main id="main-content" className="pt-14 sm:pt-16">
      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="pt-16 sm:pt-20 pb-16 sm:pb-20 relative overflow-hidden bg-ghost md:min-h-[calc(100vh-5rem)] flex flex-col justify-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Hero Content */}
          <div className="max-w-4xl space-y-6">
            <h1 className="font-display font-black text-5xl sm:text-7xl text-navy leading-none">
              A Legacy of
              <br />
              Excellence
              <span className="inline-block bg-lavender border-[2px] border-navy px-4 sm:px-6 py-2 rotate-[2deg] shadow-[3px_3px_0_0_#000] ml-3 text-4xl sm:text-6xl align-middle">Since 2018</span>
            </h1>
            <p className="font-display font-medium text-base sm:text-lg text-navy/70 max-w-2xl leading-relaxed">
              From humble beginnings to becoming one of the most vibrant student
              associations at the University of Ibadan, our journey has been
              defined by dedication, innovation, and community.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================
          TIMELINE SECTION
          ============================================ */}
      <section className="py-16 sm:py-24 bg-snow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              Our Journey
            </h2>
          </div>

          {/* Timeline */}
          <div className="relative max-w-4xl mx-auto">
            {/* Vertical Line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-[4px] bg-navy/15 transform md:-translate-x-[2px] rounded-full" />

            {/* Timeline Items */}
            <div className="space-y-10 sm:space-y-14">
              {timeline.map((item, i) => (
                <div
                  key={i}
                  className={`relative flex flex-col md:flex-row gap-6 ${
                    i % 2 === 0 ? "md:flex-row-reverse" : ""
                  }`}
                >
                  {/* Content */}
                  <div className="md:w-1/2 pl-16 md:pl-0">
                    <div className={i % 2 === 0 ? "md:pl-10 md:text-left" : "md:pr-10 md:text-right"}>
                      <div className={`bg-snow border-[2px] border-navy rounded-3xl p-6 press-4 press-black transition-all`}>
                        <div className={`inline-block ${item.color} border-[2px] border-navy rounded-full px-3 py-0.5 mb-3`}>
                          <span className="font-display font-black text-sm text-navy">{item.year}</span>
                        </div>
                        <h3 className="font-display font-black text-xl text-navy mb-2">{item.title}</h3>
                        <p className="font-display font-normal text-sm text-navy/60 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Empty space for alternating layout */}
                  <div className="hidden md:block md:w-1/2" />

                  {/* Dot */}
                  <div className={`absolute left-6 md:left-1/2 top-8 w-5 h-5 ${item.color} border-[2px] border-navy rounded-full transform -translate-x-1/2 shadow-[2px_2px_0_0_#000]`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          MILESTONES SECTION
          ============================================ */}
      <section className="py-16 sm:py-20 bg-ghost">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              Key <span className="bg-snow border-[2px] border-navy px-4 sm:px-6 py-2 inline-block rotate-[-2deg] shadow-[3px_3px_0_0_#000]">Milestones</span>
            </h2>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6">
            {[
              { number: "7+", label: "Years of Impact", bg: "bg-snow" },
              { number: "500+", label: "Active Members", bg: "bg-sunny" },
              { number: "50+", label: "Events Hosted", bg: "bg-lavender" },
              { number: "20+", label: "Industry Partners", bg: "bg-teal" },
            ].map((stat, i) => (
              <div key={i} className={`${stat.bg} border-[2px] border-navy rounded-3xl p-6 sm:p-8 text-center shadow-[3px_3px_0_0_#000]`}>
                <span className="font-display font-black text-4xl sm:text-5xl text-navy block mb-2">
                  {stat.number}
                </span>
                <p className="font-display font-bold text-xs text-navy/60 uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          CTA SECTION
          ============================================ */}
      <section className="py-16 sm:py-24 bg-lavender">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block bg-navy border-[3px] border-navy rounded-full px-4 py-1.5 mb-6">
            <span className="font-display text-xs font-black text-snow uppercase tracking-widest">✦ Be Part of History ✦</span>
          </div>

          <h2 className="font-display font-black text-4xl sm:text-6xl text-navy mb-6 leading-none">
            Write the Next
            <br />
            Chapter With Us
          </h2>
          <p className="font-display font-medium text-base sm:text-lg text-navy/80 max-w-md mx-auto mb-8 sm:mb-10">
            Join IESA and become part of our continuing story of excellence
            and impact.
          </p>
          <Link
            href="/register"
            className="font-display font-black inline-block bg-lavender border-[2px] border-navy rounded-full px-10 py-4 text-base text-navy uppercase tracking-wide press-4 press-black transition-all"
          >
            Join IESA →
          </Link>
        </div>
      </section>
      </main>

      {/* SHARED FOOTER */}
      <Footer />
    </div>
  );
}
