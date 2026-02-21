"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Events", href: "/events" },
    { label: "History", href: "/history" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-snow/95 backdrop-blur-sm border-b-[3px] border-navy">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 relative">
            <Image src="/assets/images/logo.svg" alt="IESA Logo" fill className="object-contain" />
          </div>
          <span className="font-display font-black text-lg text-navy hidden sm:block">IESA</span>
        </Link>

        {/* Desktop Nav — pill container */}
        <nav className="hidden md:flex items-center gap-1 bg-ghost rounded-2xl p-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-1.5 text-xs font-display font-bold uppercase tracking-wide rounded-xl transition-all ${
                  isActive
                    ? "bg-lime text-navy shadow-[2px_2px_0_0_#0F0F2D]"
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
            className="hidden md:inline-flex items-center gap-2 bg-lime border-[3px] border-navy rounded-xl px-5 py-1.5 font-display font-black text-sm text-navy shadow-[3px_3px_0_0_#0F0F2D] hover:shadow-[5px_5px_0_0_#0F0F2D] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
          >
            {user ? "Dashboard" : "Get Started"}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-xl border-[3px] border-navy text-navy hover:bg-lime-light transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-3 right-3 mt-2 bg-snow border-[4px] border-navy rounded-3xl shadow-[8px_8px_0_0_#000] z-50 overflow-hidden">
          <div className="p-3 space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-4 py-3 rounded-2xl text-sm font-display font-bold transition-all ${
                    isActive
                      ? "bg-lime text-navy"
                      : "text-navy/60 hover:text-navy hover:bg-lime-light"
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="border-t-[3px] border-navy/10 pt-2 mt-2">
              <Link
                href={user ? "/dashboard" : "/login"}
                className="block w-full text-center bg-lime border-[3px] border-navy rounded-xl py-3 font-display font-black text-sm text-navy shadow-[3px_3px_0_0_#0F0F2D]"
                onClick={() => setIsMenuOpen(false)}
              >
                {user ? "Go to Dashboard" : "Get Started →"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
