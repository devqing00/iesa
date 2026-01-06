"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

// Hydration helper
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function AboutPage() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getSnapshot,
    getServerSnapshot
  );
  const { theme, setTheme } = useTheme();

  if (!mounted) return null;

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
              className="text-label text-text-primary transition-colors"
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
              className="text-label text-text-secondary hover:text-text-primary transition-colors"
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
              <span>✦</span> About Us
            </span>
          </div>

          {/* Hero Content */}
          <div className="max-w-4xl space-y-8">
            <h1 className="font-display text-display-lg">
              Shaping the Future
              <br />
              of Industrial Engineering
            </h1>
            <p className="text-body text-text-secondary max-w-2xl text-lg leading-relaxed">
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
      <section className="py-20 border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">01</span>
              <span className="text-label">Our Purpose</span>
            </div>
            <span className="page-number">Page 02</span>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Mission */}
            <div className="space-y-6">
              <div className="page-frame p-8 space-y-6">
                <span className="text-label-sm text-text-muted flex items-center gap-2">
                  <span>◆</span> Mission
                </span>
                <h2 className="font-display text-display-sm">
                  Empowering Students
                </h2>
                <p className="text-body text-text-secondary leading-relaxed">
                  To foster academic excellence, professional growth, and a
                  strong sense of community among industrial engineering
                  students while bridging the gap between theoretical knowledge
                  and practical application.
                </p>
              </div>
            </div>

            {/* Vision */}
            <div className="space-y-6">
              <div className="page-frame p-8 space-y-6">
                <span className="text-label-sm text-text-muted flex items-center gap-2">
                  <span>◆</span> Vision
                </span>
                <h2 className="font-display text-display-sm">
                  Leading Innovation
                </h2>
                <p className="text-body text-text-secondary leading-relaxed">
                  To be the foremost student association in Nigeria, recognized
                  for producing industry-ready graduates who drive innovation
                  and excellence in industrial engineering.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          WHAT WE DO
          ============================================ */}
      <section className="py-20 bg-bg-secondary border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">02</span>
              <span className="text-label">What We Do</span>
            </div>
            <span className="page-number">Page 03</span>
          </div>

          {/* Activities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Academic Support",
                description:
                  "Tutorial sessions, study groups, past question resources, and academic mentorship programs.",
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
                      d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                    />
                  </svg>
                ),
              },
              {
                title: "Industry Connections",
                description:
                  "Networking events, company visits, internship placements, and career guidance sessions.",
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
                      d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
                    />
                  </svg>
                ),
              },
              {
                title: "Workshops & Seminars",
                description:
                  "Technical workshops, soft skills training, and seminars featuring industry experts.",
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
                      d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                    />
                  </svg>
                ),
              },
              {
                title: "Social Events",
                description:
                  "Orientation programs, social gatherings, sports competitions, and cultural celebrations.",
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
                title: "Publications",
                description:
                  "IESA magazine, newsletters, academic journals, and digital content creation.",
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
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                ),
              },
              {
                title: "Community Service",
                description:
                  "Outreach programs, volunteering initiatives, and projects that give back to society.",
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
                      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                    />
                  </svg>
                ),
              },
            ].map((activity, i) => (
              <div
                key={i}
                className="page-frame p-8 space-y-6 group hover:bg-bg-card transition-colors"
              >
                <div className="text-text-primary">{activity.icon}</div>
                <h3 className="font-display text-xl">{activity.title}</h3>
                <p className="text-body text-text-secondary text-sm leading-relaxed">
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
      <section className="py-20 border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">03</span>
              <span className="text-label">Leadership</span>
            </div>
            <span className="page-number">Page 04</span>
          </div>

          {/* Leadership Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { role: "President", name: "Leadership Position" },
              { role: "Vice President", name: "Leadership Position" },
              { role: "General Secretary", name: "Leadership Position" },
              { role: "Financial Secretary", name: "Leadership Position" },
            ].map((leader, i) => (
              <div key={i} className="text-center space-y-4">
                <div className="framed-image aspect-square max-w-48 mx-auto">
                  <div className="w-full h-full bg-bg-secondary flex items-center justify-center">
                    <span className="text-text-muted text-4xl">✦</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-label-sm text-text-muted">{leader.role}</p>
                  <h3 className="font-display text-lg">{leader.name}</h3>
                </div>
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
              <span>✦</span> Join Us <span>✦</span>
            </span>
            <h2 className="font-display text-display-md text-cream dark:text-charcoal">
              Become Part of
              <br />
              Our Story
            </h2>
            <p className="text-body text-cream/70 dark:text-charcoal/70 max-w-md mx-auto">
              Join IESA today and connect with fellow students, access exclusive
              resources, and shape your engineering career.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="px-6 py-3 border border-cream dark:border-charcoal text-cream dark:text-charcoal text-label hover:bg-cream hover:text-charcoal dark:hover:bg-charcoal dark:hover:text-cream transition-colors"
              >
                + Join IESA +
              </Link>
              <Link
                href="/contact"
                className="px-6 py-3 border border-cream/30 dark:border-charcoal/30 text-cream/70 dark:text-charcoal/70 text-label hover:border-cream hover:text-cream dark:hover:border-charcoal dark:hover:text-charcoal transition-colors"
              >
                Contact Us
              </Link>
            </div>
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
