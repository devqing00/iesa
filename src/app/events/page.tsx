import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function EventsPage() {

  const upcomingEvents = [
    {
      title: "Industrial Engineering Summit 2026",
      date: "March 15-17, 2026",
      location: "University of Ibadan Main Auditorium",
      description:
        "Annual flagship event featuring keynote speakers, workshops, and networking sessions with industry leaders.",
      type: "Conference",
    },
    {
      title: "Career Fair & Internship Drive",
      date: "February 20, 2026",
      location: "Faculty of Engineering Complex",
      description:
        "Connect with top companies offering internship and graduate positions in industrial engineering.",
      type: "Career",
    },
    {
      title: "Technical Workshop: Lean Six Sigma",
      date: "February 8, 2026",
      location: "IPE Seminar Room",
      description:
        "Hands-on workshop on Lean Six Sigma methodologies and their application in manufacturing.",
      type: "Workshop",
    },
  ];

  const pastEvents = [
    {
      title: "End of Year Dinner",
      date: "December 2025",
      attendees: "200+",
    },
    {
      title: "Industry Visit: Dangote Refinery",
      date: "November 2025",
      attendees: "50",
    },
    {
      title: "Freshman Orientation",
      date: "October 2025",
      attendees: "150+",
    },
    {
      title: "Technical Writing Workshop",
      date: "September 2025",
      attendees: "80",
    },
  ];

  return (
    <div className="min-h-screen bg-ghost text-navy overflow-x-hidden">
      {/* ✦ and diamond decorators */}
      <span className="fixed top-28 left-[14%] text-lime/15 text-lg pointer-events-none z-0 select-none">✦</span>
      <span className="fixed top-[42%] right-[8%] text-coral/12 text-xl pointer-events-none z-0 select-none">✦</span>
      <span className="fixed bottom-[35%] left-[6%] text-sunny/15 text-base pointer-events-none z-0 select-none">✦</span>
      <svg className="fixed top-24 right-[12%] w-7 h-7 text-lavender/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[55%] left-[10%] w-6 h-6 text-teal/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed bottom-[20%] right-[18%] w-5 h-5 text-coral/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>

      {/* SHARED HEADER */}
      <Header />

      <main id="main-content">
      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="pt-32 pb-12 sm:pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Small tag */}
          <div className="inline-flex items-center gap-2 bg-coral border-[3px] border-navy rounded-full px-3 py-1 mb-6">
            <span className="text-[10px] font-display font-black text-navy uppercase tracking-widest">✦ Events</span>
          </div>

          {/* Hero Content */}
          <div className="max-w-4xl space-y-8">
            <h1 className="font-display font-black text-[2.5rem] sm:text-[4rem] lg:text-[5rem] leading-[0.9] text-navy">
              <span className="brush-highlight">Connect, Learn,</span>
              <br />
              &amp; <span className="inline-block bg-sunny border-[4px] sm:border-[6px] border-navy px-4 sm:px-6 py-2 rotate-[-1deg] shadow-[4px_4px_0_0_#000]">Grow</span>
            </h1>
            <p className="font-display font-medium text-base sm:text-lg text-navy/60 max-w-2xl leading-relaxed">
              From technical workshops to networking events, IESA hosts a
              variety of programs designed to enhance your academic journey and
              professional development.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================
          UPCOMING EVENTS
          ============================================ */}
      <section className="py-16 sm:py-20 bg-snow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="relative inline-block mb-10 sm:mb-14">
            <svg className="absolute -top-5 -right-8 w-7 h-7 text-lime/40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>
            <span className="absolute -top-2 -right-3 text-lime/25 text-xs select-none">✦</span>
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              <span className="brush-highlight">Upcoming</span> Events
            </h2>
          </div>

          {/* Events Cards */}
          <div className="space-y-6">
            {upcomingEvents.map((event, i) => {
              const colors = ["bg-lavender", "bg-teal", "bg-coral"];
              return (
                <div key={i} className={`${colors[i % 3]} border-[4px] border-navy rounded-3xl p-6 sm:p-8 press-3 press-black transition-all`}>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-display font-bold text-[10px] text-navy uppercase tracking-widest bg-snow border-[3px] border-navy rounded-full px-3 py-1 shadow-[2px_2px_0_0_#000]">
                          {event.type}
                        </span>
                        <span className="font-display font-bold text-xs text-navy/70 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-lime border border-navy" />
                          {event.date}
                        </span>
                      </div>
                      <h3 className="font-display font-black text-xl sm:text-2xl text-navy">
                        {event.title}
                      </h3>
                      <p className="font-display font-medium text-sm text-navy/80 leading-relaxed">
                        {event.description}
                      </p>
                      <p className="font-display font-bold text-xs text-navy/60 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        {event.location}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Link
                        href="/register"
                        className="inline-block font-display font-black bg-navy border-[3px] border-navy rounded-xl px-6 py-3 text-sm text-lime uppercase tracking-wide press-4 press-lime transition-all"
                      >
                        Register →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================
          PAST EVENTS
          ============================================ */}
      <section className="py-16 sm:py-20 bg-lime">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="mb-10 sm:mb-14">
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              Past <span className="bg-snow border-[4px] border-navy px-4 sm:px-6 py-2 inline-block rotate-[-2deg] shadow-[4px_4px_0_0_#000]">Events</span>
            </h2>
          </div>

          {/* Past Events Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {pastEvents.map((event, i) => (
              <div key={i} className="bg-snow border-[4px] border-navy rounded-3xl p-6 press-4 press-black transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display font-bold text-xs text-navy/60 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-navy/30" />
                    {event.date}
                  </span>
                  <span className="font-display font-bold text-[10px] text-navy uppercase tracking-widest bg-lime-light border-[2px] border-navy rounded-full px-3 py-0.5">
                    {event.attendees} attendees
                  </span>
                </div>
                <h3 className="font-display font-black text-lg text-navy">{event.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          EVENT CATEGORIES
          ============================================ */}
      <section className="py-16 sm:py-20 bg-ghost">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              Event <span className="brush-highlight">Categories</span>
            </h2>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: "Conferences", count: "3/year", bg: "bg-lavender", icon: <svg className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg> },
              { name: "Workshops", count: "10+/year", bg: "bg-teal", icon: <svg className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg> },
              { name: "Industry Visits", count: "5+/year", bg: "bg-sunny", icon: <svg className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" /></svg> },
              { name: "Social Events", count: "8+/year", bg: "bg-coral", icon: <svg className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" /></svg> },
            ].map((category, i) => (
              <div key={i} className={`${category.bg} border-[4px] border-navy rounded-3xl p-6 text-center press-4 press-black transition-all`}>
                <div className="w-14 h-14 mx-auto bg-snow border-[3px] border-navy rounded-full flex items-center justify-center mb-4 shadow-[3px_3px_0_0_#000]">
                  {category.icon}
                </div>
                <h3 className="font-display font-black text-base sm:text-lg text-navy mb-1">{category.name}</h3>
                <p className="font-display font-bold text-xs text-navy/60">{category.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          CTA SECTION
          ============================================ */}
      <section className="py-16 sm:py-24 bg-navy">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block bg-lime border-[3px] border-navy rounded-full px-4 py-1.5 mb-6">
            <span className="font-display text-xs font-black text-navy uppercase tracking-widest">✦ Stay Updated ✦</span>
          </div>

          <h2 className="font-display font-black text-4xl sm:text-6xl text-lime mb-6 leading-none">
            Never Miss<br />an Event
          </h2>
          <p className="font-display font-medium text-base sm:text-lg text-ghost/80 max-w-md mx-auto mb-8 sm:mb-10">
            Join IESA to get notified about upcoming events and exclusive
            member-only activities.
          </p>
          <Link
            href="/register"
            className="font-display font-black inline-block bg-lime border-[4px] border-lime rounded-full px-10 py-4 text-base text-navy uppercase tracking-wide press-4 press-black transition-all"
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
