"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

// Hydration helper
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function HistoryPage() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getSnapshot,
    getServerSnapshot
  );
  const { theme, setTheme } = useTheme();

  if (!mounted) return null;

  const timeline = [
    {
      year: "2018",
      title: "Foundation",
      description:
        "IESA was founded by a group of passionate industrial engineering students with a vision to create a supportive community for academic and professional growth.",
    },
    {
      year: "2019",
      title: "First Annual Summit",
      description:
        "Organized the inaugural IESA Industrial Engineering Summit, bringing together students, faculty, and industry professionals for knowledge sharing.",
    },
    {
      year: "2020",
      title: "Digital Transformation",
      description:
        "Adapted to virtual operations during global challenges, launching online tutorials, webinars, and the IESA digital resource library.",
    },
    {
      year: "2021",
      title: "Industry Partnerships",
      description:
        "Established formal partnerships with leading manufacturing and consulting firms for internship placements and mentorship programs.",
    },
    {
      year: "2022",
      title: "Platform Launch",
      description:
        "Launched the IESA digital platform, providing members with access to resources, event management, and community features.",
    },
    {
      year: "2023",
      title: "Regional Recognition",
      description:
        "Received recognition as one of the most active engineering student associations in the region, with membership exceeding 400 students.",
    },
    {
      year: "2024",
      title: "500+ Members",
      description:
        "Reached a milestone of over 500 active members, expanded community outreach programs, and launched the IESA mentorship initiative.",
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
              className="text-label text-text-primary transition-colors"
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
              <span>✦</span> Our History
            </span>
          </div>

          {/* Hero Content */}
          <div className="max-w-4xl space-y-8">
            <h1 className="font-display text-display-lg">
              A Legacy of
              <br />
              Excellence
            </h1>
            <p className="text-body text-text-secondary max-w-2xl text-lg leading-relaxed">
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
      <section className="py-20 border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">01</span>
              <span className="text-label">Timeline</span>
            </div>
            <span className="page-number">Page 02</span>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-border transform md:-translate-x-px" />

            {/* Timeline Items */}
            <div className="space-y-12">
              {timeline.map((item, i) => (
                <div
                  key={i}
                  className={`relative flex flex-col md:flex-row gap-8 ${
                    i % 2 === 0 ? "md:flex-row-reverse" : ""
                  }`}
                >
                  {/* Content */}
                  <div className="md:w-1/2 pl-20 md:pl-0 md:pr-12 md:text-right">
                    {i % 2 === 0 ? (
                      <div className="md:pl-12 md:text-left">
                        <div className="page-frame p-8 space-y-4">
                          <span className="font-display text-display-sm text-text-muted">
                            {item.year}
                          </span>
                          <h3 className="font-display text-xl">{item.title}</h3>
                          <p className="text-body text-text-secondary text-sm leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="page-frame p-8 space-y-4">
                        <span className="font-display text-display-sm text-text-muted">
                          {item.year}
                        </span>
                        <h3 className="font-display text-xl">{item.title}</h3>
                        <p className="text-body text-text-secondary text-sm leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Empty space for alternating layout */}
                  <div className="hidden md:block md:w-1/2" />

                  {/* Dot */}
                  <div className="absolute left-8 md:left-1/2 top-8 w-4 h-4 bg-bg-primary border-2 border-border-dark rounded-full transform -translate-x-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          MILESTONES SECTION
          ============================================ */}
      <section className="py-20 bg-bg-secondary border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">02</span>
              <span className="text-label">Milestones</span>
            </div>
            <span className="page-number">Page 03</span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: "7+", label: "Years of Impact" },
              { number: "500+", label: "Active Members" },
              { number: "50+", label: "Events Hosted" },
              { number: "20+", label: "Industry Partners" },
            ].map((stat, i) => (
              <div key={i} className="text-center space-y-4">
                <span className="font-display text-display-md block">
                  {stat.number}
                </span>
                <p className="text-label-sm text-text-muted">{stat.label}</p>
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
              <span>✦</span> Be Part of History <span>✦</span>
            </span>
            <h2 className="font-display text-display-md text-cream dark:text-charcoal">
              Write the Next
              <br />
              Chapter With Us
            </h2>
            <p className="text-body text-cream/70 dark:text-charcoal/70 max-w-md mx-auto">
              Join IESA and become part of our continuing story of excellence
              and impact.
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
