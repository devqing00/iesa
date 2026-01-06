"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

// Hydration helper
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function EventsPage() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getSnapshot,
    getServerSnapshot
  );
  const { theme, setTheme } = useTheme();

  if (!mounted) return null;

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
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* ============================================
          NAVIGATION HEADER
          ============================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-bg-primary/90 backdrop-blur-sm border-b border-border">
        <div className="section-container flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 relative">
              {theme === "light" ? (
                <Image
                  src="/assets/images/logo.svg"
                  alt="IESA"
                  fill
                  className="object-contain"
                />
              ) : (
                <Image
                  src="/assets/images/logo-light.svg"
                  alt="IESA"
                  fill
                  className="object-contain"
                />
              )}
            </div>
            <span className="font-display text-xl">IESA</span>
          </Link>

          {/* Center Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/about"
              className="text-label text-text-secondary hover:text-text-primary transition-colors"
            >
              About
            </Link>
            <Link
              href="/history"
              className="text-label text-text-secondary hover:text-text-primary transition-colors"
            >
              History
            </Link>
            <Link
              href="/events"
              className="text-label text-text-primary transition-colors"
            >
              Events
            </Link>
            <Link
              href="/contact"
              className="text-label text-text-secondary hover:text-text-primary transition-colors"
            >
              Contact
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 hover:bg-bg-secondary rounded transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                  />
                </svg>
              )}
            </button>
            <Link
              href="/login"
              className="btn-editorial btn-editorial-plus hidden sm:inline-flex"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="section-container">
          {/* Top Row */}
          <div className="flex justify-between items-center mb-12">
            <span className="page-number">Page 01</span>
            <span className="text-label-sm text-text-muted flex items-center gap-2">
              <span>✦</span> Events
            </span>
          </div>

          {/* Hero Content */}
          <div className="max-w-4xl space-y-8">
            <h1 className="font-display text-display-lg">
              Connect, Learn,
              <br />& Grow
            </h1>
            <p className="text-body text-text-secondary max-w-2xl text-lg leading-relaxed">
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
      <section className="py-20 border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">01</span>
              <span className="text-label">Upcoming Events</span>
            </div>
            <span className="page-number">Page 02</span>
          </div>

          {/* Events Grid */}
          <div className="space-y-8">
            {upcomingEvents.map((event, i) => (
              <div key={i} className="page-frame p-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-4">
                      <span className="text-label-sm text-text-muted px-3 py-1 border border-border">
                        {event.type}
                      </span>
                      <span className="text-label-sm text-text-muted">
                        ◆ {event.date}
                      </span>
                    </div>
                    <h3 className="font-display text-display-sm">
                      {event.title}
                    </h3>
                    <p className="text-body text-text-secondary leading-relaxed">
                      {event.description}
                    </p>
                    <p className="text-label-sm text-text-muted flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                        />
                      </svg>
                      {event.location}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Link
                      href="/register"
                      className="btn-editorial btn-editorial-plus"
                    >
                      Register
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          PAST EVENTS
          ============================================ */}
      <section className="py-20 bg-bg-secondary border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">02</span>
              <span className="text-label">Past Events</span>
            </div>
            <span className="page-number">Page 03</span>
          </div>

          {/* Past Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {pastEvents.map((event, i) => (
              <div key={i} className="page-frame p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-label-sm text-text-muted">
                    ◆ {event.date}
                  </span>
                  <span className="text-label-sm text-text-muted">
                    {event.attendees} attendees
                  </span>
                </div>
                <h3 className="font-display text-xl">{event.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          EVENT CATEGORIES
          ============================================ */}
      <section className="py-20 border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">03</span>
              <span className="text-label">Event Categories</span>
            </div>
            <span className="page-number">Page 04</span>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              {
                name: "Conferences",
                count: "3/year",
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                    />
                  </svg>
                ),
              },
              {
                name: "Workshops",
                count: "10+/year",
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
                    />
                  </svg>
                ),
              },
              {
                name: "Industry Visits",
                count: "5+/year",
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
                    />
                  </svg>
                ),
              },
              {
                name: "Social Events",
                count: "8+/year",
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z"
                    />
                  </svg>
                ),
              },
            ].map((category, i) => (
              <div key={i} className="page-frame p-8 text-center space-y-4">
                <div className="text-text-primary flex justify-center">
                  {category.icon}
                </div>
                <h3 className="font-display text-lg">{category.name}</h3>
                <p className="text-label-sm text-text-muted">
                  {category.count}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          CTA SECTION
          ============================================ */}
      <section className="py-20 border-t border-border">
        <div className="section-container">
          <div className="p-12 lg:p-20 text-center space-y-8 bg-charcoal dark:bg-cream">
            <span className="text-label-sm text-cream/60 dark:text-charcoal/60 flex items-center justify-center gap-2">
              <span>✦</span> Stay Updated <span>✦</span>
            </span>
            <h2 className="font-display text-display-md text-cream dark:text-charcoal">
              Never Miss
              <br />
              an Event
            </h2>
            <p className="text-body text-cream/70 dark:text-charcoal/70 max-w-md mx-auto">
              Join IESA to get notified about upcoming events and exclusive
              member-only activities.
            </p>
            <Link
              href="/register"
              className="inline-block px-6 py-3 border border-cream dark:border-charcoal text-cream dark:text-charcoal text-label hover:bg-cream hover:text-charcoal dark:hover:bg-charcoal dark:hover:text-cream transition-colors"
            >
              + Join IESA +
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          FOOTER
          ============================================ */}
      <footer className="py-12 border-t border-border">
        <div className="section-container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-label-sm text-text-muted">
              © {new Date().getFullYear()} IESA. All rights reserved.
            </p>
            <p className="text-label-sm text-text-muted flex items-center gap-2">
              <span>✦</span> University of Ibadan, Nigeria
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
