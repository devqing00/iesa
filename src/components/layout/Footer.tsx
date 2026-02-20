"use client";

import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative z-20 w-full bg-navy border-t-[4px] border-navy">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 relative">
                <Image src="/assets/images/logo.svg" alt="IESA Logo" width={40} height={40} className="object-contain brightness-0 invert" />
              </div>
              <span className="font-display font-black text-xl text-ghost">IESA</span>
            </div>
            <p className="text-sm text-ghost/70 font-medium max-w-xs leading-relaxed">
              Industrial &amp; Production Engineering Students&apos; Association, University of Ibadan.
            </p>
            {/* ✦ decorator */}
            <div className="flex items-center gap-2 text-lime/30">
              <span className="text-xs">✦</span>
              <div className="h-px w-16 bg-lime/20" />
              <span className="text-xs">✦</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-display font-black text-lime mb-5 uppercase tracking-widest text-xs">Quick Links</h3>
            <div className="space-y-3">
              {["About", "Events", "History", "Contact"].map((label) => (
                <Link
                  key={label}
                  href={`/${label.toLowerCase()}`}
                  className="block text-sm text-ghost/70 font-medium hover:text-lime hover:translate-x-1 transition-all duration-200"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Connect */}
          <div>
            <h3 className="font-display font-black text-lime mb-5 uppercase tracking-widest text-xs">Connect</h3>
            <div className="flex gap-3 mb-6">
              {[
                {
                  label: "Twitter",
                  href: "https://twitter.com/iesa_ui",
                  icon: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
                },
                {
                  label: "Instagram",
                  href: "https://instagram.com/iesa_ui",
                  icon: <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />,
                },
                {
                  label: "LinkedIn",
                  href: "https://linkedin.com/company/iesa-ui",
                  icon: <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />,
                },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-lime border-[3px] border-navy rounded-full flex items-center justify-center hover:bg-coral hover:scale-110 transition-all duration-200"
                  aria-label={social.label}
                >
                  <svg className="w-5 h-5 text-navy" fill="currentColor" viewBox="0 0 24 24">
                    {social.icon}
                  </svg>
                </a>
              ))}
            </div>
            <p className="text-xs text-ghost/50 font-medium">University of Ibadan, Nigeria</p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t-[2px] border-ghost/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-ghost/50 font-medium">
            &copy; {new Date().getFullYear()} IESA. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-ghost/30 text-xs">
            <span>✦</span>
            <span className="text-ghost/50 font-medium">Built with purpose</span>
            <span>✦</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
