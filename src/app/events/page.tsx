import Image from "next/image";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// ── Types ──────────────────────────────────────────────────

interface PublicEvent {
  _id: string;
  title: string;
  date: string;
  location: string;
  category: string;
  description: string;
  imageUrl?: string;
  requiresPayment?: boolean;
  paymentAmount?: number;
  maxAttendees?: number;
}

interface PublicEventsResponse {
  upcoming: PublicEvent[];
  past: PublicEvent[];
  sessionName: string | null;
}

function getPublicApiBaseUrl(): string {
  const configured = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8000"
  ).replace(/\/$/, "");

  if (
    configured.startsWith("http://") &&
    !configured.startsWith("http://localhost") &&
    !configured.startsWith("http://127.0.0.1")
  ) {
    return configured.replace(/^http:\/\//, "https://");
  }

  return configured;
}

// ── Fetch events from the public API ────────────────────────

async function fetchPublicEvents(): Promise<PublicEventsResponse> {
  const apiUrl = getPublicApiBaseUrl();
  try {
    const res = await fetch(`${apiUrl}/api/v1/events/public`, {
      next: { revalidate: 300 }, // revalidate every 5 minutes
    });
    if (!res.ok) return { upcoming: [], past: [], sessionName: null };
    return res.json();
  } catch {
    return { upcoming: [], past: [], sessionName: null };
  }
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatPastDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}

// ── Page Component (Server Component) ──────────────────────

export default async function EventsPage() {
  const { upcoming, past } = await fetchPublicEvents();

  return (
    <div className="min-h-screen bg-ghost text-navy overflow-x-hidden">
      {/* Diamond decorators */}
      <svg className="fixed top-24 right-[12%] w-7 h-7 text-lavender/15 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[55%] left-[10%] w-6 h-6 text-teal/20 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed bottom-[20%] right-[18%] w-5 h-5 text-coral/20 pointer-events-none z-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>

      {/* SHARED HEADER */}
      <Header />

      <main id="main-content" className="pt-14 sm:pt-16">
      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="pt-16 pb-12 sm:pb-16 relative overflow-hidden md:min-h-[calc(100vh-5rem)] flex flex-col justify-center">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1920"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-linear-to-r from-navy/90 via-navy/75 to-navy/40" />
          <div className="absolute inset-0 bg-linear-to-t from-navy/60 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Content */}
          <div className="max-w-4xl space-y-8">
            <h1 className="font-display font-black text-[2.5rem] sm:text-[4rem] lg:text-[5rem] leading-[0.9] text-snow">
              Engineer,
              <br />
              <span className="inline-block bg-sunny text-navy border-[2px] border-navy px-4 sm:px-6 py-2 rotate-[-1deg] shadow-[3px_3px_0_0_#000]">Optimize</span>
              &amp; Lead
            </h1>
            <p className="font-display font-medium text-base sm:text-lg text-snow/70 max-w-2xl leading-relaxed">
              From operations workshops and plant-focused talks to career and
              innovation events, IESA programs are built to strengthen your
              Industrial &amp; Production Engineering journey.
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
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              Upcoming Events
            </h2>
          </div>

          {upcoming.length === 0 ? (
            <div className="bg-ghost border-[2px] border-cloud rounded-3xl p-8 sm:p-12 text-center">
              <p className="font-display font-bold text-lg text-slate">No upcoming events at the moment</p>
              <p className="font-display font-medium text-sm text-slate mt-2">Check back soon for the next IPE-focused workshops and sessions.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {upcoming.map((event, i) => {
                const colors = ["bg-lavender", "bg-teal", "bg-coral"];
                return (
                  <div key={event._id} className={`${colors[i % 3]} border-[2px] border-navy rounded-3xl p-6 sm:p-8 press-3 press-black transition-all`}>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-display font-bold text-[10px] text-navy uppercase tracking-widest bg-snow border-[2px] border-navy rounded-full px-3 py-1 shadow-[2px_2px_0_0_#000]">
                            {event.category}
                          </span>
                          <span className="font-display font-bold text-xs text-navy-muted flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-lime border border-navy" />
                            {formatEventDate(event.date)}
                          </span>
                          {event.requiresPayment && event.paymentAmount && (
                            <span className="font-display font-bold text-[10px] text-snow uppercase tracking-widest bg-navy border-[2px] border-navy rounded-full px-3 py-1">
                              ₦{event.paymentAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <h3 className="font-display font-black text-xl sm:text-2xl text-navy">
                          {event.title}
                        </h3>
                        <p className="font-display font-medium text-sm text-navy-muted leading-relaxed">
                          {event.description}
                        </p>
                        <p className="font-display font-bold text-xs text-slate flex items-center gap-2">
                          <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          {event.location}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <Link
                          href="/register"
                          className="inline-block font-display font-black bg-snow border-[2px] border-navy rounded-xl px-6 py-3 text-sm text-navy uppercase tracking-wide press-4 press-navy transition-all"
                        >
                          Register →
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============================================
          PAST EVENTS
          ============================================ */}
      {past.length > 0 && (
        <section className="py-16 sm:py-20 bg-ghost">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="mb-10 sm:mb-14">
              <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
                Past <span className="bg-snow border-[2px] border-navy px-4 sm:px-6 py-2 inline-block rotate-[-2deg] shadow-[3px_3px_0_0_#000]">Events</span>
              </h2>
            </div>

            {/* Past Events Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {past.map((event) => (
                <div key={event._id} className="bg-snow border-[2px] border-navy rounded-3xl p-6 press-4 press-black transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display font-bold text-xs text-slate flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-navy/30" />
                      {formatPastDate(event.date)}
                    </span>
                    <span className="font-display font-bold text-[10px] text-navy uppercase tracking-widest bg-lime-light border-[2px] border-navy rounded-full px-3 py-0.5">
                      {event.category}
                    </span>
                  </div>
                  <h3 className="font-display font-black text-lg text-navy">{event.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================
          EVENT CATEGORIES
          ============================================ */}
      <section className="py-16 sm:py-20 bg-ghost">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="font-display font-black text-3xl sm:text-5xl text-navy">
              Event Categories
            </h2>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: "Conferences", bg: "bg-lavender", icon: <svg aria-hidden="true" className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg> },
              { name: "Workshops", bg: "bg-teal", icon: <svg aria-hidden="true" className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg> },
              { name: "Industry Visits", bg: "bg-sunny", icon: <svg aria-hidden="true" className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" /></svg> },
              { name: "Social Events", bg: "bg-coral", icon: <svg aria-hidden="true" className="w-7 h-7 text-navy" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" /></svg> },
            ].map((category, i) => (
              <div key={i} className={`${category.bg} border-[2px] border-navy rounded-3xl p-6 text-center press-4 press-black transition-all`}>
                <div className="w-14 h-14 mx-auto bg-snow border-[2px] border-navy rounded-full flex items-center justify-center mb-4 shadow-[2px_2px_0_0_#000]">
                  {category.icon}
                </div>
                <h3 className="font-display font-black text-base sm:text-lg text-navy mb-1">{category.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          CTA SECTION
          ============================================ */}
      <section className="py-16 sm:py-24 bg-sunny">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block bg-navy border-[3px] border-snow rounded-full px-4 py-1.5 mb-6">
            <span className="font-display text-xs font-black text-snow uppercase tracking-widest">&#x2726; Stay Updated &#x2726;</span>
          </div>

          <h2 className="font-display font-black text-4xl sm:text-6xl text-navy mb-6 leading-none">
            Never Miss<br />an Event
          </h2>
          <p className="font-display font-medium text-base sm:text-lg text-navy-muted max-w-md mx-auto mb-8 sm:mb-10">
            Join IESA to get notified about upcoming events and exclusive
            member-only activities.
          </p>
          <Link
            href="/register"
            className="font-display font-black inline-block bg-sunny border-[2px] border-navy rounded-full px-10 py-4 text-base text-navy uppercase tracking-wide press-4 press-black transition-all"
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
