"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/context/AuthContext";

// Hydration helper
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function Home() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getSnapshot,
    getServerSnapshot
  );
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

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
              href="#about"
              className="text-label text-text-secondary hover:text-text-primary transition-colors"
            >
              About
            </Link>
            <Link
              href="#history"
              className="text-label text-text-secondary hover:text-text-primary transition-colors"
            >
              History
            </Link>
            <Link
              href="#stats"
              className="text-label text-text-secondary hover:text-text-primary transition-colors"
            >
              Statistics
            </Link>
            <Link
              href="#events"
              className="text-label text-text-secondary hover:text-text-primary transition-colors"
            >
              Events
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
              href={user ? "/dashboard" : "/login"}
              className="btn-editorial btn-editorial-plus hidden sm:inline-flex"
            >
              {user ? "Dashboard" : "Login"}
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="section-container">
          {/* Top Row - Page Number & Label */}
          <div className="flex justify-between items-center mb-12">
            <span className="page-number">Page 01</span>
            <span className="text-label-sm text-text-muted flex items-center gap-2">
              <span>✦</span> Established 2018
            </span>
          </div>

          {/* Hero Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column - Main Title */}
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-4">
                <span className="text-label text-text-secondary flex items-center gap-2">
                  <span>✦</span> Welcome to
                </span>
                <h1 className="font-display text-display-xl">IESA</h1>
                <p className="font-display text-display-sm text-text-secondary">
                  Industrial Engineering
                  <br />
                  Student Association
                </p>
              </div>

              <p className="text-body text-text-secondary max-w-md leading-relaxed">
                A vibrant community of future industrial engineers at the
                University of Ibadan, dedicated to academic excellence,
                professional development, and innovation in engineering.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/register"
                  className="btn-editorial btn-editorial-plus"
                >
                  Join Community
                </Link>
                <Link href="#about" className="btn-editorial">
                  Learn More
                </Link>
              </div>
            </div>

            {/* Right Column - Architectural Wireframe Globe */}
            <div className="lg:col-span-5 relative">
              <div className="aspect-square max-w-100 mx-auto relative">
                {/* Architectural Globe SVG - More detailed wireframe */}
                <svg
                  viewBox="0 0 400 400"
                  className="w-full h-full"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                >
                  {/* Main outer circle */}
                  <circle
                    cx="200"
                    cy="200"
                    r="180"
                    className="text-border-dark"
                    strokeWidth="1"
                  />

                  {/* Latitude lines (horizontal ellipses) */}
                  {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map(
                    (offset, i) => {
                      const y = 200 + offset;
                      const rx = Math.sqrt(
                        Math.max(0, 180 * 180 - offset * offset)
                      );
                      return rx > 0 ? (
                        <ellipse
                          key={`lat-${i}`}
                          cx="200"
                          cy={y}
                          rx={rx}
                          ry={rx * 0.3}
                          className="text-border"
                          strokeWidth="0.5"
                        />
                      ) : null;
                    }
                  )}

                  {/* Longitude lines (vertical ellipses rotated) */}
                  {[0, 20, 40, 60, 80, 100, 120, 140, 160].map((angle, i) => (
                    <ellipse
                      key={`lon-${i}`}
                      cx="200"
                      cy="200"
                      rx={180 * Math.sin((angle * Math.PI) / 180)}
                      ry="180"
                      className="text-border"
                      strokeWidth="0.5"
                    />
                  ))}

                  {/* Prime meridian and equator - stronger */}
                  <ellipse
                    cx="200"
                    cy="200"
                    rx="180"
                    ry="180"
                    className="text-border-dark"
                    strokeWidth="0.75"
                  />
                  <line
                    x1="200"
                    y1="20"
                    x2="200"
                    y2="380"
                    className="text-border-dark"
                    strokeWidth="0.75"
                  />
                  <ellipse
                    cx="200"
                    cy="200"
                    rx="180"
                    ry="54"
                    className="text-border-dark"
                    strokeWidth="0.75"
                  />

                  {/* Axis line through poles */}
                  <line
                    x1="200"
                    y1="0"
                    x2="200"
                    y2="400"
                    className="text-border"
                    strokeWidth="0.5"
                    strokeDasharray="4 4"
                  />

                  {/* Pole markers */}
                  <circle
                    cx="200"
                    cy="20"
                    r="3"
                    fill="currentColor"
                    className="text-text-primary"
                  />
                  <circle
                    cx="200"
                    cy="380"
                    r="3"
                    fill="currentColor"
                    className="text-text-primary"
                  />

                  {/* Equator intersection points */}
                  <circle
                    cx="20"
                    cy="200"
                    r="2"
                    fill="currentColor"
                    className="text-text-muted"
                  />
                  <circle
                    cx="380"
                    cy="200"
                    r="2"
                    fill="currentColor"
                    className="text-text-muted"
                  />

                  {/* Small decorative circles at intersections */}
                  <circle
                    cx="200"
                    cy="200"
                    r="4"
                    className="text-border-dark"
                    strokeWidth="1"
                  />
                  <circle
                    cx="200"
                    cy="200"
                    r="1.5"
                    fill="currentColor"
                    className="text-text-primary"
                  />
                </svg>

                {/* Floating Label */}
                <div className="absolute bottom-4 right-4 text-label-sm text-text-muted">
                  ◆ Global Vision
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          ABOUT SECTION - Split Layout
          ============================================ */}
      <section id="about" className="py-20 border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">01</span>
              <span className="text-label">About Us</span>
            </div>
            <span className="page-number">Page 02</span>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Left - Image */}
            <div className="framed-image aspect-4/3">
              <Image
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800&auto=format&fit=crop"
                alt="Students collaborating"
                fill
                className="object-cover"
              />
            </div>

            {/* Right - Content */}
            <div className="flex flex-col justify-center space-y-6">
              <span className="text-label-sm text-text-muted flex items-center gap-2">
                <span>✦</span> Who We Are
              </span>
              <h2 className="font-display text-display-md">
                Shaping Tomorrow&apos;s
                <br />
                Engineers
              </h2>
              <p className="text-body text-text-secondary leading-relaxed">
                The Industrial Engineering Student Association (IESA) is the
                official body representing students in the Department of
                Industrial and Production Engineering at the University of
                Ibadan. We serve as a bridge between students, faculty, and
                industry.
              </p>
              <p className="text-body text-text-secondary leading-relaxed">
                Our mission is to enhance the academic experience, provide
                professional development opportunities, and create a supportive
                community for all industrial engineering students.
              </p>
              <Link
                href="#history"
                className="btn-editorial btn-editorial-plus w-fit"
              >
                Our Story
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          HISTORY SECTION - Asymmetric Layout
          ============================================ */}
      <section
        id="history"
        className="py-20 bg-bg-secondary border-t border-border"
      >
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">02</span>
              <span className="text-label">History</span>
            </div>
            <span className="page-number">Page 03</span>
          </div>

          {/* Content Grid - Asymmetric */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left Column - Small Info Card */}
            <div className="lg:col-span-4 space-y-8">
              <div className="page-frame p-8 space-y-6">
                <span className="text-label-sm text-text-muted flex items-center gap-2">
                  <span>◆</span> Since 2018
                </span>
                <h3 className="font-display text-display-sm">
                  A Legacy of Excellence
                </h3>
                <p className="text-body text-text-secondary text-sm leading-relaxed">
                  From humble beginnings to becoming one of the most active
                  student associations at UI, our journey has been defined by
                  dedication and innovation.
                </p>
                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Members</span>
                    <span className="font-display">500+</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Large Image */}
            <div className="lg:col-span-8">
              <div className="framed-image aspect-video">
                <Image
                  src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1000&auto=format&fit=crop"
                  alt="Historical moment"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-16 pt-16 border-t border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { year: "2018", event: "IESA Founded" },
                { year: "2019", event: "First Annual Summit" },
                { year: "2022", event: "Digital Platform Launch" },
                { year: "2024", event: "500+ Members" },
              ].map((item, i) => (
                <div key={i} className="text-center space-y-2">
                  <span className="font-display text-display-sm">
                    {item.year}
                  </span>
                  <p className="text-label-sm text-text-muted">{item.event}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          STATISTICS SECTION
          ============================================ */}
      <section id="stats" className="py-20 border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">03</span>
              <span className="text-label">By the Numbers</span>
            </div>
            <span className="page-number">Page 04</span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
            {[
              { number: "500+", label: "Active Members", icon: "✦" },
              { number: "50+", label: "Events Annually", icon: "◆" },
              { number: "95%", label: "Graduate Rate", icon: "✦" },
              { number: "20+", label: "Industry Partners", icon: "◆" },
            ].map((stat, i) => (
              <div key={i} className="page-frame p-8 text-center space-y-4">
                <span className="text-text-muted text-sm">{stat.icon}</span>
                <div className="font-display text-display-md">
                  {stat.number}
                </div>
                <p className="text-label-sm text-text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          FEATURES SECTION
          ============================================ */}
      <section className="py-20 bg-bg-secondary border-t border-border">
        <div className="section-container">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-4">
              <span className="text-label text-text-muted">04</span>
              <span className="text-label">What We Offer</span>
            </div>
            <span className="page-number">Page 05</span>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Academic Excellence",
                description:
                  "Access study resources, past questions, and collaborative learning sessions with peers.",
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
                title: "Professional Growth",
                description:
                  "Connect with industry professionals through workshops, seminars, and networking events.",
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
                title: "Community",
                description:
                  "Join a supportive network of peers who share your passion for industrial engineering.",
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
            ].map((feature, i) => (
              <div
                key={i}
                className="page-frame p-8 space-y-6 group hover:bg-bg-card transition-colors"
              >
                <div className="text-text-primary">{feature.icon}</div>
                <h3 className="font-display text-xl">{feature.title}</h3>
                <p className="text-body text-text-secondary text-sm leading-relaxed">
                  {feature.description}
                </p>
                <span className="inline-flex items-center gap-2 text-label-sm text-text-muted group-hover:text-text-primary transition-colors">
                  Learn more
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
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </span>
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
              <span>✦</span> Join the Community <span>✦</span>
            </span>
            <h2 className="font-display text-display-md text-cream dark:text-charcoal">
              Ready to Begin
              <br />
              Your Journey?
            </h2>
            <p className="text-body text-cream/70 dark:text-charcoal/70 max-w-md mx-auto">
              Join hundreds of industrial engineering students and gain access
              to exclusive resources, events, and opportunities.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="px-6 py-3 border border-cream dark:border-charcoal text-cream dark:text-charcoal text-label hover:bg-cream hover:text-charcoal dark:hover:bg-charcoal dark:hover:text-cream transition-colors"
              >
                + Get Started +
              </Link>
              <Link
                href="/login"
                className="px-6 py-3 border border-cream/30 dark:border-charcoal/30 text-cream/70 dark:text-charcoal/70 text-label hover:border-cream hover:text-cream dark:hover:border-charcoal dark:hover:text-charcoal transition-colors"
              >
                Sign In
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
          {/* Top Row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pb-12 border-b border-border">
            {/* Logo */}
            <div className="flex items-center gap-3">
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
            </div>

            {/* Nav Links */}
            <nav className="flex flex-wrap gap-8">
              <Link
                href="#about"
                className="text-label-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                About
              </Link>
              <Link
                href="#history"
                className="text-label-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                History
              </Link>
              <Link
                href="#stats"
                className="text-label-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Statistics
              </Link>
              <Link
                href="/login"
                className="text-label-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Login
              </Link>
            </nav>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="text-text-muted hover:text-text-primary transition-colors"
                aria-label="Twitter"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a
                href="#"
                className="text-text-muted hover:text-text-primary transition-colors"
                aria-label="Instagram"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a
                href="#"
                className="text-text-muted hover:text-text-primary transition-colors"
                aria-label="LinkedIn"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8">
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
