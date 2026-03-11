"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  const navLinks = [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Events", href: "/events" },
    { label: "Team", href: "/team" },
    { label: "IEPOD", href: "/iepod" },
    { label: "History", href: "/history" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-snow/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 relative z-[60]"
          >
            <div className="w-9 h-9 relative">
              <Image
                src="/assets/images/logo.svg"
                alt="IESA Logo"
                fill
                className="object-contain"
              />
            </div>
            <span
              className={`font-display font-black text-lg hidden sm:block ${isMenuOpen ? "text-snow" : "text-navy"} md:text-navy transition-colors`}
            >
              IESA
            </span>
          </Link>

          {/* Desktop Nav — pill container */}
          <nav className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2.5 text-xs font-display font-bold uppercase tracking-wide rounded-lg transition-all ${
                    isActive
                      ? "bg-navy text-snow"
                      : "text-navy/60 hover:text-navy hover:bg-snow"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* CTA button — desktop only */}
            <Link
              href={user ? "/dashboard" : "/login"}
              className="hidden md:inline-flex items-center gap-2 bg-navy hover:bg-coral border border-lime rounded-lg px-5 py-3 font-display font-black text-sm text-snow transition-colors"
            >
              {user ? "Dashboard" : "Get Started"}
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-1.5 rounded-lg bg-ghost border-[2px] border-navy hover:bg-navy hover:border-navy transition-all relative z-[60] group"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? (
                <span className="font-display font-black text-sm text-snow uppercase tracking-widest">
                  Close
                </span>
              ) : (
                <svg
                  className="w-5 h-5 text-navy group-hover:text-snow transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Fullscreen Mobile Menu — rendered outside <header> to avoid backdrop-filter containing-block bug */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-lavender flex flex-col items-center justify-center md:hidden">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="absolute top-5 right-5 md:hidden px-2.5 py-1 rounded-lg bg-ghost border-[2px] border-navy hover:bg-coral hover:border-navy transition-all z-60 group"
            aria-label="Close menu"
          >
            Close
          </button>

          {/* Decorative sparkle */}
          <svg
            className="absolute top-12 left-8 w-6 h-6 text-snow/10 pointer-events-none"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>
          <svg
            className="absolute bottom-12 left-8 w-6 h-6 text-snow/10 pointer-events-none"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>
          <svg
            className="absolute bottom-12 right-8 w-6 h-6 text-snow/10 pointer-events-none"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
          </svg>

          <nav className="flex flex-col items-center gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-display font-black text-4xl sm:text-5xl uppercase tracking-tight transition-colors ${
                    isActive ? "text-navy" : "text-snow/90 hover:text-navy"
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10">
            <Link
              href={user ? "/dashboard" : "/login"}
              className="inline-flex items-center gap-2 bg-snow rounded-lg border-[2px] border-navy px-8 py-3 font-display font-black text-base text-navy uppercase tracking-wide hover:bg-ghost transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              {user ? "Go to Dashboard" : "Get Started →"}
            </Link>
          </div>

          <p className="absolute bottom-8 text-[10px] font-bold text-snow/30 uppercase tracking-[0.2em]">
            Be creative with us
          </p>
        </div>
      )}
    </>
  );
}
